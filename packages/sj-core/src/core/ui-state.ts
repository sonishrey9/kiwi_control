import path from "node:path";
import type { LoadedConfig } from "./config.js";
import { loadCanonicalConfig } from "./config.js";
import { PRODUCT_METADATA } from "./product.js";
import { compileRepoContext } from "./context.js";
import { getMemoryPaths, loadOpenRisks } from "./memory.js";
import { inspectBootstrapTarget } from "./project-detect.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "./profiles.js";
import { getMcpPackDefinition, listMcpPacks, recommendMcpPack } from "./recommendations.js";
import { loadLatestReconcileReport } from "./reconcile.js";
import { listSpecialists, normalizeSpecialistId, recommendNextSpecialist } from "./specialists.js";
import { loadActiveRoleHints, loadContinuitySnapshot, loadLatestTaskPacketSet } from "./state.js";
import type { ValidationIssue } from "./validator.js";
import { validateControlPlane, validateTargetRepo } from "./validator.js";
import { pathExists, readJson, renderDisplayPath } from "../utils/fs.js";
import type { ContextSelectionState } from "./context-selector.js";
import type { TokenUsageState } from "./token-estimator.js";
import { inspectGitState } from "./git.js";
import { nextActionEngine } from "./next-action.js";
import type { NextAction } from "./next-action.js";
import { buildFeedbackSummary } from "./context-feedback.js";
import type { FeedbackSummary } from "./context-feedback.js";
import { buildExecutionSummary } from "./execution-log.js";
import type { ExecutionSummary } from "./execution-log.js";

export interface RepoControlPanelItem {
  label: string;
  value: string;
  tone?: "default" | "warn";
}

export interface RepoMemoryBankEntry {
  label: string;
  path: string;
  present: boolean;
}

export interface RepoValidationSummary {
  ok: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
}

export type RepoControlMode =
  | "bridge-unavailable"
  | "repo-not-initialized"
  | "initialized-invalid"
  | "initialized-with-warnings"
  | "healthy";

export interface RepoControlStatus {
  mode: RepoControlMode;
  title: string;
  detail: string;
  sourceOfTruthNote: string;
}

export interface KiwiControlContextView {
  task: string | null;
  selectedFiles: string[];
  excludedPatterns: string[];
  reason: string | null;
  confidence: string | null;
  keywordMatches: string[];
  timestamp: string | null;
}

export interface KiwiControlTokenAnalytics {
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  fileCountSelected: number;
  fileCountTotal: number;
  estimationMethod: string | null;
  topDirectories: Array<{ directory: string; tokens: number; fileCount: number }>;
  costEstimates: Array<{ model: string; selectedCost: string; fullRepoCost: string; savingsCost: string }>;
  task: string | null;
  timestamp: string | null;
}

export interface KiwiControlEfficiency {
  instructionsGenerated: boolean;
  instructionsPath: string | null;
}

export interface KiwiControlNextActions {
  actions: Array<{
    action: string;
    file: string | null;
    command: string | null;
    reason: string;
    priority: "critical" | "high" | "normal" | "low";
  }>;
  summary: string;
}

export interface KiwiControlFeedback {
  totalRuns: number;
  successRate: number;
  recentEntries: Array<{
    task: string;
    success: boolean;
    filesSelected: number;
    filesUsed: number;
    filesWasted: number;
    timestamp: string;
  }>;
  topBoostedFiles: Array<{ file: string; score: number }>;
  topPenalizedFiles: Array<{ file: string; score: number }>;
}

export interface KiwiControlExecution {
  totalExecutions: number;
  totalTokensUsed: number;
  averageTokensPerRun: number;
  successRate: number;
  recentExecutions: Array<{
    task: string;
    success: boolean;
    tokensUsed: number;
    filesTouched: number;
    tool: string | null;
    timestamp: string;
  }>;
  tokenTrend: "improving" | "stable" | "worsening" | "insufficient-data";
}

export interface KiwiControlWastedFiles {
  files: Array<{ file: string; tokens: number; reason: string }>;
  totalWastedTokens: number;
  removalSavingsPercent: number;
}

export interface KiwiControlHeavyDirectories {
  directories: Array<{
    directory: string;
    tokens: number;
    fileCount: number;
    percentOfRepo: number;
    suggestion: string;
  }>;
}

export interface KiwiControlState {
  contextView: KiwiControlContextView;
  tokenAnalytics: KiwiControlTokenAnalytics;
  efficiency: KiwiControlEfficiency;
  nextActions: KiwiControlNextActions;
  feedback: KiwiControlFeedback;
  execution: KiwiControlExecution;
  wastedFiles: KiwiControlWastedFiles;
  heavyDirectories: KiwiControlHeavyDirectories;
}

export interface RepoControlState {
  targetRoot: string;
  profileName: string;
  executionMode: string;
  projectType: string;
  repoState: RepoControlStatus;
  repoOverview: RepoControlPanelItem[];
  continuity: RepoControlPanelItem[];
  memoryBank: RepoMemoryBankEntry[];
  specialists: {
    recommendedSpecialist: string;
    available: ReturnType<typeof listSpecialists>;
    handoffTargets: string[];
    safeParallelHint: string;
  };
  mcpPacks: {
    suggestedPack: ReturnType<typeof getMcpPackDefinition>;
    available: ReturnType<typeof listMcpPacks>;
  };
  validation: RepoValidationSummary;
  kiwiControl: KiwiControlState;
}

export async function buildRepoControlState(options: {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
}): Promise<RepoControlState> {
  const config = await loadCanonicalConfig(options.repoRoot);
  return buildRepoControlStateFromConfig({
    config,
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {})
  });
}

export async function buildRepoControlStateFromConfig(options: {
  config: LoadedConfig;
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
}): Promise<RepoControlState> {
  const inspection = await inspectBootstrapTarget(options.targetRoot, options.config);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, options.config, options.profileName);
  const continuity = await loadContinuitySnapshot(options.targetRoot);
  const activeRoleHints = await loadActiveRoleHints(options.targetRoot);
  const executionMode = resolveExecutionMode(options.config, selection, overlay, continuity.latestPhase?.mode);
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config: options.config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: continuity.latestPhase?.routingSummary.taskType ?? options.config.global.defaults.default_task_type,
    fileArea: continuity.latestPhase?.routingSummary.fileArea ?? "application",
    changeSize: continuity.latestPhase?.routingSummary.changeSize ?? options.config.global.defaults.default_change_size,
    riskLevel: continuity.latestPhase?.routingSummary.riskLevel ?? "medium"
  });
  const recommendedSpecialist =
    normalizeSpecialistId(options.config, activeRoleHints?.nextRecommendedSpecialist) ??
    normalizeSpecialistId(options.config, continuity.currentFocus?.nextRecommendedSpecialist) ??
    recommendNextSpecialist({
      config: options.config,
      profileName: selection.profileName,
      taskType: compiledContext.taskType,
      fileArea: compiledContext.fileArea,
      projectType: inspection.projectType,
      ...(activeRoleHints?.activeRole ? { activeSpecialistId: activeRoleHints.activeRole } : {})
    }).specialistId;
  const suggestedPackId =
    activeRoleHints?.nextSuggestedMcpPack ??
    continuity.currentFocus?.nextSuggestedMcpPack ??
    recommendMcpPack({
      projectType: inspection.projectType,
      taskType: compiledContext.taskType,
      fileArea: compiledContext.fileArea,
      starterMcpHints: compiledContext.eligibleMcpServers,
      authorityFiles: compiledContext.authorityOrder
    });
  const suggestedPack = getMcpPackDefinition(suggestedPackId);
  const validationIssues = [
    ...(await validateControlPlane(options.repoRoot, options.config)),
    ...(await validateTargetRepo(options.targetRoot, options.config, selection))
  ];
  const openRisks = await loadOpenRisks(options.targetRoot);
  const latestTaskPacketSet = await loadLatestTaskPacketSet(options.targetRoot);
  const memoryPaths = getMemoryPaths(options.targetRoot);
  const memoryEntries: Array<[string, string]> = [
    ["Repo Facts", memoryPaths.repoFacts],
    ["Architecture Decisions", memoryPaths.architectureDecisions],
    ["Domain Glossary", memoryPaths.domainGlossary],
    ["Current Focus", memoryPaths.currentFocus],
    ["Open Risks", memoryPaths.openRisks],
    ["Known Gotchas", memoryPaths.knownGotchas],
    ["Last Successful Patterns", memoryPaths.lastSuccessfulPatterns]
  ];
  const memoryBank: RepoMemoryBankEntry[] = await Promise.all(
    memoryEntries.map(async ([label, filePath]) => ({
      label,
      path: renderDisplayPath(options.targetRoot, filePath),
      present: await pathExists(filePath)
    }))
  );
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot);
  const continuityItems: RepoControlPanelItem[] = [
    {
      label: "Latest checkpoint",
      value: continuity.latestCheckpoint ? `${continuity.latestCheckpoint.phase} [${continuity.latestCheckpoint.createdAt}]` : "none recorded"
    },
    {
      label: "Latest handoff",
      value: continuity.latestHandoff ? `${continuity.latestHandoff.summary} -> ${continuity.latestHandoff.toRole}` : "none recorded"
    },
    {
      label: "Latest reconcile",
      value: latestReconcile ? `${latestReconcile.dispatchId} [${latestReconcile.status}]` : "none recorded"
    },
    {
      label: "Current focus",
      value: continuity.currentFocus?.currentFocus ?? "none recorded"
    },
    {
      label: "Open risks",
      value: openRisks?.risks.join("; ") || "none recorded",
      ...(openRisks?.risks.length ? { tone: "warn" as const } : {})
    }
  ];
  const availableSpecialists = listSpecialists({
    config: options.config,
    profileName: selection.profileName
  });
  const validation: RepoValidationSummary = {
    ok: validationIssues.every((issue) => issue.level !== "error"),
    errors: validationIssues.filter((issue) => issue.level === "error").length,
    warnings: validationIssues.filter((issue) => issue.level === "warn").length,
    issues: validationIssues
  };
  const repoState = summarizeRepoState({
    targetRoot: options.targetRoot,
    inspection,
    validation
  });
  const fallbackNextCommand = buildFallbackNextCommand(repoState.mode, options.targetRoot);
  const fallbackNextFile = buildFallbackNextFile(inspection.existingAuthorityFiles);
  const defaultRecommendedSpecialist =
    repoState.mode === "repo-not-initialized"
      ? inspection.projectType === "node"
        ? "fullstack-specialist"
        : inspection.projectType === "python"
          ? "python-specialist"
          : "architecture-specialist"
      : repoState.mode === "initialized-invalid"
        ? "review-specialist"
        : recommendedSpecialist;
  const repoOverview = summarizeRepoOverview();

  const kiwiControl = await loadKiwiControlState(options.targetRoot);

  return {
    targetRoot: options.targetRoot,
    profileName: selection.profileName,
    executionMode,
    projectType: inspection.projectType,
    repoState,
    repoOverview,
    continuity: continuityItems,
    memoryBank,
    specialists: {
      recommendedSpecialist: defaultRecommendedSpecialist,
      available: availableSpecialists,
      handoffTargets: availableSpecialists.map((specialist) => specialist.specialistId).slice(0, 8),
      safeParallelHint: buildSafeParallelHint(repoState.mode, latestTaskPacketSet?.files.length ?? 0)
    },
    mcpPacks: {
      suggestedPack,
      available: listMcpPacks()
    },
    validation,
    kiwiControl
  };

  function summarizeRepoOverview(): RepoControlPanelItem[] {
    return [
      { label: "Project type", value: `${inspection.projectType} (${inspection.projectTypeSource})` },
      {
        label: "Active role",
        value:
          normalizeSpecialistId(options.config, activeRoleHints?.activeRole, activeRoleHints?.activeRole) ??
          "none recorded"
      },
      {
        label: "Next file",
        value: activeRoleHints?.nextFileToRead ?? continuity.currentFocus?.nextFileToRead ?? fallbackNextFile
      },
      {
        label: "Next command",
        value: activeRoleHints?.nextSuggestedCommand ?? continuity.currentFocus?.nextSuggestedCommand ?? fallbackNextCommand
      },
      { label: "Validation state", value: summarizeValidation(validationIssues) },
      {
        label: "Current phase",
        value: continuity.latestPhase ? `${continuity.latestPhase.label} [${continuity.latestPhase.status}]` : "none recorded"
      }
    ];
  }
}

function summarizeValidation(issues: ValidationIssue[]): string {
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warn").length;
  if (errors === 0 && warnings === 0) {
    return "passing";
  }
  if (errors === 0) {
    return `${warnings} warning${warnings === 1 ? "" : "s"}`;
  }
  return `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;
}

function summarizeRepoState(options: {
  targetRoot: string;
  inspection: Awaited<ReturnType<typeof inspectBootstrapTarget>>;
  validation: RepoValidationSummary;
}): RepoControlStatus {
  const sourceOfTruthNote =
    "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app only reads and reports that state.";

  if (!options.inspection.alreadyInitialized) {
    return {
      mode: "repo-not-initialized",
      title: "Repo not initialized yet",
      detail: `Run ${PRODUCT_METADATA.cli.primaryCommand} init in this folder to seed the repo-local control surfaces before using specialists, checkpoints, or handoffs.`,
      sourceOfTruthNote
    };
  }

  if (options.validation.errors > 0) {
    return {
      mode: "initialized-invalid",
      title: "Repo contract needs repair",
      detail: `${options.validation.errors} validation error${options.validation.errors === 1 ? "" : "s"} are blocking a healthy repo-local state. Use ${PRODUCT_METADATA.cli.primaryCommand} check in this folder to inspect the contract drift.`,
      sourceOfTruthNote
    };
  }

  if (options.validation.warnings > 0) {
    return {
      mode: "initialized-with-warnings",
      title: "Repo is usable with warnings",
      detail: `${options.validation.warnings} warning${options.validation.warnings === 1 ? "" : "s"} remain, but the repo-local control surfaces are present and readable.`,
      sourceOfTruthNote
    };
  }

  return {
    mode: "healthy",
    title: "Repo state is healthy",
    detail: "The repo-local control surfaces are present, validation is clean, and the desktop app can safely mirror the CLI view of repo state.",
    sourceOfTruthNote
  };
}

function buildFallbackNextCommand(mode: RepoControlMode, _targetRoot: string): string {
  switch (mode) {
    case "repo-not-initialized":
      return `${PRODUCT_METADATA.cli.primaryCommand} init`;
    case "initialized-invalid":
      return `${PRODUCT_METADATA.cli.primaryCommand} check --json`;
    case "initialized-with-warnings":
      return `${PRODUCT_METADATA.cli.primaryCommand} status`;
    default:
      return "none recorded";
  }
}

function buildFallbackNextFile(authorityFiles: string[]): string {
  return authorityFiles[0] ?? "none recorded";
}

function buildSafeParallelHint(mode: RepoControlMode, taskFileCount: number): string {
  if (mode === "repo-not-initialized") {
    return "Initialize the repo before handing work to specialists. Generic repos should stay quiet until repo-local surfaces exist.";
  }

  if (mode === "initialized-invalid") {
    return "Repair the repo-local contract first. Parallel work is premature while checkpoints, memory, or handoff state are invalid.";
  }

  if (taskFileCount > 1) {
    return "Parallel work is safest when each specialist owns disjoint files and reconcile is already planned.";
  }

  return "Keep generic repos quiet. Fan out only when file ownership and reconcile responsibilities are explicit.";
}

async function loadKiwiControlState(targetRoot: string): Promise<KiwiControlState> {
  const contextSelectionPath = path.join(targetRoot, ".agent", "state", "context-selection.json");
  const tokenUsagePath = path.join(targetRoot, ".agent", "state", "token-usage.json");
  const instructionsPath = path.join(targetRoot, ".agent", "context", "generated-instructions.md");

  let contextView: KiwiControlContextView = {
    task: null,
    selectedFiles: [],
    excludedPatterns: [],
    reason: null,
    confidence: null,
    keywordMatches: [],
    timestamp: null
  };

  if (await pathExists(contextSelectionPath)) {
    const selection = await readJson<ContextSelectionState>(contextSelectionPath);
    contextView = {
      task: selection.task,
      selectedFiles: selection.include,
      excludedPatterns: selection.exclude,
      reason: selection.reason,
      confidence: selection.confidence ?? null,
      keywordMatches: selection.signals?.keywordMatches ?? [],
      timestamp: selection.timestamp
    };
  }

  let tokenAnalytics: KiwiControlTokenAnalytics = {
    selectedTokens: 0,
    fullRepoTokens: 0,
    savingsPercent: 0,
    fileCountSelected: 0,
    fileCountTotal: 0,
    estimationMethod: null,
    topDirectories: [],
    costEstimates: [],
    task: null,
    timestamp: null
  };

  let wastedFiles: KiwiControlWastedFiles = {
    files: [],
    totalWastedTokens: 0,
    removalSavingsPercent: 0
  };

  let heavyDirectories: KiwiControlHeavyDirectories = {
    directories: []
  };

  if (await pathExists(tokenUsagePath)) {
    const usage = await readJson<TokenUsageState>(tokenUsagePath);
    tokenAnalytics = {
      selectedTokens: usage.selected_tokens,
      fullRepoTokens: usage.full_repo_tokens,
      savingsPercent: usage.savings_percent,
      fileCountSelected: usage.file_count_selected,
      fileCountTotal: usage.file_count_total,
      estimationMethod: usage.estimation_method ?? null,
      topDirectories: usage.top_directories ?? [],
      costEstimates: usage.cost_estimates?.tiers?.map((t) => ({
        model: t.model,
        selectedCost: t.selectedCost,
        fullRepoCost: t.fullRepoCost,
        savingsCost: t.savingsCost
      })) ?? [],
      task: usage.task,
      timestamp: usage.timestamp
    };
    wastedFiles = {
      files: usage.wasted_files ?? [],
      totalWastedTokens: usage.wasted_tokens_total ?? 0,
      removalSavingsPercent: usage.wasted_removal_savings_percent ?? 0
    };
    heavyDirectories = {
      directories: usage.heavy_directories ?? []
    };
  }

  const hasInstructions = await pathExists(instructionsPath);

  const efficiency: KiwiControlEfficiency = {
    instructionsGenerated: hasInstructions,
    instructionsPath: hasInstructions ? instructionsPath : null
  };

  // Load decision engine, feedback, and execution data in parallel
  const [decisionOutput, feedbackSummary, executionSummary] = await Promise.all([
    nextActionEngine(targetRoot).catch(() => ({ nextActions: [], summary: "Decision engine unavailable" })),
    buildFeedbackSummary(targetRoot, contextView.task ?? undefined).catch(() => ({
      totalRuns: 0, successRate: 0, recentEntries: [],
      topBoostedFiles: [], topPenalizedFiles: []
    })),
    buildExecutionSummary(targetRoot).catch(() => ({
      totalExecutions: 0, totalTokensUsed: 0, averageTokensPerRun: 0,
      successRate: 0, recentExecutions: [], tokenTrend: "insufficient-data" as const
    }))
  ]);

  const nextActions: KiwiControlNextActions = {
    actions: decisionOutput.nextActions,
    summary: decisionOutput.summary
  };

  const feedback: KiwiControlFeedback = {
    totalRuns: feedbackSummary.totalRuns,
    successRate: feedbackSummary.successRate,
    recentEntries: feedbackSummary.recentEntries,
    topBoostedFiles: feedbackSummary.topBoostedFiles,
    topPenalizedFiles: feedbackSummary.topPenalizedFiles
  };

  const execution: KiwiControlExecution = {
    totalExecutions: executionSummary.totalExecutions,
    totalTokensUsed: executionSummary.totalTokensUsed,
    averageTokensPerRun: executionSummary.averageTokensPerRun,
    successRate: executionSummary.successRate,
    recentExecutions: executionSummary.recentExecutions,
    tokenTrend: executionSummary.tokenTrend
  };

  return {
    contextView, tokenAnalytics, efficiency,
    nextActions, feedback, execution, wastedFiles, heavyDirectories
  };
}
