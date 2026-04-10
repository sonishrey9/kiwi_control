#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");
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

await main();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await assertBuiltArtifacts();
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-cli-ui-truth-"));
  const sharedDesktopBridge = process.platform === "darwin"
    ? await createSharedDesktopBridge(outputRoot)
    : null;
  const targetRoot = args.externalTempRepo
    ? await createExternalTempRepo(outputRoot)
    : args.target
      ? path.resolve(args.target)
      : repoRoot;

  await killExistingKiwiProcesses();

  const steps = [];
  const task = "update README docs";
  const initialized = await pathExists(path.join(targetRoot, ".agent", "project.yaml"));

  if (!initialized) {
    steps.push(await runCliStep("init", ["init", "--target", targetRoot], outputRoot));
  }

  steps.push(await runCliStep("sync", ["sync", "--target", targetRoot, "--dry-run", "--diff-summary"], outputRoot, {
    allowFailure: true
  }));
  steps.push(await runCliStep("doctor", ["doctor", "--target", targetRoot], outputRoot, { allowFailure: true }));

  steps.push(await runCliStep("prepare", ["prepare", task, "--target", targetRoot], outputRoot));
  const preparedStatus = await runCliJsonStep("status-prepared", ["status", "--json", "--target", targetRoot], outputRoot);
  assert.equal(preparedStatus.payload.executionState.lifecycle, "packet-created");

  steps.push(await runCliStep("run", ["run", task, "--target", targetRoot], outputRoot));
  const queuedStatus = await runCliJsonStep("status-queued", ["status", "--json", "--target", targetRoot], outputRoot);
  assert.equal(queuedStatus.payload.executionState.lifecycle, "queued");

  const queuedUi = await verifyUiLaunch(targetRoot, "queued", outputRoot, "queued", sharedDesktopBridge);
  steps.push(queuedUi.step);

  const runAuto = await runCliStep("run-auto", ["run", task, "--auto", "--target", targetRoot], outputRoot, {
    allowFailure: true
  });
  steps.push(runAuto);
  const blockedStatus = await runCliJsonStep("status-blocked", ["status", "--json", "--target", targetRoot], outputRoot);
  assert.equal(blockedStatus.payload.executionState.lifecycle, "blocked");
  const blockedUi = await waitForUiState(targetRoot, "blocked", outputRoot, "blocked", sharedDesktopBridge);
  steps.push(blockedUi.step);

  steps.push(await runCliStep("prepare-recovery", ["prepare", task, "--target", targetRoot], outputRoot));
  const recoveredStatus = await runCliJsonStep("status-recovered", ["status", "--json", "--target", targetRoot], outputRoot);
  assert.equal(recoveredStatus.payload.executionState.lifecycle, "packet-created");
  const recoveredUi = await waitForUiState(targetRoot, "recovered", outputRoot, "packet-created", sharedDesktopBridge);
  steps.push(recoveredUi.step);

  const summary = {
    targetRoot,
    outputRoot,
    externalTempRepo: args.externalTempRepo,
    steps,
    queuedUi: queuedUi.probePath,
    blockedUi: blockedUi.probePath,
    recoveredUi: recoveredUi.probePath,
    screenshots: [queuedUi.screenshotPath, blockedUi.screenshotPath, recoveredUi.screenshotPath].filter(Boolean)
  };
  await fs.writeFile(path.join(outputRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

async function assertBuiltArtifacts() {
  await fs.access(cliEntrypoint).catch(() => {
    throw new Error("Built CLI entrypoint not found. Run `npm run build` first.");
  });

  if (process.platform === "darwin") {
    await fs.access(desktopExecutable).catch(() => {
      throw new Error("Built desktop bundle not found. Run `npm run ui:desktop:build` first.");
    });
  }
}

function parseArgs(argv) {
  const parsed = {
    target: null,
    externalTempRepo: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--external-temp-repo") {
      parsed.externalTempRepo = true;
      continue;
    }
    if (arg === "--target") {
      parsed.target = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return parsed;
}

async function createExternalTempRepo(outputRoot) {
  const targetRoot = path.join(outputRoot, "external-repo");
  await fs.mkdir(path.join(targetRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(targetRoot, "package.json"), '{\n  "name": "kiwi-external-proof"\n}\n', "utf8");
  await fs.writeFile(path.join(targetRoot, "README.md"), "# External Proof Repo\n", "utf8");
  await fs.writeFile(path.join(targetRoot, "src", "app.ts"), "export const app = true;\n", "utf8");
  runProcess("git", ["init"], { cwd: targetRoot, allowFailure: false });
  runProcess("git", ["add", "."], { cwd: targetRoot, allowFailure: false });
  runProcess("git", ["-c", "user.name=kiwi", "-c", "user.email=kiwi@example.com", "commit", "-m", "init"], {
    cwd: targetRoot,
    allowFailure: false
  });
  return targetRoot;
}

async function runCliStep(label, args, outputRoot, options = {}) {
  const result = runProcess(process.execPath, [cliEntrypoint, ...args], {
    cwd: repoRoot,
    allowFailure: options.allowFailure === true
  });
  await writeStepOutputs(outputRoot, label, result);
  return {
    label,
    args,
    exitCode: result.code,
    stdoutPath: path.join(outputRoot, `${label}.stdout.txt`),
    stderrPath: path.join(outputRoot, `${label}.stderr.txt`)
  };
}

async function runCliJsonStep(label, args, outputRoot) {
  const result = runProcess(process.execPath, [cliEntrypoint, ...args], {
    cwd: repoRoot,
    allowFailure: false
  });
  await writeStepOutputs(outputRoot, label, result);
  const payload = JSON.parse(result.stdout);
  return {
    step: {
      label,
      args,
      exitCode: result.code,
      stdoutPath: path.join(outputRoot, `${label}.stdout.txt`),
      stderrPath: path.join(outputRoot, `${label}.stderr.txt`)
    },
    payload
  };
}

async function createSharedDesktopBridge(outputRoot) {
  const bridgeDir = path.join(outputRoot, "bridge-shared");
  const probePath = path.join(bridgeDir, "render-probe.json");
  await fs.mkdir(bridgeDir, { recursive: true });
  return {
    bridgeDir,
    probePath
  };
}

async function verifyUiLaunch(targetRoot, label, outputRoot, expectedLifecycle, sharedBridge) {
  if (process.platform !== "darwin") {
    return {
      step: {
        label: `ui-${label}`,
        skipped: true
      },
      probePath: null,
      screenshotPath: null
    };
  }

  const bridgeDir = sharedBridge?.bridgeDir ?? path.join(outputRoot, `bridge-${label}`);
  const probePath = sharedBridge?.probePath ?? path.join(bridgeDir, `render-probe-${label}.json`);
  await fs.mkdir(bridgeDir, { recursive: true });
  const result = runProcess(process.execPath, [cliEntrypoint, "ui", "--target", targetRoot], {
    cwd: repoRoot,
    allowFailure: false,
    env: {
      ...process.env,
      KIWI_CONTROL_DESKTOP_BRIDGE_DIR: bridgeDir,
      KIWI_CONTROL_DESKTOP: desktopExecutable,
      KIWI_CONTROL_RENDER_PROBE_FILE: probePath,
      KIWI_CONTROL_RENDER_PROBE_VIEW: "overview"
    }
  });
  await writeStepOutputs(outputRoot, `ui-${label}`, result);
  const probe = await waitForProbe(
    probePath,
    (payload) =>
      payload?.targetRoot === targetRoot
      && payload?.executionState === expectedLifecycle
      && payload?.mounted === true
      && payload?.bootVisible === false
  );
  assert.equal(probe.targetRoot, targetRoot);
  assert.equal(probe.executionState, expectedLifecycle);
  await fs.writeFile(path.join(outputRoot, `render-probe-${label}.json`), `${JSON.stringify(probe, null, 2)}\n`, "utf8");

  const screenshotPath = await captureScreenshot(path.join(outputRoot, `ui-${label}.png`));
  return {
    step: {
      label: `ui-${label}`,
      args: ["ui", "--target", targetRoot],
      exitCode: result.code,
      stdoutPath: path.join(outputRoot, `ui-${label}.stdout.txt`),
      stderrPath: path.join(outputRoot, `ui-${label}.stderr.txt`),
      probePath,
      screenshotPath
    },
    probePath,
    screenshotPath
  };
}

async function waitForUiState(targetRoot, label, outputRoot, expectedLifecycle, sharedBridge) {
  if (process.platform !== "darwin") {
    return {
      step: {
        label: `ui-${label}`,
        skipped: true
      },
      probePath: null,
      screenshotPath: null
    };
  }

  const probePath = sharedBridge?.probePath ?? path.join(outputRoot, `render-probe-${label}.json`);
  const probe = await waitForProbe(
    probePath,
    (payload) =>
      payload?.targetRoot === targetRoot
      && payload?.executionState === expectedLifecycle
      && payload?.mounted === true
      && payload?.bootVisible === false
  );
  await fs.writeFile(path.join(outputRoot, `render-probe-${label}.json`), `${JSON.stringify(probe, null, 2)}\n`, "utf8");

  const screenshotPath = await captureScreenshot(path.join(outputRoot, `ui-${label}.png`));
  return {
    step: {
      label: `ui-${label}`,
      args: ["render-probe", expectedLifecycle],
      exitCode: 0,
      stdoutPath: null,
      stderrPath: null,
      probePath: path.join(outputRoot, `render-probe-${label}.json`),
      screenshotPath
    },
    probePath: path.join(outputRoot, `render-probe-${label}.json`),
    screenshotPath
  };
}

function runProcess(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  const output = {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };

  if (!options.allowFailure && output.code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${output.stderr || output.stdout}`);
  }

  return output;
}

async function writeStepOutputs(outputRoot, label, result) {
  await fs.writeFile(path.join(outputRoot, `${label}.stdout.txt`), result.stdout, "utf8");
  await fs.writeFile(path.join(outputRoot, `${label}.stderr.txt`), result.stderr, "utf8");
}

async function waitForProbe(probePath, predicate) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const payload = JSON.parse(await fs.readFile(probePath, "utf8"));
      if (predicate(payload)) {
        return payload;
      }
    } catch {}
    await delay(200);
  }

  throw new Error(`Timed out waiting for render probe at ${probePath}`);
}

async function captureScreenshot(screenshotPath) {
  if (process.platform !== "darwin") {
    return null;
  }

  const result = spawnSync("screencapture", ["-x", screenshotPath], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return null;
  }
  return screenshotPath;
}

async function killExistingKiwiProcesses() {
  if (process.platform !== "darwin") {
    return;
  }

  for (const pattern of [
    "/Applications/Kiwi Control.app/Contents/MacOS/sj-ui",
    "/Volumes/shrey ssd/shrey-junior/apps/sj-ui/src-tauri/target/release/bundle/macos/Kiwi Control.app/Contents/MacOS/sj-ui",
    "kiwi-control-tauri-target/release/sj-ui"
  ]) {
    spawnSync("pkill", ["-f", pattern], { stdio: "ignore" });
  }

  await delay(400);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
