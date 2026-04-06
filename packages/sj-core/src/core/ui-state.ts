import path from "node:path";
import type { LoadedConfig } from "./config.js";
import { loadCanonicalConfig } from "./config.js";
import { PRODUCT_METADATA } from "./product.js";
import { compileRepoContext } from "./context.js";
import { syncExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlanState } from "./execution-plan.js";
import { getMemoryPaths, loadOpenRisks } from "./memory.js";
import { inspectBootstrapTarget } from "./project-detect.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "./profiles.js";
import { getMcpPackDefinition, listMcpPacks, recommendMcpPack } from "./recommendations.js";
import { loadLatestReconcileReport } from "./reconcile.js";
import {
  listEligibleMcpCapabilities,
  listSpecialists,
  normalizeSpecialistId,
  recommendNextSpecialist
} from "./specialists.js";
import { loadActiveRoleHints, loadContinuitySnapshot, loadLatestTaskPacketSet } from "./state.js";
import type { ValidationIssue } from "./validator.js";
import { validateControlPlane, validateTargetRepo } from "./validator.js";
import { pathExists, readJson, renderDisplayPath, writeText } from "../utils/fs.js";
import type { ContextSelectionState } from "./context-selector.js";
import type { ContextTraceState, FileAnalysisEntry, IndexingState, SkippedPathEntry } from "./context-trace.js";
import type { RuntimeLifecycleState } from "./runtime-lifecycle.js";
import { buildEcosystemCatalog } from "../integrations/ecosystem-catalog.js";
import type { EcosystemCatalog } from "../integrations/ecosystem-catalog.js";
import { buildMachineGuidanceContext, filterMachineGuidance, loadMachineAdvisory } from "../integrations/machine-advisory.js";
import type { MachineAdvisoryState } from "../integrations/machine-advisory.js";
import type { SkillMatch, SkillRegistryState } from "./skills-registry.js";
import type { TokenBreakdownState, TokenUsageState } from "./token-estimator.js";
import type { MeasuredUsageState } from "./token-intelligence.js";
import { inspectGitState } from "./git.js";
import { nextActionEngine } from "./next-action.js";
import type { DecisionLogicState, NextAction } from "./next-action.js";
import { buildFeedbackSummary } from "./context-feedback.js";
import type { FeedbackSummary } from "./context-feedback.js";
import { buildExecutionSummary, recordPreparedScopeCompletion } from "./execution-log.js";
import type { ExecutionSummary } from "./execution-log.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "./prepared-scope.js";
import { classifyFileArea, deriveTaskArea } from "./task-intent.js";
import { loadWorkflowState } from "./workflow-engine.js";
import type { WorkflowState } from "./workflow-engine.js";

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

export interface RepoControlLoadState {
  source: "fresh" | "warm-snapshot" | "stale-snapshot";
  freshness: "fresh" | "warm" | "stale";
  generatedAt: string;
  snapshotSavedAt: string | null;
  snapshotAgeMs: number | null;
  detail: string;
}

export interface KiwiControlContextView {
  task: string | null;
  selectedFiles: string[];
  excludedPatterns: string[];
  reason: string | null;
  confidence: string | null;
  confidenceDetail: string | null;
  keywordMatches: string[];
  tree: KiwiControlContextTree;
  timestamp: string | null;
}

export type KiwiControlContextTreeStatus = "selected" | "candidate" | "excluded";

export interface KiwiControlContextTreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  status: KiwiControlContextTreeStatus;
  expanded: boolean;
  children: KiwiControlContextTreeNode[];
}

export interface KiwiControlContextTree {
  nodes: KiwiControlContextTreeNode[];
  selectedCount: number;
  candidateCount: number;
  excludedCount: number;
}

export interface KiwiControlTokenAnalytics {
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  fileCountSelected: number;
  fileCountTotal: number;
  estimationMethod: string | null;
  estimateNote: string | null;
  topDirectories: Array<{ directory: string; tokens: number; fileCount: number }>;
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
  adaptationLevel: "limited" | "active";
  note: string;
  basedOnPastRuns: boolean;
  reusedPattern: string | null;
  similarTasks: Array<{
    task: string;
    similarity: number;
    timestamp: string;
  }>;
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

export interface KiwiControlIndexing {
  totalFiles: number;
  observedFiles: number;
  selectedFiles: number;
  candidateFiles: number;
  excludedFiles: number;
  discoveredFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  skippedDirectories: number;
  visitedDirectories: number;
  maxDepthExplored: number;
  fileBudgetReached: boolean;
  directoryBudgetReached: boolean;
  partialScan: boolean;
  ignoreRulesApplied: string[];
  skipped: SkippedPathEntry[];
  indexedFiles: number;
  indexUpdatedFiles: number;
  indexReusedFiles: number;
  impactFiles: number;
  changedSignals: number;
  keywordSignals: number;
  importSignals: number;
  repoContextSignals: number;
  scopeArea: string | null;
  coverageNote: string;
  selectionReason: string | null;
}

export interface KiwiControlFileAnalysis {
  totalFiles: number;
  scannedFiles: number;
  skippedFiles: number;
  selectedFiles: number;
  excludedFiles: number;
  selected: FileAnalysisEntry[];
  excluded: FileAnalysisEntry[];
  skipped: SkippedPathEntry[];
}

export interface KiwiControlContextTrace {
  initialSignals: ContextTraceState["initialSignals"];
  expansionSteps: ContextTraceState["expansionSteps"];
  honesty: ContextTraceState["honesty"];
}

export interface KiwiControlTokenBreakdown {
  partialScan: boolean;
  categories: TokenBreakdownState["categories"];
}

export interface KiwiControlDecisionLogic {
  summary: string;
  decisionPriority: NextAction["priority"];
  inputSignals: string[];
  reasoningChain: string[];
  ignoredSignals: string[];
}

export interface KiwiControlRuntimeLifecycle {
  currentTask: string | null;
  currentStage: string;
  validationStatus: "ok" | "warn" | "error" | null;
  nextSuggestedCommand: string | null;
  nextRecommendedAction: string | null;
  recentEvents: RuntimeLifecycleState["recentEvents"];
}

export interface KiwiControlMeasuredUsage {
  available: boolean;
  source: MeasuredUsageState["source"];
  totalTokens: number;
  totalRuns: number;
  runs: MeasuredUsageState["runs"];
  workflows: MeasuredUsageState["workflows"];
  files: MeasuredUsageState["files"];
  note: string;
}

export interface KiwiControlSkills {
  activeSkills: SkillMatch[];
  suggestedSkills: SkillMatch[];
  totalSkills: number;
}

export interface KiwiControlWorkflow {
  task: string | null;
  status: WorkflowState["status"];
  currentStepId: string | null;
  steps: WorkflowState["steps"];
}

export interface KiwiControlExecutionTrace {
  steps: Array<{
    stepId: string;
    action: string;
    status: string;
    expectedOutput: string | null;
    files: string[];
    skillsApplied: string[];
    attemptCount: number;
    retryCount: number;
    tokenUsage: {
      source: string;
      measuredTokens: number | null;
      estimatedTokens: number | null;
      note: string;
    };
    result: WorkflowState["steps"][number]["result"];
    output: string | null;
    validation: string | null;
    failureReason: string | null;
    updatedAt: string | null;
  }>;
  whyThisHappened: string;
}

export interface KiwiControlExecutionPlan {
  summary: string;
  intent: ExecutionPlanState["intent"];
  hierarchy: ExecutionPlanState["hierarchy"];
  state: ExecutionPlanState["state"];
  currentStepIndex: number;
  confidence: string | null;
  risk: ExecutionPlanState["risk"];
  blocked: boolean;
  steps: ExecutionPlanState["steps"];
  nextCommands: string[];
  lastError: ExecutionPlanState["lastError"];
  impactPreview: ExecutionPlanState["impactPreview"];
  verificationLayers: ExecutionPlanState["verificationLayers"];
  partialResults: ExecutionPlanState["partialResults"];
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
  indexing: KiwiControlIndexing;
  fileAnalysis: KiwiControlFileAnalysis;
  contextTrace: KiwiControlContextTrace;
  tokenBreakdown: KiwiControlTokenBreakdown;
  decisionLogic: KiwiControlDecisionLogic;
  runtimeLifecycle: KiwiControlRuntimeLifecycle;
  measuredUsage: KiwiControlMeasuredUsage;
  skills: KiwiControlSkills;
  workflow: KiwiControlWorkflow;
  executionTrace: KiwiControlExecutionTrace;
  executionPlan: KiwiControlExecutionPlan;
}

export interface RepoControlState {
  targetRoot: string;
  loadState: RepoControlLoadState;
  profileName: string;
  executionMode: string;
  projectType: string;
  repoState: RepoControlStatus;
  repoOverview: RepoControlPanelItem[];
  continuity: RepoControlPanelItem[];
  memoryBank: RepoMemoryBankEntry[];
  specialists: {
    activeSpecialist: string;
    recommendedSpecialist: string;
    available: ReturnType<typeof listSpecialists>;
    activeProfile: ReturnType<typeof listSpecialists>[number] | null;
    recommendedProfile: ReturnType<typeof listSpecialists>[number] | null;
    handoffTargets: string[];
    safeParallelHint: string;
  };
  mcpPacks: {
    suggestedPack: ReturnType<typeof getMcpPackDefinition>;
    available: ReturnType<typeof listMcpPacks>;
    compatibleCapabilities: ReturnType<typeof listEligibleMcpCapabilities>;
    capabilityStatus: "compatible" | "limited";
    note: string;
  };
  validation: RepoValidationSummary;
  ecosystem: EcosystemCatalog;
  machineAdvisory: MachineAdvisoryState;
  kiwiControl: KiwiControlState;
}

interface RepoControlSnapshotArtifact {
  artifactType: "kiwi-control/repo-control-snapshot";
  version: 1;
  savedAt: string;
  state: RepoControlState;
}

const REPO_CONTROL_SNAPSHOT_VERSION = 1;
const DEFAULT_WARM_SNAPSHOT_MAX_AGE_MS = 120_000;
const DEFAULT_STALE_SNAPSHOT_MAX_AGE_MS = 10 * 60_000;

function repoControlSnapshotPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "repo-control-snapshot.json");
}

function buildFreshLoadState(generatedAt = new Date().toISOString()): RepoControlLoadState {
  return {
    source: "fresh",
    freshness: "fresh",
    generatedAt,
    snapshotSavedAt: null,
    snapshotAgeMs: null,
    detail: "Repo-local state is current."
  };
}

function withFreshLoadState(state: RepoControlState, generatedAt = new Date().toISOString()): RepoControlState {
  return {
    ...state,
    loadState: buildFreshLoadState(generatedAt)
  };
}

export async function loadWarmRepoControlSnapshot(
  targetRoot: string,
  options: { warmMaxAgeMs?: number; staleMaxAgeMs?: number } = {}
): Promise<RepoControlState | null> {
  const snapshotFilePath = repoControlSnapshotPath(targetRoot);
  if (!(await pathExists(snapshotFilePath))) {
    return null;
  }

  const warmMaxAgeMs = options.warmMaxAgeMs ?? DEFAULT_WARM_SNAPSHOT_MAX_AGE_MS;
  const staleMaxAgeMs = Math.max(options.staleMaxAgeMs ?? DEFAULT_STALE_SNAPSHOT_MAX_AGE_MS, warmMaxAgeMs);

  try {
    const artifact = await readJson<RepoControlSnapshotArtifact>(snapshotFilePath);
    if (artifact.artifactType !== "kiwi-control/repo-control-snapshot" || artifact.version !== REPO_CONTROL_SNAPSHOT_VERSION) {
      return null;
    }

    const ageMs = Date.now() - new Date(artifact.savedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > staleMaxAgeMs) {
      return null;
    }

    if (ageMs > warmMaxAgeMs) {
      return {
        ...artifact.state,
        loadState: {
          source: "stale-snapshot",
          freshness: "stale",
          generatedAt: artifact.state.loadState?.generatedAt ?? artifact.savedAt,
          snapshotSavedAt: artifact.savedAt,
          snapshotAgeMs: ageMs,
          detail: `Loaded an older repo snapshot from ${Math.round(ageMs / 1000)}s ago while fresh state refreshes in the background.`
        }
      };
    }

    return {
      ...artifact.state,
      loadState: {
        source: "warm-snapshot",
        freshness: "warm",
        generatedAt: artifact.state.loadState?.generatedAt ?? artifact.savedAt,
        snapshotSavedAt: artifact.savedAt,
        snapshotAgeMs: ageMs,
        detail: `Loaded a warm repo snapshot from ${Math.round(ageMs / 1000)}s ago while fresh state refreshes in the background.`
      }
    };
  } catch {
    return null;
  }
}

export async function persistRepoControlSnapshot(targetRoot: string, state: RepoControlState): Promise<string> {
  if (!(await pathExists(path.join(targetRoot, ".agent")))) {
    return repoControlSnapshotPath(targetRoot);
  }
  const snapshotFilePath = repoControlSnapshotPath(targetRoot);
  const savedAt = new Date().toISOString();
  const artifact: RepoControlSnapshotArtifact = {
    artifactType: "kiwi-control/repo-control-snapshot",
    version: REPO_CONTROL_SNAPSHOT_VERSION,
    savedAt,
    state: withFreshLoadState(state, state.loadState?.generatedAt ?? savedAt)
  };
  await writeText(snapshotFilePath, `${JSON.stringify(artifact, null, 2)}\n`);
  return snapshotFilePath;
}

export async function buildRepoControlState(options: {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  machineAdvisoryOptions?: Parameters<typeof loadMachineAdvisory>[0];
  preferSnapshot?: boolean;
  readOnly?: boolean;
}): Promise<RepoControlState> {
  if (options.preferSnapshot) {
    const snapshot = await loadWarmRepoControlSnapshot(options.targetRoot);
    if (snapshot) {
      return snapshot;
    }
  }

  const config = await loadCanonicalConfig(options.repoRoot);
  const state = await buildRepoControlStateFromConfig({
    config,
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.machineAdvisoryOptions ? { machineAdvisoryOptions: options.machineAdvisoryOptions } : {}),
    ...(options.profileName ? { profileName: options.profileName } : {}),
    ...(options.readOnly ? { readOnly: true } : {})
  });
  if (!options.readOnly) {
    await persistRepoControlSnapshot(options.targetRoot, state).catch(() => null);
  }
  return state;
}

export async function buildRepoControlStateFromConfig(options: {
  config: LoadedConfig;
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  machineAdvisoryOptions?: Parameters<typeof loadMachineAdvisory>[0];
  readOnly?: boolean;
}): Promise<RepoControlState> {
  const generatedAt = new Date().toISOString();
  const [
    inspection,
    overlay,
    selection,
    continuity,
    activeRoleHints
  ] = await Promise.all([
    inspectBootstrapTarget(options.targetRoot, options.config),
    loadProjectOverlay(options.targetRoot),
    resolveProfileSelection(options.targetRoot, options.config, options.profileName),
    loadContinuitySnapshot(options.targetRoot),
    loadActiveRoleHints(options.targetRoot)
  ]);
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
  const [
    controlPlaneIssues,
    targetRepoIssues,
    openRisks,
    latestTaskPacketSet,
    latestReconcile,
    machineAdvisory
  ] = await Promise.all([
    validateControlPlane(options.repoRoot, options.config),
    validateTargetRepo(options.targetRoot, options.config, selection),
    loadOpenRisks(options.targetRoot),
    loadLatestTaskPacketSet(options.targetRoot),
    loadLatestReconcileReport(options.targetRoot),
    loadMachineAdvisory(options.machineAdvisoryOptions).catch((): MachineAdvisoryState => ({
      artifactType: "kiwi-control/machine-advisory" as const,
      version: 3 as const,
      generatedBy: "kiwi-control machine-advisory",
      windowDays: 7,
      updatedAt: new Date().toISOString(),
      stale: true,
      sections: {
        inventory: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." },
        mcpInventory: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." },
        optimizationLayers: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." },
        setupPhases: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." },
        configHealth: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." },
        usage: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." },
        guidance: { status: "partial" as const, updatedAt: new Date().toISOString(), reason: "Machine advisory unavailable." }
      },
      inventory: [],
      mcpInventory: {
        claudeTotal: 0,
        codexTotal: 0,
        copilotTotal: 0,
        tokenServers: []
      },
      optimizationLayers: [],
      setupPhases: [],
      configHealth: [],
      skillsCount: 0,
      copilotPlugins: [],
      usage: {
        days: 7,
        claude: {
          available: false,
          days: [],
          totals: {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
            totalCost: null,
            cacheHitRatio: null
          },
          note: "Machine advisory unavailable."
        },
        codex: {
          available: false,
          days: [],
          totals: {
            inputTokens: 0,
            outputTokens: 0,
            cachedInputTokens: 0,
            reasoningOutputTokens: 0,
            sessions: 0,
            totalTokens: 0,
            cacheHitRatio: null
          },
          note: "Machine advisory unavailable."
        },
        copilot: {
          available: false,
          note: "Machine advisory unavailable."
        }
      },
      optimizationScore: {
        planning: { label: "planning", score: 0, earnedPoints: 0, maxPoints: 100, activeSignals: [], missingSignals: [] },
        execution: { label: "execution", score: 0, earnedPoints: 0, maxPoints: 100, activeSignals: [], missingSignals: [] },
        assistant: { label: "assistant", score: 0, earnedPoints: 0, maxPoints: 100, activeSignals: [], missingSignals: [] }
      },
      setupSummary: {
        installedTools: { readyCount: 0, totalCount: 0 },
        healthyConfigs: { readyCount: 0, totalCount: 0 },
        activeTokenLayers: [],
        readyRuntimes: {
          planning: false,
          execution: false,
          assistant: false
        }
      },
      systemHealth: {
        criticalCount: 0,
        warningCount: 0,
        okCount: 0
      },
      guidance: [],
      note: "Machine-local advisory is unavailable."
    }))
  ]);
  const validationIssues = [
    ...controlPlaneIssues,
    ...targetRepoIssues
  ];
  const memoryPaths = getMemoryPaths(options.targetRoot);
  const memoryEntries: Array<[string, string]> = [
    ["Repo Facts", memoryPaths.repoFacts],
    ["Current Focus", memoryPaths.currentFocus],
    ["Open Risks", memoryPaths.openRisks],
    ["Context Tree", path.join(options.targetRoot, ".agent", "context", "context-tree.json")]
  ];
  const memoryBank: RepoMemoryBankEntry[] = await Promise.all(
    memoryEntries.map(async ([label, filePath]) => ({
      label,
      path: renderDisplayPath(options.targetRoot, filePath),
      present: await pathExists(filePath)
    }))
  );
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
  const activeSpecialistId =
    normalizeSpecialistId(options.config, activeRoleHints?.activeRole, defaultRecommendedSpecialist) ??
    defaultRecommendedSpecialist;
  const activeSpecialistProfile = availableSpecialists.find((entry) => entry.specialistId === activeSpecialistId) ?? null;
  const recommendedSpecialistProfile =
    availableSpecialists.find((entry) => entry.specialistId === defaultRecommendedSpecialist) ?? null;
  const compatibleMcpCapabilities = listEligibleMcpCapabilities({
    config: options.config,
    profileName: selection.profileName,
    specialistId: activeSpecialistId
  });
  const repoOverview = summarizeRepoOverview();
  const ecosystem = buildEcosystemCatalog();
  const kiwiControl = await loadKiwiControlState(options.targetRoot, validationIssues, {
    readOnly: options.readOnly === true
  });
  const machineGuidanceContext = buildMachineGuidanceContext({
    taskType: deriveMachineTaskType(kiwiControl),
    workflowStep: kiwiControl.workflow.currentStepId,
    validationFailed: validation.errors > 0,
    evalPrecisionLow: kiwiControl.feedback.totalRuns > 0 && kiwiControl.feedback.successRate < 50,
    executionRetriesTriggered: kiwiControl.workflow.steps.some((step) => step.retryCount > 0)
  });
  machineAdvisory.guidance = filterMachineGuidance(machineAdvisory.guidance, machineGuidanceContext);

  return {
    targetRoot: options.targetRoot,
    loadState: buildFreshLoadState(generatedAt),
    profileName: selection.profileName,
    executionMode,
    projectType: inspection.projectType,
    repoState,
    repoOverview,
    continuity: continuityItems,
    memoryBank,
    specialists: {
      activeSpecialist: activeSpecialistId,
      recommendedSpecialist: defaultRecommendedSpecialist,
      available: availableSpecialists,
      activeProfile: activeSpecialistProfile,
      recommendedProfile: recommendedSpecialistProfile,
      handoffTargets: availableSpecialists.map((specialist) => specialist.specialistId).slice(0, 8),
      safeParallelHint: buildSafeParallelHint(repoState.mode, latestTaskPacketSet?.files.length ?? 0)
    },
    mcpPacks: {
      suggestedPack,
      available: listMcpPacks(),
      compatibleCapabilities: compatibleMcpCapabilities,
      capabilityStatus: compatibleMcpCapabilities.length > 0 ? "compatible" : "limited",
      note:
        compatibleMcpCapabilities.length > 0
          ? `${compatibleMcpCapabilities.length} specialist-compatible MCP capabilities are currently available for this repo profile.`
          : "No specialist-compatible MCP capabilities are currently exposed for this repo profile."
    },
    validation,
    ecosystem,
    machineAdvisory,
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

function deriveMachineTaskType(state: KiwiControlState): string | null {
  const task = state.contextView.task?.toLowerCase() ?? "";
  if (!task) {
    return null;
  }
  if (/\b(read|inspect|review|summarize)\b/.test(task)) {
    return "read";
  }
  if (/\bdocs?|document|readme\b/.test(task)) {
    return "docs";
  }
  return "implementation";
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

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJson<T>(filePath);
}

async function loadKiwiControlState(
  targetRoot: string,
  validationIssues: ValidationIssue[],
  options: { readOnly?: boolean } = {}
): Promise<KiwiControlState> {
  const contextSelectionPath = path.join(targetRoot, ".agent", "state", "context-selection.json");
  const contextTracePath = path.join(targetRoot, ".agent", "state", "context-trace.json");
  const runtimeLifecyclePath = path.join(targetRoot, ".agent", "state", "runtime-lifecycle.json");
  const indexingPath = path.join(targetRoot, ".agent", "state", "indexing.json");
  const skillsRegistryPath = path.join(targetRoot, ".agent", "state", "skills-registry.json");
  const tokenUsagePath = path.join(targetRoot, ".agent", "state", "token-usage.json");
  const tokenBreakdownPath = path.join(targetRoot, ".agent", "state", "token-breakdown.json");
  const measuredUsagePath = path.join(targetRoot, ".agent", "state", "measured-usage.json");
  const workflowPath = path.join(targetRoot, ".agent", "state", "workflow.json");
  const instructionsPath = path.join(targetRoot, ".agent", "context", "generated-instructions.md");

  const [
    selection,
    persistedIndexing,
    trace,
    tokenUsage,
    persistedTokenBreakdown,
    persistedRuntimeLifecycle,
    persistedMeasuredUsage,
    persistedSkills,
    workflowFilePresent,
    hasInstructions,
    preparedScope
  ] = await Promise.all([
    readJsonIfPresent<ContextSelectionState>(contextSelectionPath),
    readJsonIfPresent<IndexingState>(indexingPath),
    readJsonIfPresent<ContextTraceState>(contextTracePath),
    readJsonIfPresent<TokenUsageState>(tokenUsagePath),
    readJsonIfPresent<TokenBreakdownState>(tokenBreakdownPath),
    readJsonIfPresent<RuntimeLifecycleState>(runtimeLifecyclePath),
    readJsonIfPresent<MeasuredUsageState>(measuredUsagePath),
    readJsonIfPresent<SkillRegistryState>(skillsRegistryPath),
    pathExists(workflowPath),
    pathExists(instructionsPath),
    loadPreparedScope(targetRoot).catch(() => null)
  ]);

  let contextView: KiwiControlContextView = {
    task: null,
    selectedFiles: [],
    excludedPatterns: [],
    reason: null,
    confidence: null,
    confidenceDetail: null,
    keywordMatches: [],
    tree: emptyContextTree(),
    timestamp: null
  };

  let indexing: KiwiControlIndexing = {
    totalFiles: 0,
    observedFiles: 0,
    selectedFiles: 0,
    candidateFiles: 0,
    excludedFiles: 0,
    discoveredFiles: 0,
    analyzedFiles: 0,
    skippedFiles: 0,
    skippedDirectories: 0,
    visitedDirectories: 0,
    maxDepthExplored: 0,
    fileBudgetReached: false,
    directoryBudgetReached: false,
    partialScan: false,
    ignoreRulesApplied: [],
    skipped: [],
    indexedFiles: 0,
    indexUpdatedFiles: 0,
    indexReusedFiles: 0,
    impactFiles: 0,
    changedSignals: 0,
    keywordSignals: 0,
    importSignals: 0,
    repoContextSignals: 0,
    scopeArea: null,
    coverageNote: "Run kiwi-control prepare to record indexing coverage and selection reasoning.",
    selectionReason: null
  };

  let fileAnalysis: KiwiControlFileAnalysis = {
    totalFiles: 0,
    scannedFiles: 0,
    skippedFiles: 0,
    selectedFiles: 0,
    excludedFiles: 0,
    selected: [],
    excluded: [],
    skipped: []
  };

  let contextTrace: KiwiControlContextTrace = {
    initialSignals: {
      changedFiles: [],
      recentFiles: [],
      importNeighbors: [],
      proximityFiles: [],
      keywordMatches: [],
      repoContextFiles: []
    },
    expansionSteps: [],
    honesty: {
      heuristic: true,
      lowConfidence: false,
      partialScan: false
    }
  };

  if (selection) {
    const tree = buildContextTree(selection);
    const observedFiles = collectObservedTreeFiles(selection).length;
    const discovery = selection.signals.discovery;
    contextView = {
      task: selection.task,
      selectedFiles: selection.include,
      excludedPatterns: selection.exclude,
      reason: selection.reason,
      confidence: selection.confidence ?? null,
      confidenceDetail: describeContextConfidence(selection),
      keywordMatches: selection.signals?.keywordMatches ?? [],
      tree,
      timestamp: selection.timestamp
    };
    indexing = {
      totalFiles: discovery?.totalFiles ?? observedFiles,
      observedFiles,
      selectedFiles: tree.selectedCount,
      candidateFiles: tree.candidateCount,
      excludedFiles: tree.excludedCount,
      discoveredFiles: discovery?.discoveredFiles ?? observedFiles,
      analyzedFiles: discovery?.analyzedFiles ?? observedFiles,
      skippedFiles: discovery?.skippedFiles ?? 0,
      skippedDirectories: discovery?.skippedDirectories ?? 0,
      visitedDirectories: discovery?.visitedDirectories ?? 0,
      maxDepthExplored: discovery?.maxDepthExplored ?? 0,
      fileBudgetReached: Boolean(discovery?.fileBudgetReached),
      directoryBudgetReached: Boolean(discovery?.directoryBudgetReached),
      partialScan: Boolean(discovery?.partialScan),
      ignoreRulesApplied: discovery?.ignoreRulesApplied ?? [],
      skipped: discovery?.skipped ?? [],
      indexedFiles: discovery?.indexedFiles ?? 0,
      indexUpdatedFiles: discovery?.indexUpdatedFiles ?? 0,
      indexReusedFiles: discovery?.indexReusedFiles ?? 0,
      impactFiles: discovery?.impactFiles ?? 0,
      changedSignals: (selection.signals.changedFiles ?? []).length,
      keywordSignals: (selection.signals.keywordMatches ?? []).length,
      importSignals: (selection.signals.importNeighbors ?? []).length,
      repoContextSignals: (selection.signals.repoContextFiles ?? []).length,
      scopeArea: deriveTaskArea(selection.task),
      coverageNote: describeIndexingCoverage(selection, observedFiles),
      selectionReason: selection.reason
    };
  }

  if (persistedIndexing) {
    indexing = {
      ...indexing,
      totalFiles: persistedIndexing.totalFiles,
      discoveredFiles: persistedIndexing.discoveredFiles,
      analyzedFiles: persistedIndexing.analyzedFiles,
      skippedFiles: persistedIndexing.skippedFiles,
      skippedDirectories: persistedIndexing.skippedDirectories,
      visitedDirectories: persistedIndexing.visitedDirectories,
      maxDepthExplored: persistedIndexing.maxDepthExplored,
      fileBudgetReached: persistedIndexing.fileBudgetReached,
      directoryBudgetReached: persistedIndexing.directoryBudgetReached,
      partialScan: persistedIndexing.partialScan,
      ignoreRulesApplied: persistedIndexing.ignoreRulesApplied,
      skipped: persistedIndexing.skipped,
      indexedFiles: persistedIndexing.indexedFiles ?? indexing.indexedFiles,
      indexUpdatedFiles: persistedIndexing.indexUpdatedFiles ?? indexing.indexUpdatedFiles,
      indexReusedFiles: persistedIndexing.indexReusedFiles ?? indexing.indexReusedFiles,
      impactFiles: persistedIndexing.impactFiles ?? indexing.impactFiles
    };
  }

  if (trace) {
    fileAnalysis = {
      totalFiles: trace.fileAnalysis.totalFiles,
      scannedFiles: trace.fileAnalysis.scannedFiles,
      skippedFiles: trace.fileAnalysis.skippedFiles,
      selectedFiles: trace.fileAnalysis.selectedFiles,
      excludedFiles: trace.fileAnalysis.excludedFiles,
      selected: trace.fileAnalysis.selected,
      excluded: trace.fileAnalysis.excluded,
      skipped: trace.fileAnalysis.skipped
    };
    contextTrace = {
      initialSignals: trace.initialSignals,
      expansionSteps: trace.expansionSteps,
      honesty: trace.honesty
    };
  }

  let tokenAnalytics: KiwiControlTokenAnalytics = {
    selectedTokens: 0,
    fullRepoTokens: 0,
    savingsPercent: 0,
    fileCountSelected: 0,
    fileCountTotal: 0,
    estimationMethod: null,
    estimateNote: null,
    topDirectories: [],
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

  let tokenBreakdown: KiwiControlTokenBreakdown = {
    partialScan: false,
    categories: []
  };

  let runtimeLifecycle: KiwiControlRuntimeLifecycle = {
    currentTask: null,
    currentStage: "idle",
    validationStatus: null,
    nextSuggestedCommand: null,
    nextRecommendedAction: null,
    recentEvents: []
  };

  let measuredUsage: KiwiControlMeasuredUsage = {
    available: false,
    source: "none",
    totalTokens: 0,
    totalRuns: 0,
    runs: [],
    workflows: [],
    files: [],
    note: "No measured token usage is available yet."
  };

  let skills: KiwiControlSkills = {
    activeSkills: [],
    suggestedSkills: [],
    totalSkills: 0
  };

  let workflowState: WorkflowState = {
    artifactType: "kiwi-control/workflow",
    version: 3,
    timestamp: new Date().toISOString(),
    task: null,
    status: "pending",
    currentStepId: null,
    steps: []
  };

  if (tokenUsage) {
    const usage = tokenUsage;
    tokenAnalytics = {
      selectedTokens: usage.selected_tokens,
      fullRepoTokens: usage.full_repo_tokens,
      savingsPercent: usage.savings_percent,
      fileCountSelected: usage.file_count_selected,
      fileCountTotal: usage.file_count_total,
      estimationMethod: usage.estimation_method ?? null,
      estimateNote: usage.estimate_note ?? null,
      topDirectories: usage.top_directories ?? [],
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
    measuredUsage = {
      available: usage.measured_usage?.available ?? false,
      source: usage.measured_usage?.source ?? "none",
      totalTokens: usage.measured_usage?.total_tokens ?? 0,
      totalRuns: usage.measured_usage?.total_runs ?? 0,
      runs: [],
      workflows: [],
      files: [],
      note: usage.measured_usage?.note ?? measuredUsage.note
    };
  }

  if (persistedTokenBreakdown) {
    tokenBreakdown = {
      partialScan: persistedTokenBreakdown.partial_scan,
      categories: persistedTokenBreakdown.categories
    };
  }

  if (persistedRuntimeLifecycle) {
    runtimeLifecycle = {
      currentTask: persistedRuntimeLifecycle.currentTask,
      currentStage: persistedRuntimeLifecycle.currentStage,
      validationStatus: persistedRuntimeLifecycle.validationStatus,
      nextSuggestedCommand: persistedRuntimeLifecycle.nextSuggestedCommand,
      nextRecommendedAction: persistedRuntimeLifecycle.nextRecommendedAction,
      recentEvents: persistedRuntimeLifecycle.recentEvents
    };
  }

  if (persistedMeasuredUsage) {
    measuredUsage = {
      available: persistedMeasuredUsage.available,
      source: persistedMeasuredUsage.source,
      totalTokens: persistedMeasuredUsage.totalTokens,
      totalRuns: persistedMeasuredUsage.totalRuns,
      runs: persistedMeasuredUsage.runs,
      workflows: persistedMeasuredUsage.workflows,
      files: persistedMeasuredUsage.files,
      note: persistedMeasuredUsage.note
    };
  }

  if (persistedSkills) {
    skills = {
      activeSkills: persistedSkills.activeSkills,
      suggestedSkills: persistedSkills.suggestedSkills,
      totalSkills: persistedSkills.skills.length
    };
  }

  if (workflowFilePresent) {
    workflowState = await loadWorkflowState(targetRoot);
  }

  const efficiency: KiwiControlEfficiency = {
    instructionsGenerated: hasInstructions,
    instructionsPath: hasInstructions ? instructionsPath : null
  };

  if (!options.readOnly) {
    await recordPreparedScopeCompletion(targetRoot, {
      completionSource: "repo-control",
      confidence: contextView.confidence,
      tokensUsed: tokenAnalytics.selectedTokens,
      tool: PRODUCT_METADATA.cli.primaryCommand
    }).catch(() => null);
  }

  // Load decision engine, feedback, and execution data in parallel
  const [decisionOutput, feedbackSummary, executionSummary] = await Promise.all([
    nextActionEngine(targetRoot, validationIssues, {
      persist: !options.readOnly
    }).catch(() => ({
      nextActions: [],
      summary: "Decision engine unavailable",
      decisionLogic: {
        artifactType: "kiwi-control/decision-logic" as const,
        version: 1 as const,
        timestamp: new Date().toISOString(),
        summary: "Decision engine unavailable",
        decisionPriority: "low" as const,
        inputSignals: [],
        reasoningChain: [],
        ignoredSignals: []
      }
    })),
    buildFeedbackSummary(targetRoot, contextView.task ?? undefined).catch(() => ({
      totalRuns: 0, successRate: 0, adaptationLevel: "limited" as const, note: "Adaptive feedback is unavailable.", basedOnPastRuns: false, reusedPattern: null, similarTasks: [], recentEntries: [],
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

  const decisionLogic: KiwiControlDecisionLogic = {
    summary: decisionOutput.decisionLogic?.summary ?? decisionOutput.summary,
    decisionPriority: decisionOutput.decisionLogic?.decisionPriority ?? "low",
    inputSignals: decisionOutput.decisionLogic?.inputSignals ?? [],
    reasoningChain: decisionOutput.decisionLogic?.reasoningChain ?? [],
    ignoredSignals: decisionOutput.decisionLogic?.ignoredSignals ?? []
  };

  const feedback: KiwiControlFeedback = {
    totalRuns: feedbackSummary.totalRuns,
    successRate: feedbackSummary.successRate,
    adaptationLevel: feedbackSummary.adaptationLevel,
    note: feedbackSummary.note,
    basedOnPastRuns: feedbackSummary.basedOnPastRuns,
    reusedPattern: feedbackSummary.reusedPattern,
    similarTasks: feedbackSummary.similarTasks,
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

  const executionTrace: KiwiControlExecutionTrace = {
    steps: workflowState.steps.map((step) => ({
      stepId: step.stepId,
      action: step.action,
      status: step.status,
      expectedOutput: step.expectedOutput,
      files: step.files,
      skillsApplied: step.skillsApplied,
      attemptCount: step.attemptCount,
      retryCount: step.retryCount,
      tokenUsage: {
        source: step.tokenUsage.source,
        measuredTokens: step.tokenUsage.measuredTokens,
        estimatedTokens: step.tokenUsage.estimatedTokens,
        note: step.tokenUsage.note
      },
      result: step.result,
      output: step.output,
      validation: step.validation,
      failureReason: step.failureReason,
      updatedAt: step.updatedAt
    })),
    whyThisHappened: decisionLogic.summary
  };

    const executionPlan = await syncExecutionPlan(targetRoot, {
    task: contextView.task ?? workflowState.task,
    validationIssues,
    persist: !options.readOnly
  }).catch(() => ({
    artifactType: "kiwi-control/execution-plan" as const,
    version: 2,
    task: contextView.task ?? workflowState.task,
    intent: null,
    hierarchy: {
      goal: contextView.task ?? workflowState.task,
      subtasks: []
    },
    state: "idle" as const,
    currentStepIndex: 0,
    confidence: null,
    risk: "low" as const,
    blocked: false,
    summary: "No execution plan is recorded yet.",
    steps: [],
    nextCommands: [],
    lastError: null,
    contextSnapshot: {
      selectedFiles: [],
      selectedModuleGroups: [],
      confidence: null,
      contextTreePath: null,
      dependencyChains: {},
      forwardDependencies: [],
      reverseDependencies: []
    },
    impactPreview: {
      likelyFiles: [],
      moduleGroups: []
    },
    verificationLayers: [],
    partialResults: [],
    evalSummary: null,
    updatedAt: new Date().toISOString()
  }));

  return {
    contextView, tokenAnalytics, efficiency,
    nextActions, feedback, execution, wastedFiles, heavyDirectories, indexing,
    fileAnalysis, contextTrace, tokenBreakdown, decisionLogic, runtimeLifecycle,
    measuredUsage, skills,
    workflow: {
      task: workflowState.task,
      status: workflowState.status,
      currentStepId: workflowState.currentStepId,
      steps: workflowState.steps
    },
    executionTrace,
    executionPlan: {
      summary: executionPlan.summary,
      intent: executionPlan.intent,
      hierarchy: executionPlan.hierarchy,
      state: executionPlan.state,
      currentStepIndex: executionPlan.currentStepIndex,
      confidence: executionPlan.confidence,
      risk: executionPlan.risk,
      blocked: executionPlan.blocked,
      steps: executionPlan.steps,
      nextCommands: executionPlan.nextCommands,
      lastError: executionPlan.lastError,
      impactPreview: executionPlan.impactPreview,
      verificationLayers: executionPlan.verificationLayers,
      partialResults: executionPlan.partialResults
    }
  };
}

function describeIndexingCoverage(selection: ContextSelectionState, observedFiles: number): string {
  const discovery = selection.signals.discovery;
  if (!discovery) {
    return `Showing ${observedFiles} observed files from live selector signals.`;
  }

  const indexNote =
    typeof discovery.indexReusedFiles === "number" || typeof discovery.indexUpdatedFiles === "number"
      ? ` The incremental import index reused ${discovery.indexReusedFiles ?? 0} files and refreshed ${discovery.indexUpdatedFiles ?? 0}.`
      : "";

  if (discovery.fileBudgetReached || discovery.directoryBudgetReached) {
    return `Discovery hit a budget limit, so coverage is intentionally partial and bounded.${indexNote}`;
  }

  if (discovery.maxDepthExplored >= 4) {
    return `Discovery reached depth ${discovery.maxDepthExplored} and stayed within budget.${indexNote}`;
  }

  return `Discovery stayed shallow at depth ${discovery.maxDepthExplored}, which usually means strong early signals narrowed the scope quickly.${indexNote}`;
}

function describeContextConfidence(selection: ContextSelectionState): string | null {
  const confidence = selection.confidence ?? null;
  if (!confidence) {
    return null;
  }

  const maxDepthExplored = selection.signals.discovery?.maxDepthExplored ?? 0;
  const budgetLimited = Boolean(
    selection.signals.discovery?.fileBudgetReached || selection.signals.discovery?.directoryBudgetReached
  );

  if (confidence === "high") {
    return "Multiple repo-local signals agree and current coverage looks healthy.";
  }

  if (confidence === "medium") {
    if (budgetLimited) {
      return "Useful evidence was found, but discovery hit a budget limit.";
    }
    if (maxDepthExplored >= 4) {
      return "Useful evidence was found across the repo, but coverage is still partial.";
    }
    return "Useful evidence was found, but the file set should still be treated as partial.";
  }

  if (budgetLimited) {
    return "Evidence is narrow and discovery hit a budget limit.";
  }

  if (maxDepthExplored < 4) {
    return "Evidence is narrow and repo coverage is still limited.";
  }

  return "Evidence is narrow or partial, so verify file relevance before editing.";
}

function emptyContextTree(): KiwiControlContextTree {
  return {
    nodes: [],
    selectedCount: 0,
    candidateCount: 0,
    excludedCount: 0
  };
}

function buildContextTree(selection: ContextSelectionState): KiwiControlContextTree {
  const selectedFiles = selection.include.filter(isVisibleContextTreePath);
  const observedFiles = collectObservedTreeFiles(selection);

  if (observedFiles.length === 0) {
    return emptyContextTree();
  }

  const taskArea = deriveTaskArea(selection.task);
  const selectedSet = new Set(selectedFiles);
  const directSignals = new Set(
    [
      ...selection.signals.changedFiles,
      ...selection.signals.importNeighbors,
      ...selection.signals.keywordMatches
    ].filter(isVisibleContextTreePath)
  );
  const scopedPrefixes = deriveContextTreeScopedPrefixes(
    [...directSignals].filter((file) => classifyFileArea(file) === taskArea),
    taskArea
  );

  const statusByFile = new Map<string, KiwiControlContextTreeStatus>();
  for (const file of observedFiles) {
    if (selectedSet.has(file)) {
      statusByFile.set(file, "selected");
      continue;
    }

    statusByFile.set(
      file,
      isExcludedContextTreeFile(file, taskArea, scopedPrefixes) ? "excluded" : "candidate"
    );
  }

  const root = new Map<string, MutableContextTreeNode>();
  for (const file of sortContextTreePaths([...statusByFile.keys()])) {
    insertContextTreePath(root, file, statusByFile.get(file) ?? "candidate");
  }

  const counts = [...statusByFile.values()].reduce(
    (summary, status) => {
      if (status === "selected") summary.selectedCount += 1;
      if (status === "candidate") summary.candidateCount += 1;
      if (status === "excluded") summary.excludedCount += 1;
      return summary;
    },
    { selectedCount: 0, candidateCount: 0, excludedCount: 0 }
  );

  return {
    nodes: [...root.values()].map((node) => finalizeContextTreeNode(node, taskArea, scopedPrefixes)),
    ...counts
  };
}

interface MutableContextTreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  status: KiwiControlContextTreeStatus;
  children: Map<string, MutableContextTreeNode>;
}

function collectObservedTreeFiles(selection: ContextSelectionState): string[] {
  const seen = new Set<string>();
  const orderedSignals = [
    selection.include,
    selection.signals.changedFiles,
    selection.signals.keywordMatches,
    selection.signals.importNeighbors,
    selection.signals.proximityFiles.slice(0, 10),
    selection.signals.recentFiles.slice(0, 12)
  ];

  for (const files of orderedSignals) {
    for (const file of files) {
      if (!isVisibleContextTreePath(file)) {
        continue;
      }
      seen.add(file);
    }
  }

  return [...seen];
}

function isVisibleContextTreePath(filePath: string): boolean {
  return !filePath.startsWith(".agent/");
}

function insertContextTreePath(
  root: Map<string, MutableContextTreeNode>,
  filePath: string,
  status: KiwiControlContextTreeStatus
): void {
  const parts = filePath.split("/").filter(Boolean);
  let currentLevel = root;
  let currentPath = "";

  for (const [index, part] of parts.entries()) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const isFile = index === parts.length - 1;
    let node = currentLevel.get(part);

    if (!node) {
      node = {
        name: part,
        path: currentPath,
        kind: isFile ? "file" : "directory",
        status: isFile ? status : "excluded",
        children: new Map<string, MutableContextTreeNode>()
      };
      currentLevel.set(part, node);
    }

    if (isFile) {
      node.status = status;
      return;
    }

    currentLevel = node.children;
  }
}

function finalizeContextTreeNode(
  node: MutableContextTreeNode,
  taskArea: ReturnType<typeof deriveTaskArea>,
  scopedPrefixes: string[]
): KiwiControlContextTreeNode {
  const children = [...node.children.values()]
    .map((child) => finalizeContextTreeNode(child, taskArea, scopedPrefixes))
    .sort(compareContextTreeNodes);

  if (node.kind === "file") {
    return {
      name: node.name,
      path: node.path,
      kind: node.kind,
      status: node.status,
      expanded: false,
      children: []
    };
  }

  const status = children.some((child) => child.status === "selected")
    ? "selected"
    : children.some((child) => child.status === "candidate")
      ? "candidate"
      : "excluded";

  return {
    name: node.name,
    path: node.path,
    kind: "directory",
    status,
    expanded: shouldExpandContextTreeDirectory(node.path, taskArea, scopedPrefixes, children),
    children
  };
}

function compareContextTreeNodes(left: KiwiControlContextTreeNode, right: KiwiControlContextTreeNode): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  const rank = { selected: 0, candidate: 1, excluded: 2 };
  const rankDelta = rank[left.status] - rank[right.status];
  if (rankDelta !== 0) {
    return rankDelta;
  }

  return left.name.localeCompare(right.name);
}

function sortContextTreePaths(files: string[]): string[] {
  return [...files].sort((left, right) => {
    const leftParts = left.split("/").length;
    const rightParts = right.split("/").length;
    if (leftParts !== rightParts) {
      return leftParts - rightParts;
    }
    return left.localeCompare(right);
  });
}

function deriveContextTreeScopedPrefixes(
  files: string[],
  taskArea: ReturnType<typeof deriveTaskArea>
): string[] {
  if (taskArea !== "application" && taskArea !== "docs") {
    return [];
  }

  const prefixes = new Set<string>();
  for (const file of files) {
    const directory = path.dirname(file).replace(/\\/g, "/");
    if (!directory || directory === ".") {
      continue;
    }
    prefixes.add(directory);
  }

  return [...prefixes];
}

function isExcludedContextTreeFile(
  filePath: string,
  taskArea: ReturnType<typeof deriveTaskArea>,
  scopedPrefixes: string[]
): boolean {
  if (isAuthorityInstructionTreeFile(filePath)) {
    return true;
  }

  if (classifyFileArea(filePath) !== taskArea) {
    return true;
  }

  if (scopedPrefixes.length > 0 && !matchesContextTreePrefixes(filePath, scopedPrefixes)) {
    return true;
  }

  return false;
}

function matchesContextTreePrefixes(filePath: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) {
    return true;
  }

  const normalized = filePath.replace(/\\/g, "/");
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function isAuthorityInstructionTreeFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const basename = path.basename(normalized);

  return basename === "agents.md"
    || basename === "claude.md"
    || basename === "copilot-instructions.md"
    || normalized.startsWith(".github/instructions/")
    || normalized.startsWith(".github/agents/");
}

function shouldExpandContextTreeDirectory(
  directoryPath: string,
  taskArea: ReturnType<typeof deriveTaskArea>,
  scopedPrefixes: string[],
  children: KiwiControlContextTreeNode[]
): boolean {
  if (taskArea === "docs" && (directoryPath === "docs" || directoryPath.startsWith("docs/"))) {
    return true;
  }

  if (taskArea === "application" && scopedPrefixes.some((prefix) => prefix === directoryPath || prefix.startsWith(`${directoryPath}/`))) {
    return true;
  }

  if (children.some((child) => child.status === "selected") && classifyFileArea(directoryPath) === taskArea) {
    return true;
  }

  return false;
}
