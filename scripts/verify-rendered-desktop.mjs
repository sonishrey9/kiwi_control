#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "../packages/sj-core/dist/core/bootstrap.js";
import { loadCanonicalConfig } from "../packages/sj-core/dist/core/config.js";
import { failWorkflowStep } from "../packages/sj-core/dist/core/workflow-engine.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopExecutable = path.join(
  repoRoot,
  "apps",
  "sj-ui",
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "Kiwi Control.app",
  "Contents",
  "MacOS",
  "sj-ui"
);
const probeTimeoutMs = 12_000;

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("Rendered desktop verification currently supports macOS bundle launches only.");
  }

  await fs.access(desktopExecutable).catch(() => {
    throw new Error(`Built desktop executable not found at ${desktopExecutable}. Run npm run ui:desktop:build first.`);
  });

  await killExistingKiwiProcesses();

  const blockedRepo = await createBlockedRepo();
  try {
    await verifyOverviewBlockedState(blockedRepo);
    await verifyMachineView(blockedRepo);
  } finally {
    await killExistingKiwiProcesses();
  }

  console.log("Rendered desktop verification passed.");
}

async function createBlockedRepo() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-rendered-desktop-"));
  const targetRoot = path.join(tempDir, "blocked-repo");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "package.json"), '{\n  "name": "blocked-repo"\n}\n', "utf8");

  const config = await loadCanonicalConfig(repoRoot);
  await bootstrapTarget(
    {
      repoRoot,
      targetRoot
    },
    config
  );

  await failWorkflowStep(targetRoot, {
    task: "stabilize product surface launch semantics",
    stepId: "generate-run-packets",
    failureReason: "Run packets could not be generated for the current repo guidance state.",
    validation: "Generate run packets before execution can continue."
  });

  return {
    tempDir,
    targetRoot
  };
}

async function verifyOverviewBlockedState(repo) {
  const snapshot = await launchAndCollectProbe(repo.targetRoot, null, (payload) =>
    payload.mounted === true
      && payload.activeView === "overview"
      && payload.targetRoot === repo.targetRoot
      && payload.repoMode === "healthy"
      && payload.executionState === "blocked"
      && includesAll(payload.visibleSections, [
        "guided-operation",
        "blocked-workflow-fix",
        "explain-selection",
        "terminal-recovery",
        "terminal-help"
      ])
      && includesAll(payload.visibleCommands, ["guide", "next", "validate"])
  );

  assert.equal(snapshot.mounted, true);
  assert.equal(snapshot.activeView, "overview");
  assert.equal(snapshot.repoMode, "healthy");
  assert.equal(snapshot.executionState, "blocked");
  assert.equal(snapshot.visibleSections.includes("guided-operation"), true);
  assert.equal(snapshot.visibleSections.includes("blocked-workflow-fix"), true);
  assert.equal(snapshot.visibleSections.includes("terminal-help"), true);
}

async function verifyMachineView(repo) {
  const snapshot = await launchAndCollectProbe(repo.targetRoot, "machine", (payload) =>
    payload.mounted === true
      && payload.activeView === "machine"
      && payload.targetRoot === repo.targetRoot
      && payload.visibleSections.includes("machine-setup-readiness")
  );

  assert.equal(snapshot.activeView, "machine");
  assert.equal(snapshot.visibleSections.includes("machine-setup-readiness"), true);
}

async function launchAndCollectProbe(targetRoot, probeView, predicate) {
  const bridgeDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-render-bridge-"));
  const probeFile = path.join(bridgeDir, "render-probe.json");
  const launchRequestPath = path.join(bridgeDir, "desktop-launch-request.json");
  const launchStatusPath = path.join(bridgeDir, "desktop-launch-status.json");
  const launchLogPath = path.join(bridgeDir, "desktop-launch-log.json");
  const requestId = randomUUID();

  await fs.writeFile(
    launchRequestPath,
    JSON.stringify(
      {
        requestId,
        targetRoot,
        requestedAt: new Date().toISOString(),
        launchSource: "source-bundle"
      },
      null,
      2
    ),
    "utf8"
  );

  const child = spawn(desktopExecutable, [], {
    env: {
      ...process.env,
      KIWI_CONTROL_DESKTOP_BRIDGE_DIR: bridgeDir,
      KIWI_CONTROL_RENDER_PROBE_FILE: probeFile,
      ...(probeView ? { KIWI_CONTROL_RENDER_PROBE_VIEW: probeView } : {})
    },
    stdio: "ignore"
  });

  let lastPayload = null;
  try {
    const deadline = Date.now() + probeTimeoutMs;
    while (Date.now() < deadline) {
      await delay(100);
      const payload = await readJsonFile(probeFile);
      if (!payload) {
        continue;
      }
      lastPayload = payload;
      if (predicate(payload)) {
        return payload;
      }
    }

    const launchStatus = await readTextIfExists(launchStatusPath);
    const launchLog = await readTextIfExists(launchLogPath);
    throw new Error(
      [
        `Rendered desktop probe timed out for ${targetRoot}${probeView ? ` view=${probeView}` : ""}.`,
        `Last payload: ${JSON.stringify(lastPayload, null, 2)}`,
        launchStatus ? `Launch status: ${launchStatus}` : "Launch status: <missing>",
        launchLog ? `Launch log: ${launchLog}` : "Launch log: <missing>"
      ].join("\n")
    );
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child, 1500);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }
}

async function waitForExit(child, timeoutMs) {
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(timeoutMs)
  ]);
}

async function killExistingKiwiProcesses() {
  for (const pattern of [
    "/Applications/Kiwi Control.app/Contents/MacOS/sj-ui",
    "/Volumes/shrey ssd/shrey-junior/apps/sj-ui/src-tauri/target/release/bundle/macos/Kiwi Control.app/Contents/MacOS/sj-ui"
  ]) {
    spawnSync("pkill", ["-f", pattern], { stdio: "ignore" });
  }
  await delay(400);
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function includesAll(values, required) {
  return required.every((value) => values.includes(value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
