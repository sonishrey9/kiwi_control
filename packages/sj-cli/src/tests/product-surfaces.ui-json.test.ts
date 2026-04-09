import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import {
  buildRuntimeDecision,
  buildRuntimeDecisionAction,
  buildRuntimeDecisionRecovery
} from "@shrey-junior/sj-core/core/runtime-decision.js";
import { buildRepoControlState, loadWarmRepoControlSnapshot } from "@shrey-junior/sj-core/core/ui-state.js";
import { runSpecialists } from "../commands/specialists.js";
import { runUi } from "../commands/ui.js";
import { repoRoot } from "./helpers/desktop-launch.js";

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
  await recordExecutionState(target, {
    type: "prepare-completed",
    lifecycle: "packet-created",
    task: "demo task",
    sourceCommand: 'kiwi-control prepare "demo task"',
    reason: "Prepared the repo for a bounded task.",
    nextCommand: 'kiwi-control run "demo task"',
    decision: buildRuntimeDecision({
      currentStepId: "generate_packets",
      currentStepStatus: "pending",
      nextCommand: 'kiwi-control run "demo task"',
      readinessLabel: "Packet created",
      readinessTone: "ready",
      readinessDetail: "Prepared the repo for a bounded task.",
      nextAction: buildRuntimeDecisionAction(
        "Generate run packets",
        'kiwi-control run "demo task"',
        "Prepared the repo for a bounded task.",
        "high"
      ),
      decisionSource: "test-seed"
    })
  });
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
    executionState: { revision: number; lifecycle: string; nextCommand: string | null };
    readiness: { label: string; detail: string; nextCommand: string | null };
    runtimeIdentity: {
      launchMode: string;
      callerSurface: string;
      packagingSourceCategory: string;
      binaryPath: string;
      binarySha256: string;
    } | null;
    derivedFreshness: Array<{ outputName: string; freshness: string }>;
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
      repoIntelligence: {
        available: boolean;
        repoMapPath: string | null;
        symbolIndexPath: string | null;
        dependencyGraphPath: string | null;
        impactMapPath: string | null;
        compactContextPackAvailable: boolean;
        compactContextPackPath: string | null;
        compactContextPackMode: string | null;
        compactContextPackTask: string | null;
        compactContextPackSummary: string | null;
        compactContextPackFiles: number;
        entryPoints: string[];
      };
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
  assert.equal(typeof payload.executionState.revision, "number");
  assert.equal(payload.executionState.lifecycle, "packet-created");
  assert.equal(typeof payload.readiness.label, "string");
  assert.equal(typeof payload.runtimeIdentity?.callerSurface, "string");
  assert.equal(typeof payload.runtimeIdentity?.binaryPath, "string");
  assert.equal(typeof payload.runtimeIdentity?.binarySha256, "string");
  assert.equal(Array.isArray(payload.derivedFreshness), true);
  assert.equal(payload.derivedFreshness.some((entry) => entry.outputName === "execution-state"), true);
  assert.equal(payload.derivedFreshness.some((entry) => entry.outputName === "execution-events"), true);
  assert.equal(payload.derivedFreshness.some((entry) => entry.outputName === "execution-plan"), false);
  assert.equal(payload.derivedFreshness.some((entry) => entry.outputName === "repo-control-snapshot"), false);
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
  assert.equal(typeof payload.kiwiControl.repoIntelligence.available, "boolean");
  assert.equal(payload.kiwiControl.repoIntelligence.available, true);
  assert.equal(payload.kiwiControl.repoIntelligence.repoMapPath, ".agent/context/repo-map.json");
  assert.equal(payload.kiwiControl.repoIntelligence.symbolIndexPath, ".agent/state/symbol-index.json");
  assert.equal(payload.kiwiControl.repoIntelligence.dependencyGraphPath, ".agent/state/dependency-graph.json");
  assert.equal(payload.kiwiControl.repoIntelligence.impactMapPath, ".agent/state/impact-map.json");
  assert.equal(payload.kiwiControl.repoIntelligence.compactContextPackAvailable, true);
  assert.equal(payload.kiwiControl.repoIntelligence.compactContextPackPath, ".agent/context/compact-context-pack.json");
  assert.match(payload.kiwiControl.repoIntelligence.compactContextPackMode ?? "", /overview|focus|changed/);
  assert.equal(typeof payload.kiwiControl.repoIntelligence.compactContextPackSummary, "string");
  assert.equal(typeof payload.kiwiControl.repoIntelligence.compactContextPackFiles, "number");
  assert.equal(Array.isArray(payload.kiwiControl.repoIntelligence.entryPoints), true);
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

  for (const relativePath of [
    ".agent/state/decision-logic.json",
    ".agent/state/execution-plan.json"
  ]) {
    await fs.access(path.join(target, relativePath));
  }
  await assert.rejects(fs.access(path.join(target, ".agent/state/repo-control-snapshot.json")));
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
  await recordExecutionState(target, {
    type: "run-packet-generation-failed",
    lifecycle: "blocked",
    task: "stabilize product surface launch semantics",
    sourceCommand: 'kiwi-control run "stabilize product surface launch semantics"',
    reason: "Run packets could not be generated for the current repo guidance state.",
    nextCommand: 'kiwi-control prepare "stabilize product surface launch semantics"',
    blockedBy: ["Run packets could not be generated for the current repo guidance state."],
    decision: buildRuntimeDecision({
      currentStepId: "generate_packets",
      currentStepStatus: "failed",
      nextCommand: 'kiwi-control prepare "stabilize product surface launch semantics"',
      readinessLabel: "Workflow blocked",
      readinessTone: "blocked",
      readinessDetail: "Run packets could not be generated for the current repo guidance state.",
      nextAction: buildRuntimeDecisionAction(
        "Refresh the prepared scope",
        'kiwi-control prepare "stabilize product surface launch semantics"',
        "Run packets could not be generated for the current repo guidance state.",
        "critical"
      ),
      recovery: buildRuntimeDecisionRecovery(
        "blocked",
        "Run packets could not be generated for the current repo guidance state.",
        'kiwi-control prepare "stabilize product surface launch semantics"',
        'kiwi-control run "stabilize product surface launch semantics"'
      ),
      decisionSource: "test-seed"
    })
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
    executionState: { lifecycle: string; nextCommand: string | null };
    readiness: { label: string; detail: string };
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

  assert.equal(payload.executionState.lifecycle, "blocked");
  assert.match(payload.readiness.label, /blocked/i);
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
