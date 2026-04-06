import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import { buildRepoControlState, loadWarmRepoControlSnapshot } from "@shrey-junior/sj-core/core/ui-state.js";
import { failWorkflowStep } from "@shrey-junior/sj-core/core/workflow-engine.js";
import { runSpecialists } from "../commands/specialists.js";
import {
  buildDesktopLaunchCandidates,
  buildDesktopUnavailableMessage,
  resolveDesktopLaunchLogPath,
  resolveDesktopLaunchRequestPath,
  resolveDesktopLaunchStatusPath,
  runUi
} from "../commands/ui.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

async function withIsolatedDesktopLaunchBridge<T>(
  callback: (paths: {
    bridgeDir: string;
    launchRequestPath: string;
    launchStatusPath: string;
    launchLogPath: string;
  }) => Promise<T>
): Promise<T> {
  const previousBridgeDir = process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR;
  const bridgeDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-control-bridge-test-"));
  process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR = bridgeDir;

  try {
    return await callback({
      bridgeDir,
      launchRequestPath: resolveDesktopLaunchRequestPath(),
      launchStatusPath: resolveDesktopLaunchStatusPath(),
      launchLogPath: resolveDesktopLaunchLogPath()
    });
  } finally {
    if (previousBridgeDir === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR = previousBridgeDir;
    }

    await fs.rm(bridgeDir, { recursive: true, force: true });
  }
}

test("specialists command exposes canonical specialist ids and curated MCP packs in json mode", async () => {
  const logs: string[] = [];
  const exitCode = await runSpecialists({
    repoRoot: repoRoot(),
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    specialists: Array<{ specialistId: string }>;
    mcpPacks: Array<{ id: string }>;
  };

  assert.equal(payload.specialists.some((entry) => entry.specialistId === "ios-specialist"), true);
  assert.equal(payload.specialists.some((entry) => entry.specialistId === "android-specialist"), true);
  assert.equal(payload.mcpPacks.some((entry) => entry.id === "web-qa-pack"), true);
});

test("ui command returns structured repo-control state in json mode", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-"));
  const target = path.join(tempDir, "portable-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "portable-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );
  await recordRuntimeProgress(target, {
    type: "prepare_completed",
    stage: "prepared",
    status: "ok",
    summary: "Prepared the repo for a bounded task.",
    task: "demo task",
    nextRecommendedAction: "Begin work in the prepared scope."
  });

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    repoState: { mode: string };
    repoOverview: Array<{ label: string }>;
    continuity: Array<{ label: string }>;
    memoryBank: Array<{ label: string; present: boolean }>;
    specialists: { recommendedSpecialist: string; activeSpecialist: string };
    mcpPacks: { suggestedPack: { id: string }; compatibleCapabilities: Array<{ id: string }>; note: string };
    validation: { ok: boolean };
    machineAdvisory: {
      generatedBy: string;
      windowDays: number;
      systemHealth: { criticalCount: number; warningCount: number; okCount: number };
      inventory: Array<{ name: string }>;
      mcpInventory: { claudeTotal: number; codexTotal: number; copilotTotal: number };
      optimizationLayers: Array<{ name: string }>;
      setupPhases: Array<{ phase: string }>;
      configHealth: Array<{ path: string }>;
      usage: { claude: { available: boolean }; codex: { available: boolean }; copilot: { available: boolean } };
      guidance: Array<{ priority: string; group: string; impact: string }>;
    };
    kiwiControl: {
      indexing: { coverageNote: string; discoveredFiles: number };
      fileAnalysis: { totalFiles: number; selected: Array<{ file: string; selectionWhy?: string; dependencyChain?: string[] }> };
      contextTrace: { expansionSteps: Array<{ step: string }> };
      tokenBreakdown: { categories: Array<{ category: string }> };
      decisionLogic: { reasoningChain: string[]; inputSignals: string[] };
      runtimeLifecycle: { currentStage: string; recentEvents: Array<{ type: string }> };
      measuredUsage: { available: boolean; workflows: Array<{ workflow: string }> };
      skills: { activeSkills: Array<{ skillId: string }>; suggestedSkills: Array<{ skillId: string }> };
      feedback: { basedOnPastRuns: boolean; reusedPattern: string | null; similarTasks: Array<{ task: string }> };
      workflow: { steps: Array<{ stepId: string }> };
      executionTrace: { steps: Array<{ stepId: string }>; whyThisHappened: string };
      executionPlan: {
        summary: string;
        state: string;
        blocked: boolean;
        steps: Array<{ command: string; validation: string }>;
        nextCommands: string[];
        lastError: {
          errorType: string;
          retryStrategy: string;
          reason: string;
          fixCommand: string;
          retryCommand: string;
        } | null;
        impactPreview: { likelyFiles: string[]; moduleGroups: string[] };
        verificationLayers: Array<{ id: string; description: string }>;
        partialResults: Array<{ stepId: string; summary: string }>;
      };
    };
  };

  assert.equal(payload.repoState.mode, "healthy");
  assert.equal(payload.repoOverview.some((entry) => entry.label === "Project type"), true);
  assert.equal(payload.continuity.some((entry) => entry.label === "Latest checkpoint"), true);
  assert.equal(payload.memoryBank.some((entry) => entry.label === "Repo Facts" && entry.present), true);
  assert.match(payload.specialists.recommendedSpecialist, /-specialist$/);
  assert.match(payload.specialists.activeSpecialist, /-specialist$/);
  assert.equal(typeof payload.mcpPacks.suggestedPack.id, "string");
  assert.equal(Array.isArray(payload.mcpPacks.compatibleCapabilities), true);
  assert.match(payload.mcpPacks.note, /MCP/i);
  assert.equal(payload.validation.ok, true);
  assert.equal(Array.isArray(payload.machineAdvisory.inventory), true);
  assert.equal(typeof payload.machineAdvisory.generatedBy, "string");
  assert.equal(typeof payload.machineAdvisory.windowDays, "number");
  assert.equal(typeof payload.machineAdvisory.systemHealth.criticalCount, "number");
  assert.equal(typeof payload.machineAdvisory.mcpInventory.claudeTotal, "number");
  assert.equal(Array.isArray(payload.machineAdvisory.optimizationLayers), true);
  assert.equal(Array.isArray(payload.machineAdvisory.setupPhases), true);
  assert.equal(Array.isArray(payload.machineAdvisory.configHealth), true);
  assert.equal(typeof payload.machineAdvisory.usage.claude.available, "boolean");
  assert.equal(Array.isArray(payload.machineAdvisory.guidance), true);
  assert.equal(typeof payload.kiwiControl.indexing.discoveredFiles, "number");
  assert.equal(typeof payload.kiwiControl.indexing.coverageNote, "string");
  assert.equal(typeof payload.kiwiControl.fileAnalysis.totalFiles, "number");
  assert.equal(Array.isArray(payload.kiwiControl.fileAnalysis.selected), true);
  assert.equal(
    payload.kiwiControl.fileAnalysis.selected.every((entry) => typeof entry.file === "string"),
    true
  );
  assert.equal(Array.isArray(payload.kiwiControl.contextTrace.expansionSteps), true);
  assert.equal(Array.isArray(payload.kiwiControl.tokenBreakdown.categories), true);
  assert.equal(Array.isArray(payload.kiwiControl.decisionLogic.reasoningChain), true);
  assert.equal(Array.isArray(payload.kiwiControl.decisionLogic.inputSignals), true);
  assert.equal(typeof payload.kiwiControl.runtimeLifecycle.currentStage, "string");
  assert.equal(Array.isArray(payload.kiwiControl.runtimeLifecycle.recentEvents), true);
  assert.equal(typeof payload.kiwiControl.measuredUsage.available, "boolean");
  assert.equal(Array.isArray(payload.kiwiControl.measuredUsage.workflows), true);
  assert.equal(Array.isArray(payload.kiwiControl.skills.activeSkills), true);
  assert.equal(Array.isArray(payload.kiwiControl.skills.suggestedSkills), true);
  assert.equal(typeof payload.kiwiControl.feedback.basedOnPastRuns, "boolean");
  assert.equal(Array.isArray(payload.kiwiControl.feedback.similarTasks), true);
  assert.equal(Array.isArray(payload.kiwiControl.workflow.steps), true);
  assert.equal(Array.isArray(payload.kiwiControl.executionTrace.steps), true);
  assert.equal(typeof payload.kiwiControl.executionTrace.whyThisHappened, "string");
  assert.equal(typeof payload.kiwiControl.executionPlan.blocked, "boolean");
  assert.equal(typeof payload.kiwiControl.executionPlan.summary, "string");
  assert.equal(typeof payload.kiwiControl.executionPlan.state, "string");
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.steps), true);
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.nextCommands), true);
  assert.equal(
    payload.kiwiControl.executionPlan.lastError === null || typeof payload.kiwiControl.executionPlan.lastError.reason === "string",
    true
  );
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.impactPreview.likelyFiles), true);
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.verificationLayers), true);
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.partialResults), true);
});

test("ui command exposes blocked execution-plan details in json mode when workflow execution is blocked", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-blocked-plan-"));
  const target = path.join(tempDir, "blocked-plan-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "blocked-plan-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  await failWorkflowStep(target, {
    task: "stabilize product surface launch semantics",
    stepId: "generate-run-packets",
    failureReason: "Run packets could not be generated for the current repo guidance state.",
    validation: "Generate run packets before execution can continue."
  });

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    kiwiControl: {
      executionPlan: {
        summary: string;
        state: string;
        blocked: boolean;
        currentStepIndex: number;
        steps: Array<{ id: string; status: string; command: string; validation: string }>;
        nextCommands: string[];
        lastError: {
          errorType: string;
          retryStrategy: string;
          reason: string;
          fixCommand: string;
          retryCommand: string;
        } | null;
        verificationLayers: Array<{ id: string; description: string }>;
        partialResults: Array<{ stepId: string; summary: string }>;
      };
    };
  };

  assert.equal(payload.kiwiControl.executionPlan.state, "blocked");
  assert.equal(payload.kiwiControl.executionPlan.blocked, true);
  assert.equal(payload.kiwiControl.executionPlan.currentStepIndex >= 0, true);
  assert.equal(
    payload.kiwiControl.executionPlan.steps.some((step) => step.id === "execute" && step.status === "failed"),
    true
  );
  assert.equal(payload.kiwiControl.executionPlan.nextCommands.length > 0, true);
  assert.equal(payload.kiwiControl.executionPlan.lastError?.errorType, "context_error");
  assert.equal(payload.kiwiControl.executionPlan.lastError?.retryStrategy, "expand");
  assert.match(payload.kiwiControl.executionPlan.lastError?.reason ?? "", /Run packets could not be generated/);
  assert.equal(typeof payload.kiwiControl.executionPlan.lastError?.fixCommand, "string");
  assert.equal(typeof payload.kiwiControl.executionPlan.lastError?.retryCommand, "string");
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.verificationLayers), true);
  assert.equal(Array.isArray(payload.kiwiControl.executionPlan.partialResults), true);
});

test("repo control state persists a warm snapshot and reuses it on warm open", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-snapshot-"));
  const target = path.join(tempDir, "snapshot-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "snapshot-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  const freshState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    machineAdvisoryOptions: { fastMode: true }
  });
  assert.equal(freshState.loadState.source, "fresh");

  const warmSnapshot = await loadWarmRepoControlSnapshot(target);
  assert.ok(warmSnapshot);
  assert.equal(warmSnapshot?.loadState.source, "warm-snapshot");
  assert.equal(warmSnapshot?.loadState.freshness, "warm");
  assert.equal(warmSnapshot?.targetRoot, target);
  assert.equal(typeof warmSnapshot?.loadState.snapshotAgeMs, "number");

  const warmState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    preferSnapshot: true,
    machineAdvisoryOptions: { fastMode: true }
  });
  assert.equal(warmState.loadState.source, "warm-snapshot");
});

test("repo control snapshot becomes degraded when only an older warm state is available", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-stale-snapshot-"));
  const target = path.join(tempDir, "stale-snapshot-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "stale-snapshot-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    machineAdvisoryOptions: { fastMode: true }
  });

  const snapshotPath = path.join(target, ".agent", "state", "repo-control-snapshot.json");
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8")) as {
    savedAt: string;
  };
  snapshot.savedAt = new Date(Date.now() - (5 * 60 * 1000)).toISOString();
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  const staleSnapshot = await loadWarmRepoControlSnapshot(target);
  assert.ok(staleSnapshot);
  assert.equal(staleSnapshot?.loadState.source, "stale-snapshot");
  assert.equal(staleSnapshot?.loadState.freshness, "stale");
  assert.equal((staleSnapshot?.loadState.snapshotAgeMs ?? 0) > 120_000, true);
});

test("ui command reports repo-not-initialized for an uninitialized generic repo while still returning json", async () => {
  const repoRootPath = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-empty-"));
  const target = path.join(tempDir, "empty-repo");
  await fs.mkdir(target, { recursive: true });

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    repoState: { mode: string; detail: string };
    validation: { warnings: number };
  };

  assert.equal(payload.repoState.mode, "repo-not-initialized");
  assert.match(payload.repoState.detail, /kiwi-control init in this folder/);
  assert.equal(payload.validation.warnings > 0, true);
});

test("ui command reports initialized-invalid for drifted repo-local state while still returning json", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-invalid-"));
  const target = path.join(tempDir, "invalid-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "invalid-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  await fs.rm(path.join(target, ".agent", "memory", "repo-facts.json"), { force: true });

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    repoState: { mode: string; detail: string; sourceOfTruthNote: string };
    validation: { errors: number };
    specialists: { recommendedSpecialist: string; safeParallelHint: string };
  };

  assert.equal(payload.repoState.mode, "initialized-invalid");
  assert.match(payload.repoState.detail, /kiwi-control check in this folder/);
  assert.match(payload.repoState.sourceOfTruthNote, /source of truth/i);
  assert.equal(payload.validation.errors > 0, true);
  assert.equal(payload.specialists.recommendedSpecialist, "review-specialist");
  assert.match(payload.specialists.safeParallelHint, /Repair the repo-local contract first/i);
});

test("ui command waits for a matching ready status before reporting desktop launch success", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-launcher-"));
  const markerPath = path.join(tempDir, "launched.txt");
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const requestPath = ${JSON.stringify(launchRequestPath)};
const statusPath = ${JSON.stringify(launchStatusPath)};
const request = JSON.parse(readFileSync(requestPath, "utf8"));
writeFileSync(${JSON.stringify(markerPath)}, \`\${request.targetRoot}\\n\`, "utf8");
writeFileSync(statusPath, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "ready",
  detail: "visible window shown",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn() {},
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const marker = await fs.readFile(markerPath, "utf8");
          assert.match(marker, /launched/);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const finalMarker = await fs.readFile(markerPath, "utf8");
      const logPayload = await readLaunchLogEntries(launchLogPath);
      assert.equal(exitCode, 0);
      assert.equal(finalMarker.trim(), tempDir);
      assert.match(logs.join("\n"), new RegExp(`Opened Kiwi Control via .* for ${tempDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(logs.join("\n"), /Launch source: fallback-launcher/);
      assert.equal(logPayload.some((entry) => entry.event === "launch-ready" && entry.launchSource === "fallback-launcher"), true);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command returns promptly even when the launcher process remains alive after writing ready status", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-persistent-launcher-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  const pidPath = path.join(tempDir, "launcher.pid");

  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
writeFileSync(${JSON.stringify(pidPath)}, String(process.pid), "utf8");
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "ready",
  detail: "persistent launcher ready",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");
setInterval(() => {}, 1_000);`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const launchPromise = runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info() {},
          warn() {},
          error() {}
        } as never
      });

      const exitCode = await Promise.race([
        launchPromise,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 4_000))
      ]);

      assert.notEqual(exitCode, "timeout");
      assert.equal(exitCode, 0);
    } finally {
      try {
        const pid = Number.parseInt((await fs.readFile(pidPath, "utf8")).trim(), 10);
        if (Number.isFinite(pid)) {
          process.kill(pid, "SIGTERM");
        }
      } catch {}

      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command refreshes the desktop launch request for repeated repo opens", async () => {
  const firstTarget = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-first-"));
  const secondTarget = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-second-"));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-repeat-"));
  const markerPath = path.join(tempDir, "launches.txt");
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });
    await fs.writeFile(
      launcherPath,
      `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
appendFileSync(${JSON.stringify(markerPath)}, \`\${request.requestId}|\${request.targetRoot}\\n\`, "utf8");
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "ready",
  detail: "retargeted window",
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logger = {
        info() {},
        warn() {},
        error() {}
      } as never;

      await runUi({
        repoRoot: repoRoot(),
        targetRoot: firstTarget,
        logger
      });

      await waitForMarkerLines(markerPath, 1);

      await runUi({
        repoRoot: repoRoot(),
        targetRoot: secondTarget,
        logger
      });

      await waitForMarkerLines(markerPath, 2);

      const launchLines = (await fs.readFile(markerPath, "utf8")).trim().split("\n");
      const [firstLaunch, secondLaunch] = launchLines.map((line) => {
        const [requestId, targetRoot] = line.split("|");
        return { requestId, targetRoot };
      });

      assert.ok(firstLaunch);
      assert.ok(secondLaunch);
      assert.equal(firstLaunch.targetRoot, firstTarget);
      assert.equal(secondLaunch.targetRoot, secondTarget);
      assert.notEqual(firstLaunch.requestId, secondLaunch.requestId);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command ignores stale launch status entries until the matching request id reports ready", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-stale-status-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: "stale-request-id",
  targetRoot: "stale-target",
  state: "ready",
  detail: "stale ready status should be ignored",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");
setTimeout(() => {
  writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
    requestId: request.requestId,
    targetRoot: request.targetRoot,
    state: "ready",
    detail: "matching ready status",
    launchSource: request.launchSource,
    reportedAt: new Date().toISOString()
  }, null, 2), "utf8");
}, 250);`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);

      assert.equal(exitCode, 0);
      assert.equal(
        logPayload.some((entry) => entry.event === "launch-ready" && entry.detail === "matching ready status"),
        true
      );
      assert.equal(
        logPayload.some((entry) => entry.event === "launch-ready" && entry.detail === "stale ready status should be ignored"),
        false
      );
      assert.match(logs.join("\n"), /The app is visible and loading this repo now/i);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command prefers the local source bundle before installed app bundles when running from a source checkout", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-source-bundle-"));
  const sourceRepo = path.join(tempDir, "repo");
  const bundlePath =
    process.platform === "darwin"
      ? path.join(sourceRepo, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app")
      : null;
  const bundleExecutablePath =
    process.platform === "darwin" && bundlePath
      ? path.join(bundlePath, "Contents", "MacOS", "Kiwi Control")
      : null;

  await fs.mkdir(path.join(sourceRepo, "configs"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "scripts"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "apps", "sj-ui"), { recursive: true });
  await fs.writeFile(path.join(sourceRepo, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "scripts", "run-ui-dev.mjs"), "", "utf8");
  await fs.writeFile(path.join(sourceRepo, "apps", "sj-ui", "package.json"), "{}\n", "utf8");

  if (bundleExecutablePath) {
    await fs.mkdir(path.dirname(bundleExecutablePath), { recursive: true });
    await fs.writeFile(bundleExecutablePath, "", "utf8");
  }

  const previousCwd = process.cwd();
  const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
  const previousLegacyDesktopLauncher = process.env.SHREY_JUNIOR_DESKTOP;
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;
  process.chdir(sourceRepo);

  try {
    const candidates = buildDesktopLaunchCandidates(sourceRepo);

    if (process.platform === "darwin") {
      assert.deepEqual(candidates[0], {
        command: bundleExecutablePath,
        args: [],
        launchSource: "source-bundle"
      });
      assert.deepEqual(candidates[1], {
        command: "open",
        args: [bundlePath],
        launchSource: "source-bundle"
      });
      assert.deepEqual(candidates[2], {
        command: "open",
        args: ["/Applications/Kiwi Control.app"],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[3], {
        command: "open",
        args: [path.join(os.homedir(), "Applications", "Kiwi Control.app")],
        launchSource: "installed-bundle"
      });
    } else {
      assert.equal(candidates.some((candidate) => candidate.args.includes("Kiwi Control.app")), false);
    }
  } finally {
    process.chdir(previousCwd);
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
    if (previousLegacyDesktopLauncher === undefined) {
      delete process.env.SHREY_JUNIOR_DESKTOP;
    } else {
      process.env.SHREY_JUNIOR_DESKTOP = previousLegacyDesktopLauncher;
    }
  }
});

test("ui command still offers installed app bundles after the current workspace source bundle", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-source-cwd-bundle-"));
  const sourceRepo = path.join(tempDir, "repo");
  const installedRoot = path.join(tempDir, "installed-cli-root");
  const bundlePath =
    process.platform === "darwin"
      ? path.join(sourceRepo, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app")
      : null;
  const bundleExecutablePath =
    process.platform === "darwin" && bundlePath
      ? path.join(bundlePath, "Contents", "MacOS", "Kiwi Control")
      : null;

  await fs.mkdir(path.join(sourceRepo, "configs"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "scripts"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "apps", "sj-ui"), { recursive: true });
  await fs.writeFile(path.join(sourceRepo, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "scripts", "run-ui-dev.mjs"), "", "utf8");
  await fs.writeFile(path.join(sourceRepo, "apps", "sj-ui", "package.json"), "{}\n", "utf8");

  await fs.mkdir(path.join(installedRoot, "configs"), { recursive: true });
  await fs.writeFile(path.join(installedRoot, "configs", "global.yaml"), "version: 2\n", "utf8");

  if (bundleExecutablePath) {
    await fs.mkdir(path.dirname(bundleExecutablePath), { recursive: true });
    await fs.writeFile(bundleExecutablePath, "", "utf8");
  }

  const previousCwd = process.cwd();
  const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
  const previousLegacyDesktopLauncher = process.env.SHREY_JUNIOR_DESKTOP;
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;
  process.chdir(sourceRepo);

  try {
    const candidates = buildDesktopLaunchCandidates(installedRoot, path.join(tempDir, "target-repo"));

    if (process.platform === "darwin") {
      assert.equal(candidates[0]?.args.length, 0);
      assert.equal(candidates[0]?.launchSource, "source-bundle");
      assert.equal(await fs.realpath(candidates[0]?.command ?? ""), await fs.realpath(bundleExecutablePath ?? ""));
      assert.equal(candidates[1]?.command, "open");
      assert.equal(candidates[1]?.args.length, 1);
      assert.equal(candidates[1]?.launchSource, "source-bundle");
      assert.equal(await fs.realpath(candidates[1]?.args[0] ?? ""), await fs.realpath(bundlePath ?? ""));
      assert.deepEqual(candidates[2], {
        command: "open",
        args: ["/Applications/Kiwi Control.app"],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[3], {
        command: "open",
        args: [path.join(os.homedir(), "Applications", "Kiwi Control.app")],
        launchSource: "installed-bundle"
      });
    } else {
      assert.equal(candidates.some((candidate) => candidate.args.includes("Kiwi Control.app")), false);
    }
  } finally {
    process.chdir(previousCwd);
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
    if (previousLegacyDesktopLauncher === undefined) {
      delete process.env.SHREY_JUNIOR_DESKTOP;
    } else {
      process.env.SHREY_JUNIOR_DESKTOP = previousLegacyDesktopLauncher;
    }
  }
});

test("ui command prefers installed app bundles when no source checkout bundle is available", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-installed-bundles-"));
  const installedRoot = path.join(tempDir, "installed-cli-root");
  const previousCwd = process.cwd();

  await fs.mkdir(path.join(installedRoot, "configs"), { recursive: true });
  await fs.writeFile(path.join(installedRoot, "configs", "global.yaml"), "version: 2\n", "utf8");

  process.chdir(tempDir);

  try {
    const candidates = buildDesktopLaunchCandidates(installedRoot, path.join(tempDir, "target-repo"));

    if (process.platform === "darwin") {
      assert.deepEqual(candidates[0], {
        command: "open",
        args: ["/Applications/Kiwi Control.app"],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[1], {
        command: "open",
        args: [path.join(os.homedir(), "Applications", "Kiwi Control.app")],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[2], {
        command: "open",
        args: ["-a", "Kiwi Control"],
        launchSource: "fallback-launcher"
      });
    }
  } finally {
    process.chdir(previousCwd);
  }
});

test("ui command reports hydrating success when the desktop has observed the request but has not written ready status yet", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-hydrating-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { appendFileSync, readFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
appendFileSync(${JSON.stringify(launchLogPath)}, JSON.stringify({
  event: "desktop-request-observed",
  reportedAt: new Date().toISOString(),
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  detail: "observed by desktop",
  launchSource: request.launchSource
}) + "\\n", "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);
      assert.equal(exitCode, 0);
      assert.equal(logPayload.some((entry) => entry.event === "launch-hydrating"), true);
      assert.equal(logPayload.some((entry) => entry.event === "launch-hydrating" && entry.launchSource === "fallback-launcher"), true);
      assert.match(logs.join("\n"), /repo is still hydrating/i);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command surfaces explicit desktop launch error statuses as command failures", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-launch-error-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "error",
  detail: "Desktop failed to hydrate the repo state.",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);

      assert.equal(exitCode, 1);
      assert.equal(
        logPayload.some((entry) => entry.event === "launch-error" && entry.detail === "Desktop failed to hydrate the repo state."),
        true
      );
      await assert.rejects(fs.access(launchRequestPath));
      assert.match(logs.join("\n"), /Desktop failed to hydrate the repo state/);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("desktop unavailable messaging distinguishes contributor checkouts from installed CLI usage", async () => {
  const contributorMessage = buildDesktopUnavailableMessage(repoRoot());
  const installedMessage = buildDesktopUnavailableMessage(path.join(os.tmpdir(), "kiwi-control-installed-cli"));

  assert.match(contributorMessage, /npm run ui:dev/);
  assert.match(installedMessage, /Install the matching Kiwi Control desktop bundle from the GitHub Release/);
});

test("ui command reports a pending desktop hydration state instead of failing when the app is still opening", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-timeout-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync } from "node:fs";
readFileSync(${JSON.stringify(launchRequestPath)}, "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);

      assert.equal(exitCode, 0);
      assert.equal(logPayload.some((entry) => entry.event === "launch-pending"), true);
      assert.match(logs.join("\n"), /repo hydration is still in progress/i);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command treats a launcher that exits non-zero immediately as unavailable instead of timing out", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-exit-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `process.stderr.write("desktop missing\\n");
process.exit(1);`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: path.join(os.tmpdir(), "kiwi-control-installed-cli"),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);

      assert.equal(exitCode, 1);
      assert.equal(logPayload.some((entry) => entry.event === "launch-attempt-failed" && /desktop missing/.test(entry.detail ?? "")), true);
      assert.match(logs.join("\n"), /Install the matching Kiwi Control desktop bundle from the GitHub Release/);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

async function waitForMarkerLines(markerPath: string, expectedLineCount: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const contents = await fs.readFile(markerPath, "utf8");
      const lines = contents.trim().split("\n").filter(Boolean);
      if (lines.length >= expectedLineCount) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.fail(`Timed out waiting for ${expectedLineCount} launch marker lines in ${markerPath}`);
}

async function readLaunchLogEntries(logPath: string): Promise<Array<{ event: string; detail?: string; launchSource?: string }>> {
  const payload = await fs.readFile(logPath, "utf8");
  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event: string; detail?: string; launchSource?: string });
}
