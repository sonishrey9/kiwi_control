import path from "node:path";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { bootstrapTarget, prepareBootstrapContext, syncRepoAwareBootstrapArtifacts } from "@shrey-junior/sj-core/core/bootstrap.js";
import { initOrSyncTarget } from "@shrey-junior/sj-core/core/executor.js";
import { buildBootstrapNextSuggestedCommand } from "@shrey-junior/sj-core/core/guidance.js";
import { buildRuntimeDecision, buildRuntimeDecisionAction } from "@shrey-junior/sj-core/core/runtime-decision.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { applyMachineSetupAction, type MachineSetupActionResult } from "@shrey-junior/sj-core/integrations/machine-setup-actions.js";
import { buildMachineSetupState, resolveProfileStepIds, type MachineSetupActionId, type MachineSetupProfile } from "@shrey-junior/sj-core/integrations/machine-setup.js";
import { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { pathExists } from "@shrey-junior/sj-core/utils/fs.js";
import type { Logger as LoggerShape } from "@shrey-junior/sj-core/core/logger.js";
import { syncPackSelectionSideEffects } from "./helpers/pack-selection.js";
import { runGraph } from "./graph.js";

export interface SetupOptions {
  repoRoot: string;
  targetRoot: string;
  subcommand?: "status" | "verify" | "doctor" | "repair" | "install" | "init";
  subject?: string;
  profile?: string;
  json?: boolean;
  dryRun?: boolean;
  logger: LoggerShape;
}

const NOOP_LOGGER = new Logger(false);

export async function runSetup(options: SetupOptions): Promise<number> {
  const profile = normalizeProfile(options.profile);
  const mode = options.subcommand ?? (profile ? "init" : "status");
  const state = await buildMachineSetupState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(profile ? { profile } : {})
  });

  if (mode === "status") {
    return emitStatus(options, state);
  }
  if (mode === "verify") {
    return emitVerify(options, state);
  }
  if (mode === "doctor") {
    return emitDoctor(options, state);
  }

  const actionIds = mode === "init"
    ? [
        ...resolveProfileStepIds(profile ?? "full-dev-machine"),
        ...((profile ?? "full-dev-machine") === "full-dev-machine"
          ? state.steps
              .filter((entry) => ["lean-ctx", "repomix"].includes(entry.id) && entry.status === "actionable")
              .map((entry) => entry.id)
          : [])
      ]
    : resolveSubjectActionIds(mode, options.subject);

  if (actionIds.length === 0) {
    throw new Error(`setup ${mode} requires a supported tool or surface.`);
  }

  const stepResults: MachineSetupActionResult[] = [];
  for (const actionId of actionIds) {
    const result = await runSetupAction({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      actionId,
      ...(profile ? { profile } : {}),
      dryRun: options.dryRun === true
    });
    stepResults.push(result);
    if (!result.ok && actionId !== "lean-ctx" && actionId !== "repomix") {
      break;
    }
  }

  const finalState = await buildMachineSetupState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(profile ? { profile } : {})
  });
  const payload = {
    ok: stepResults.every((entry) => entry.ok),
    changed: stepResults.some((entry) => entry.changed),
    dryRun: options.dryRun === true,
    targetRoot: options.targetRoot,
    mode,
    profile: profile ?? (mode === "init" ? "full-dev-machine" : state.profile),
    initialState: state,
    finalState,
    stepResults,
    nextCommand: "kiwi-control setup verify --json"
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    for (const result of stepResults) {
      options.logger.info(`${result.actionId}: ${result.ok ? (result.dryRun ? "preview" : result.changed ? "changed" : "no-op") : "blocked"}`);
      if (result.note) {
        options.logger.info(`  note: ${result.note}`);
      }
      if (result.blockedReason) {
        options.logger.info(`  reason: ${result.blockedReason}`);
      }
      if (result.changedFiles.length > 0) {
        options.logger.info(`  changed files: ${result.changedFiles.join(", ")}`);
      }
    }
    options.logger.info(`next command: ${payload.nextCommand}`);
  }

  return payload.ok ? 0 : 1;
}

async function emitStatus(options: SetupOptions, state: Awaited<ReturnType<typeof buildMachineSetupState>>): Promise<number> {
  if (options.json) {
    options.logger.info(JSON.stringify(state, null, 2));
  } else {
    options.logger.info(`setup: ${state.summary.status}`);
    options.logger.info(state.summary.detail);
    options.logger.info(`profile: ${state.profile}`);
    options.logger.info(`ai-setup: ${state.aiSetup.detected ? state.aiSetup.path : "not detected"}`);
  }
  return 0;
}

async function emitVerify(options: SetupOptions, state: Awaited<ReturnType<typeof buildMachineSetupState>>): Promise<number> {
  const payload = {
    ok: state.summary.status === "ready",
    targetRoot: state.targetRoot,
    profile: state.profile,
    actionableRequiredCount: state.summary.actionableRequiredCount,
    blockedRequiredCount: state.summary.blockedRequiredCount,
    aiSetup: state.aiSetup,
    steps: state.steps
  };
  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    options.logger.info(`setup verify: ${payload.ok ? "ready" : "needs work"}`);
    options.logger.info(`${payload.actionableRequiredCount} required actionable step(s), ${payload.blockedRequiredCount} blocked step(s).`);
  }
  return payload.ok ? 0 : 1;
}

async function emitDoctor(options: SetupOptions, state: Awaited<ReturnType<typeof buildMachineSetupState>>): Promise<number> {
  const findings = state.steps
    .filter((entry) => entry.status === "actionable" || entry.status === "blocked")
    .map((entry) => ({
      level: entry.status === "blocked" ? "error" : "warn",
      actionId: entry.id,
      title: entry.title,
      detail: entry.detail,
      fixCommand: entry.recommendedCommand
    }));
  const payload = {
    ok: findings.length === 0,
    targetRoot: state.targetRoot,
    profile: state.profile,
    findings,
    nextCommand: findings[0]?.fixCommand ?? "kiwi-control setup status"
  };
  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else if (findings.length === 0) {
    options.logger.info("setup doctor: machine and repo setup look healthy");
  } else {
    for (const finding of findings) {
      options.logger.info(`${finding.level}: ${finding.title} — ${finding.detail}`);
      if (finding.fixCommand) {
        options.logger.info(`fix command: ${finding.fixCommand}`);
      }
    }
    options.logger.info(`next command: ${payload.nextCommand}`);
  }
  return payload.ok ? 0 : 1;
}

async function runSetupAction(options: {
  repoRoot: string;
  targetRoot: string;
  actionId: MachineSetupActionId;
  profile?: MachineSetupProfile;
  dryRun: boolean;
}): Promise<MachineSetupActionResult> {
  if (options.actionId === "repo-contract") {
    return applyRepoContractAction(options);
  }
  if (options.actionId === "repo-graph") {
    return applyRepoGraphAction(options);
  }
  return applyMachineSetupAction(options);
}

async function applyRepoContractAction(options: {
  repoRoot: string;
  targetRoot: string;
  actionId: MachineSetupActionId;
  profile?: MachineSetupProfile;
  dryRun: boolean;
}): Promise<MachineSetupActionResult> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const preState = await buildMachineSetupState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profile ? { profile: options.profile } : {})
  });

  if (!preState.repo.initialized) {
    const plan = await bootstrapTarget(
      {
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        dryRun: options.dryRun
      },
      config
    );
    if (plan.inspection.authorityOptOut) {
      return {
        ok: false,
        changed: false,
        dryRun: options.dryRun,
        actionId: "repo-contract",
        targetRoot: options.targetRoot,
        changedFiles: [],
        blockedReason: plan.inspection.authorityOptOut,
        stdout: "",
        stderr: "",
        note: "Repo authority requested repo-local-only behavior, so setup stood down."
      };
    }
    if (!options.dryRun) {
      await recordExecutionState(options.targetRoot, {
        type: "repo-init",
        lifecycle: "idle",
        sourceCommand: "kiwi-control setup init",
        reason: "Repo-local control surfaces were initialized through setup.",
        nextCommand: "kiwi-control status",
        clearTask: true,
        reuseOperation: false
      }).catch(() => null);
      await syncPackSelectionSideEffects({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot
      }).catch(() => null);
    }
    return {
      ok: !plan.results.some((result) => result.status === "conflict"),
      changed: plan.results.some((result) => result.status !== "unchanged"),
      dryRun: options.dryRun,
      actionId: "repo-contract",
      targetRoot: options.targetRoot,
      changedFiles: plan.results.filter((result) => result.status !== "unchanged").map((result) => result.path),
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: options.dryRun ? "Previewed repo initialization through the existing bootstrap flow." : "Applied repo initialization through the existing bootstrap flow."
    };
  }

  const prepared = await prepareBootstrapContext(
    {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot
    },
    config
  );
  if (prepared.inspection.authorityOptOut) {
    return {
      ok: false,
      changed: false,
      dryRun: options.dryRun,
      actionId: "repo-contract",
      targetRoot: options.targetRoot,
      changedFiles: [],
      blockedReason: prepared.inspection.authorityOptOut,
      stdout: "",
      stderr: "",
      note: "Repo authority requested repo-local-only behavior, so setup stood down."
    };
  }
  const contract = selectPortableContract(config, prepared.context);
  const results = await initOrSyncTarget(options.repoRoot, options.targetRoot, config, prepared.context, {
    dryRun: options.dryRun,
    diffSummary: options.dryRun,
    backup: false,
    backupLabel: prepared.context.generatedAt.replace(/[:.]/g, "-")
  });
  const repoAwareResults = options.dryRun
    ? []
    : await syncRepoAwareBootstrapArtifacts(options.targetRoot, {
        projectName: prepared.context.projectName,
        projectType: prepared.inspection.projectType,
        profileName: prepared.profileResolution.profileName,
        profileSource: prepared.profileResolution.source,
        activeRole: contract.activeRole,
        recommendedMcpPack: prepared.starterMcpHints[0] ?? "core-pack",
        nextRecommendedSpecialist: prepared.starterSpecialists[0] ?? contract.activeRole,
        nextSuggestedCommand: buildBootstrapNextSuggestedCommand(options.targetRoot)
      });
  if (!options.dryRun) {
    const nextCommand = buildBootstrapNextSuggestedCommand(options.targetRoot);
    await recordExecutionState(options.targetRoot, {
      type: "repo-sync",
      lifecycle: "idle",
      sourceCommand: "kiwi-control setup repair repo-contract",
      reason: "Repo-local control surfaces were synchronized through setup.",
      nextCommand,
      clearTask: true,
      reuseOperation: false,
      decision: buildRuntimeDecision({
        currentStepId: "idle",
        currentStepStatus: "pending",
        nextCommand,
        readinessLabel: "Ready",
        readinessTone: "ready",
        readinessDetail: "Repo-local control surfaces were synchronized through setup.",
        nextAction: buildRuntimeDecisionAction(
          "Inspect repo state",
          nextCommand,
          "Repo-local control surfaces were synchronized through setup.",
          "normal"
        ),
        decisionSource: "setup-command"
      })
    }).catch(() => null);
    await syncPackSelectionSideEffects({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot
    }).catch(() => null);
  }

  const allResults = [...results, ...repoAwareResults];
  return {
    ok: !allResults.some((result) => result.status === "conflict"),
    changed: allResults.some((result) => result.status !== "unchanged"),
    dryRun: options.dryRun,
    actionId: "repo-contract",
    targetRoot: options.targetRoot,
    changedFiles: allResults.filter((result) => result.status !== "unchanged").map((result) => result.path),
    blockedReason: null,
    stdout: "",
    stderr: "",
    note: options.dryRun ? "Previewed repo contract synchronization through the existing sync flow." : "Applied repo contract synchronization through the existing sync flow."
  };
}

async function applyRepoGraphAction(options: {
  repoRoot: string;
  targetRoot: string;
  actionId: MachineSetupActionId;
  profile?: MachineSetupProfile;
  dryRun: boolean;
}): Promise<MachineSetupActionResult> {
  const watchPaths = [
    path.join(options.targetRoot, ".agent", "context", "repo-map.json"),
    path.join(options.targetRoot, ".agent", "state", "symbol-index.json"),
    path.join(options.targetRoot, ".agent", "state", "dependency-graph.json"),
    path.join(options.targetRoot, ".agent", "state", "impact-map.json"),
    path.join(options.targetRoot, ".agent", "state", "decision-graph.json"),
    path.join(options.targetRoot, ".agent", "state", "history-graph.json"),
    path.join(options.targetRoot, ".agent", "state", "review-graph.json"),
    path.join(options.targetRoot, ".agent", "context", "agent-pack.json"),
    path.join(options.targetRoot, ".agent", "context", "task-pack.json"),
    path.join(options.targetRoot, ".agent", "context", "compact-context-pack.json"),
    path.join(options.targetRoot, ".agent", "context", "review-context-pack.json"),
    path.join(options.targetRoot, ".agent", "state", "runtime.sqlite3"),
    path.join(options.targetRoot, ".agent", "state", "ready-substrate.json")
  ];

  if (options.dryRun) {
    return {
      ok: true,
      changed: false,
      dryRun: true,
      actionId: "repo-graph",
      targetRoot: options.targetRoot,
      changedFiles: watchPaths,
      blockedReason: null,
      stdout: "",
      stderr: "",
      note: "Would refresh the runtime-backed repo graph and derived intelligence outputs."
    };
  }

  const before = await snapshotPaths(watchPaths);
  const exitCode = await runGraph({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    action: "build",
    logger: NOOP_LOGGER
  });
  const after = await snapshotPaths(watchPaths);
  const changedFiles = collectChangedPaths(before, after);
  return {
    ok: exitCode === 0,
    changed: changedFiles.length > 0,
    dryRun: false,
    actionId: "repo-graph",
    targetRoot: options.targetRoot,
    changedFiles,
    blockedReason: exitCode === 0 ? null : "Kiwi could not refresh the runtime-backed repo graph.",
    stdout: "",
    stderr: "",
    note: "Repo graph refresh reuses the existing runtime-backed graph build flow."
  };
}

function normalizeProfile(profile?: string): MachineSetupProfile | undefined {
  if (!profile) {
    return undefined;
  }
  if (["desktop-only", "desktop-plus-cli", "repo-only", "repair", "full-dev-machine"].includes(profile)) {
    return profile as MachineSetupProfile;
  }
  throw new Error(`unknown setup profile: ${profile}`);
}

function resolveSubjectActionIds(
  mode: "repair" | "install",
  subject: string | undefined
): MachineSetupActionId[] {
  const normalized = (subject ?? "").trim().toLowerCase();
  if (!normalized) {
    throw new Error(`setup ${mode} requires a supported tool or surface.`);
  }

  const repoContractAction: MachineSetupActionId = "repo-contract";
  const map: Record<string, MachineSetupActionId> = {
    "global-cli": "global-cli",
    cli: "global-cli",
    kc: "global-cli",
    "global-preferences": "global-preferences",
    preferences: "global-preferences",
    config: "global-preferences",
    "lean-ctx": "lean-ctx",
    repomix: "repomix",
    "repo-contract": repoContractAction,
    repo: repoContractAction,
    init: repoContractAction,
    "repo-assistant-wiring": "repo-assistant-wiring",
    omc: "repo-assistant-wiring",
    copilot: "repo-assistant-wiring",
    "repo-graph": "repo-graph",
    graph: "repo-graph",
    "code-review-graph": "repo-graph",
    "repo-hygiene": "repo-hygiene",
    gitignore: "repo-hygiene"
  };
  const actionId = map[normalized];
  if (!actionId) {
    throw new Error(`unsupported setup ${mode} target: ${subject}`);
  }
  if (mode === "install" && !["global-cli", "global-preferences"].includes(actionId)) {
    throw new Error(`setup install ${subject} is not supported directly. Use setup repair ${subject} instead.`);
  }
  return [actionId];
}

async function snapshotPaths(paths: string[]): Promise<Map<string, string>> {
  const snapshots = new Map<string, string>();
  for (const filePath of paths) {
    snapshots.set(filePath, await fingerprintPath(filePath));
  }
  return snapshots;
}

function collectChangedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const [filePath, next] of after.entries()) {
    if ((before.get(filePath) ?? "missing") !== next) {
      changed.push(filePath);
    }
  }
  return changed;
}

async function fingerprintPath(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "missing";
  }
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(filePath);
    return `dir:${entries.sort().join("|")}`;
  }
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}
