import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { renderTopBarView } from "./ui/TopBar.js";
import { renderGraphViewPanel } from "./ui/GraphPanel.js";
import { renderContextTreePanel } from "./ui/ContextTreePanel.js";
import { renderExecutionPlanPanelView } from "./ui/ExecutionPlanPanel.js";
import { renderInspectorPanel } from "./ui/InspectorPanel.js";
import { renderMachinePanelView } from "./ui/MachinePanel.js";
import {
  buildOnboardingPanelModel,
  renderOnboardingPanelView
} from "./ui/OnboardingPanel.js";
import {
  buildBlockedWorkflowEntries,
  buildExplainCommandEntries,
  buildExplainSelectionEntries,
  buildTerminalHelpEntries,
  formatCliCommand
} from "./ui/command-help.js";
import {
  buildDecisionSummary as buildDecisionSummaryModel,
  buildExecutionActionCluster,
  buildExecutionPlanPanelContextModel,
  buildInspectorContextModel,
  buildOverviewHeroState,
  buildPackPanelState,
  buildPrimaryBannerState,
  buildTopMetadataGroups,
  isInspectorDefaultOpen
} from "./ui/view-models.js";
import {
  buildActiveTargetHint as buildActiveTargetHintModel,
  buildBridgeNote as buildBridgeNoteModel,
  buildFinalReadyDetail as buildFinalReadyDetailModel,
  buildLoadStatus as buildLoadStatusModel,
  deriveReadinessSummary as deriveReadinessSummaryModel,
  type ReadinessEnv
} from "./ui/readiness.js";
import {
  buildBlockedActionGuidance,
  deriveExecutionPlanFailureGuidance,
  deriveRepoRecoveryGuidance
} from "./ui/guidance.js";
import {
  deriveGraphProjection,
  materializeGraphModel,
  resolveProjectedNodePosition,
  type GraphProjection
} from "./ui/graph-model.js";
import type {
  CommandComposerMode,
  CommandState,
  ContextOverrideMode,
  DesktopReadinessState,
  DecisionSummary,
  DisplayExecutionPlanStep,
  FocusedItem,
  InteractiveGraphModel,
  RecoveryGuidance,
  UiCommandName,
  UiMode,
  ThemeMode,
  CliCommandResultPayload,
  RenderHelperSet
} from "./ui/contracts.js";

declare global {
  interface Window {
    __KIWI_BOOT_API__?: {
      mounted: boolean;
      renderMessage: (title: string, detail: string) => void;
      renderError: (detail: string) => void;
      hide: () => void;
    };
  }
}

type PanelItem = {
  label: string;
  value: string;
  tone?: "default" | "warn";
};

type ValidationIssue = {
  level: "error" | "warn";
  message: string;
  filePath?: string;
};

type RepoControlMode =
  | "bridge-unavailable"
  | "repo-not-initialized"
  | "initialized-invalid"
  | "initialized-with-warnings"
  | "healthy";

type RepoControlLoadState = {
  source: "fresh" | "warm-snapshot" | "stale-snapshot" | "bridge-fallback";
  freshness: "fresh" | "warm" | "stale" | "failed";
  generatedAt: string;
  snapshotSavedAt: string | null;
  snapshotAgeMs: number | null;
  detail: string;
};

type KiwiControlContextTreeStatus = "selected" | "candidate" | "excluded";

type KiwiControlContextTreeNode = {
  name: string;
  path: string;
  kind: "directory" | "file";
  status: KiwiControlContextTreeStatus;
  expanded: boolean;
  children: KiwiControlContextTreeNode[];
};

type KiwiControlContextTree = {
  nodes: KiwiControlContextTreeNode[];
  selectedCount: number;
  candidateCount: number;
  excludedCount: number;
};

type KiwiControlContextView = {
  task: string | null;
  selectedFiles: string[];
  excludedPatterns: string[];
  reason: string | null;
  confidence: string | null;
  confidenceDetail: string | null;
  keywordMatches: string[];
  tree: KiwiControlContextTree;
  timestamp: string | null;
};

type KiwiControlTokenAnalytics = {
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
};

type KiwiControlEfficiency = {
  instructionsGenerated: boolean;
  instructionsPath: string | null;
};

type NextActionItem = {
  action: string;
  file: string | null;
  command: string | null;
  reason: string;
  priority: "critical" | "high" | "normal" | "low";
};

type KiwiControlNextActions = {
  actions: NextActionItem[];
  summary: string;
};

type KiwiControlFeedback = {
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
};

type KiwiControlExecution = {
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
};

type KiwiControlWastedFiles = {
  files: Array<{ file: string; tokens: number; reason: string }>;
  totalWastedTokens: number;
  removalSavingsPercent: number;
};

type KiwiControlHeavyDirectories = {
  directories: Array<{
    directory: string;
    tokens: number;
    fileCount: number;
    percentOfRepo: number;
    suggestion: string;
  }>;
};

type FileAnalysisEntry = {
  file: string;
  reasons: string[];
  score?: number;
  note?: string;
  selectionWhy?: string;
  dependencyChain?: string[];
};

type SkippedPathEntry = {
  path: string;
  reason: string;
  estimated?: boolean;
};

type ContextTraceStep = {
  step: string;
  summary: string;
  filesAdded: string[];
  filesRemoved?: string[];
};

type KiwiControlIndexing = {
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
};

type KiwiControlFileAnalysis = {
  totalFiles: number;
  scannedFiles: number;
  skippedFiles: number;
  selectedFiles: number;
  excludedFiles: number;
  selected: FileAnalysisEntry[];
  excluded: FileAnalysisEntry[];
  skipped: SkippedPathEntry[];
};

type KiwiControlContextTrace = {
  initialSignals: {
    changedFiles: string[];
    recentFiles: string[];
    importNeighbors: string[];
    proximityFiles: string[];
    keywordMatches: string[];
    repoContextFiles: string[];
  };
  expansionSteps: ContextTraceStep[];
  honesty: {
    heuristic: boolean;
    lowConfidence: boolean;
    partialScan: boolean;
  };
};

type KiwiControlTokenBreakdown = {
  partialScan: boolean;
  categories: Array<{
    category: string;
    estimated_tokens_avoided: number;
    file_count: number;
    basis: "measured" | "heuristic";
    note: string;
  }>;
};

type KiwiControlDecisionLogic = {
  summary: string;
  decisionPriority: "critical" | "high" | "normal" | "low";
  inputSignals: string[];
  reasoningChain: string[];
  ignoredSignals: string[];
};

type RuntimeLifecycleEvent = {
  timestamp: string;
  type: string;
  stage: string;
  status: "ok" | "warn" | "error";
  summary: string;
  task: string | null;
  command: string | null;
  validation: string | null;
  failureReason: string | null;
  files: string[];
};

type KiwiControlRuntimeLifecycle = {
  currentTask: string | null;
  currentStage: string;
  validationStatus: "ok" | "warn" | "error" | null;
  nextSuggestedCommand: string | null;
  nextRecommendedAction: string | null;
  recentEvents: RuntimeLifecycleEvent[];
};

type KiwiControlExecutionEvent = {
  eventId: number | null;
  revision: number;
  operationId: string | null;
  eventType: string;
  lifecycle: "idle" | "packet_created" | "queued" | "running" | "blocked" | "failed" | "completed";
  task: string | null;
  sourceCommand: string | null;
  reason: string | null;
  nextCommand: string | null;
  blockedBy: string[];
  artifacts: Record<string, string[]>;
  actor: string;
  recordedAt: string;
};

type KiwiControlExecutionEvents = {
  source: "runtime" | "compatibility" | "unavailable";
  latestRevision: number | null;
  recentEvents: KiwiControlExecutionEvent[];
};

type SkillMatch = {
  skillId: string;
  name: string;
  score: number;
  description: string;
  triggerConditions: string[];
  executionTemplate: string[];
};

type WorkflowStep = {
  stepId: string;
  action: string;
  status: "pending" | "running" | "success" | "failed";
  input: string | null;
  expectedOutput: string | null;
  output: string | null;
  validation: string | null;
  failureReason: string | null;
  attemptCount: number;
  retryCount: number;
  files: string[];
  skillsApplied: string[];
  tokenUsage: {
    source: "measured" | "estimated" | "mixed" | "none";
    measuredTokens: number | null;
    estimatedTokens: number | null;
    note: string;
  };
  result: {
    ok: boolean | null;
    summary: string | null;
    validation: string | null;
    failureReason: string | null;
    suggestedFix: string | null;
    retryCommand: string | null;
  };
  updatedAt: string | null;
};

type KiwiControlMeasuredUsage = {
  available: boolean;
  source: "ccusage-session" | "execution-log" | "mixed" | "none";
  totalTokens: number;
  totalRuns: number;
  runs: Array<{
    runId: string;
    source: "ccusage-session" | "execution-log";
    workflow: string;
    task: string | null;
    timestamp: string;
    totalTokens: number;
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    reasoningOutputTokens: number | null;
    files: string[];
  }>;
  workflows: Array<{ workflow: string; tokens: number; runs: number }>;
  files: Array<{ file: string; tokens: number; runs: number; attribution: "allocated" }>;
  note: string;
};

type KiwiControlSkills = {
  activeSkills: SkillMatch[];
  suggestedSkills: SkillMatch[];
  totalSkills: number;
};

type KiwiControlWorkflow = {
  task: string | null;
  status: "pending" | "running" | "success" | "failed";
  currentStepId: string | null;
  steps: WorkflowStep[];
};

type KiwiControlExecutionTrace = {
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
    result: {
      ok: boolean | null;
      summary: string | null;
      validation: string | null;
      failureReason: string | null;
      suggestedFix: string | null;
      retryCommand: string | null;
    };
    output: string | null;
    validation: string | null;
    failureReason: string | null;
    updatedAt: string | null;
  }>;
  whyThisHappened: string;
};

type ExecutionPlanStep = {
  id: string;
  description: string;
  command: string;
  expectedOutput: string;
  validation: string;
  status: "pending" | "running" | "success" | "failed";
  result: {
    ok: boolean | null;
    summary: string | null;
    validation: string | null;
    failureReason: string | null;
    suggestedFix: string | null;
  };
  fixCommand: string | null;
  retryCommand: string | null;
};

type KiwiControlExecutionPlan = {
  summary: string;
  state: string;
  currentStepIndex: number;
  confidence: string | null;
  risk: "low" | "medium" | "high";
  blocked: boolean;
  steps: ExecutionPlanStep[];
  nextCommands: string[];
  lastError: {
    errorType: string;
    reason: string;
    fixCommand: string;
    retryCommand: string;
  } | null;
};

type KiwiControlRepoIntelligence = {
  reviewPackAvailable: boolean;
  reviewPackPath: string | null;
  reviewPackSummary: string | null;
};

type KiwiControlState = {
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
  executionEvents: KiwiControlExecutionEvents;
  measuredUsage: KiwiControlMeasuredUsage;
  skills: KiwiControlSkills;
  workflow: KiwiControlWorkflow;
  executionTrace: KiwiControlExecutionTrace;
  executionPlan: KiwiControlExecutionPlan;
  repoIntelligence: KiwiControlRepoIntelligence;
};

type RepoControlState = {
  targetRoot: string;
  loadState: RepoControlLoadState;
  profileName: string;
  executionMode: string;
  projectType: string;
  repoState: {
    mode: RepoControlMode;
    title: string;
    detail: string;
    sourceOfTruthNote: string;
  };
  executionState: {
    revision: number;
    operationId: string | null;
    task: string | null;
    sourceCommand: string | null;
    lifecycle: "idle" | "packet-created" | "queued" | "running" | "blocked" | "failed" | "completed";
    reason: string | null;
    nextCommand: string | null;
    blockedBy: string[];
    lastUpdatedAt: string | null;
  };
  readiness: {
    label: string;
    tone: "ready" | "blocked" | "failed";
    detail: string;
    nextCommand: string | null;
  };
  runtimeIdentity: {
    launchMode: string;
    callerSurface: string;
    packagingSourceCategory: string;
    binaryPath: string;
    binarySha256: string;
    runtimeVersion: string;
    targetTriple: string;
    startedAt: string;
    metadataPath: string;
  } | null;
  derivedFreshness: Array<{
    outputName: string;
    path: string;
    freshness: string;
    sourceRevision: number | null;
    generatedAt: string | null;
    invalidatedAt: string | null;
    lastError: string | null;
  }>;
  runtimeDecision: {
    currentStepId: "prepare" | "generate_packets" | "execute_packet" | "validate" | "checkpoint" | "handoff" | "idle";
    currentStepLabel: string;
    currentStepStatus: "pending" | "running" | "success" | "failed";
    nextCommand: string | null;
    readinessLabel: string;
    readinessTone: "ready" | "blocked" | "failed";
    readinessDetail: string;
    nextAction: {
      action: string;
      command: string | null;
      reason: string;
      priority: "critical" | "high" | "normal" | "low";
    } | null;
    recovery: {
      kind: "blocked" | "failed";
      reason: string;
      fixCommand: string | null;
      retryCommand: string | null;
    } | null;
    updatedAt?: string;
    decisionSource: string;
  };
  repoOverview: PanelItem[];
  continuity: PanelItem[];
  memoryBank: Array<{ label: string; path: string; present: boolean }>;
  specialists: {
    activeSpecialist: string;
    recommendedSpecialist: string;
    available?: Array<{
      specialistId: string;
      name?: string;
      purpose?: string;
      aliases?: string[];
      allowedProfiles?: string[];
      preferredTools?: string[];
      riskPosture?: string;
    }>;
    activeProfile?: {
      specialistId: string;
      name?: string;
      purpose?: string;
      aliases?: string[];
      preferredTools?: string[];
      riskPosture?: string;
    } | null;
    recommendedProfile?: {
      specialistId: string;
      name?: string;
      purpose?: string;
      aliases?: string[];
      preferredTools?: string[];
      riskPosture?: string;
    } | null;
    handoffTargets: string[];
    safeParallelHint: string;
  };
  mcpPacks: {
    selectedPack: { id: string; name?: string; description: string; realismNotes?: string[]; guidance?: string[] };
    selectedPackSource: "runtime-explicit" | "heuristic-default";
    explicitSelection: string | null;
    suggestedPack: { id: string; name?: string; description: string; realismNotes?: string[]; guidance?: string[] };
    available: Array<{
      id: string;
      name?: string;
      description: string;
      realismNotes: string[];
      guidance?: string[];
      executable: boolean;
      unavailablePackReason: string | null;
      allowedCapabilityIds: string[];
      preferredCapabilityIds: string[];
      unavailableCapabilityIds: string[];
    }>;
    compatibleCapabilities: Array<{
      id: string;
      category: string;
      purpose: string;
      trustLevel: "low" | "medium" | "high";
      readOnly: boolean;
      writeCapable: boolean;
      approvalRequired: boolean;
      usageGuidance: string[];
      antiPatterns: string[];
    }>;
    effectiveCapabilityIds: string[];
    preferredCapabilityIds: string[];
    executable: boolean;
    unavailablePackReason: string | null;
    capabilityStatus: "compatible" | "limited" | "blocked";
    note: string;
  };
  validation: {
    ok: boolean;
    errors: number;
    warnings: number;
    issues: ValidationIssue[];
  };
  ecosystem: {
    artifactType: string;
    version: number;
    timestamp: string;
    tools: Array<{ id: string; name: string; category: string; description: string; source: string; readOnly: boolean }>;
    workflows: Array<{ id: string; name: string; description: string; source: string }>;
    capabilities: Array<{ id: string; name: string; surface: string; description: string; source: string }>;
    notes: string[];
  };
  machineAdvisory: {
    artifactType: string;
    version: number;
    generatedBy: string;
    windowDays: number;
    updatedAt: string;
    stale: boolean;
    sections: {
      inventory: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
      mcpInventory: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
      optimizationLayers: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
      setupPhases: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
      configHealth: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
      usage: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
      guidance: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
    };
    inventory: Array<{ name: string; description: string; phase: string; installed: boolean; version: string }>;
    mcpInventory: {
      claudeTotal: number;
      codexTotal: number;
      copilotTotal: number;
      tokenServers: Array<{ name: string; claude: boolean; codex: boolean; copilot: boolean }>;
    };
    optimizationLayers: Array<{ name: string; savings: string; claude: boolean; codex: boolean; copilot: boolean }>;
    setupPhases: Array<{
      phase: string;
      items: Array<{ name: string; description: string; location: string; active: boolean }>;
    }>;
    configHealth: Array<{ path: string; healthy: boolean; description: string }>;
    skillsCount: number;
    copilotPlugins: string[];
    usage: {
      days: number;
      claude: {
        available: boolean;
        days: Array<{ date: string; inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalTokens: number; totalCost: number | null; modelsUsed: string[] }>;
        totals: { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalTokens: number; totalCost: number | null; cacheHitRatio: number | null };
        note: string;
      };
      codex: {
        available: boolean;
        days: Array<{ date: string; inputTokens: number; outputTokens: number; cachedInputTokens: number; reasoningOutputTokens: number; sessions: number }>;
        totals: { inputTokens: number; outputTokens: number; cachedInputTokens: number; reasoningOutputTokens: number; sessions: number; totalTokens: number; cacheHitRatio: number | null };
        note: string;
      };
      copilot: {
        available: boolean;
        note: string;
      };
    };
    optimizationScore: {
      planning: { label: "planning" | "execution" | "assistant"; score: number; earnedPoints: number; maxPoints: number; activeSignals: string[]; missingSignals: string[] };
      execution: { label: "planning" | "execution" | "assistant"; score: number; earnedPoints: number; maxPoints: number; activeSignals: string[]; missingSignals: string[] };
      assistant: { label: "planning" | "execution" | "assistant"; score: number; earnedPoints: number; maxPoints: number; activeSignals: string[]; missingSignals: string[] };
    };
    setupSummary: {
      installedTools: { readyCount: number; totalCount: number };
      healthyConfigs: { readyCount: number; totalCount: number };
      activeTokenLayers: string[];
      readyRuntimes: { planning: boolean; execution: boolean; assistant: boolean };
    };
    systemHealth: {
      criticalCount: number;
      warningCount: number;
      okCount: number;
    };
    guidance: Array<{
      id: string;
      section: "inventory" | "mcpInventory" | "optimizationLayers" | "setupPhases" | "configHealth" | "usage" | "guidance";
      priority: "critical" | "recommended" | "optional";
      group: "critical-issues" | "improvements" | "optional-optimizations";
      severity: "info" | "warn";
      message: string;
      impact: string;
      reason?: string;
      fixCommand?: string;
      hintCommand?: string;
    }>;
    note: string;
  };
  kiwiControl?: KiwiControlState;
};

type LaunchRequestPayload = {
  requestId: string;
  targetRoot: string;
  launchSource?: "source-bundle" | "installed-bundle" | "fallback-launcher" | "existing-session";
};

type RepoStateChangedPayload = {
  targetRoot: string;
  revision: number;
};

type DesktopRuntimeInfo = {
  appVersion: string;
  bundleId: string;
  executablePath: string;
  buildSource: "source-bundle" | "installed-bundle" | "fallback-launcher";
  runtimeMode: "installed-user" | "developer-source";
  receiptPath: string;
  cli: {
    bundledInstallerAvailable: boolean;
    bundledNodePath: string | null;
    installBinDir: string;
    installRoot: string;
    installScope: "machine" | "user" | "unknown";
    installed: boolean;
    installedCommandPath: string | null;
    verificationStatus: "passed" | "failed" | "not-run" | "blocked";
    verificationDetail: string;
    verificationCommandPath: string | null;
    requiresNewTerminal: boolean;
  };
  runtimeIdentity?: RepoControlState["runtimeIdentity"];
  renderProbeView?: string | null;
};

type CliInstallResult = {
  detail: string;
  installBinDir: string;
  installRoot: string;
  installScope: "machine" | "user" | "unknown";
  installedCommandPath: string | null;
  verificationStatus: "passed" | "failed" | "not-run" | "blocked";
  verificationDetail: string;
  verificationCommandPath: string | null;
  requiresNewTerminal: boolean;
  pathChanged: boolean;
  usedBundledNode: boolean;
};

type BrowserPreviewPayload = {
  state: RepoControlState;
  runtimeInfo?: DesktopRuntimeInfo | null;
  activeView?: NavView | null;
  activeMode?: UiMode | null;
};

type MachineSectionName =
  | "inventory"
  | "mcpInventory"
  | "optimizationLayers"
  | "setupPhases"
  | "configHealth"
  | "usage"
  | "guidance";

type MachineSectionPayload = {
  section: MachineSectionName;
  meta: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string };
  data: unknown;
};

type NavView = "overview" | "context" | "graph" | "tokens" | "feedback" | "mcps" | "specialists" | "system" | "validation" | "machine";
type LogTab = "validation" | "history" | "logs";
type ValidationTab = "all" | "issues" | "pending";
type HandoffTab = "handoffs" | "checkpoints";
type PlatformMode = "macos" | "windows" | "linux";

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: iconSvg("overview") },
  { id: "context", label: "Context", icon: iconSvg("context") },
  { id: "graph", label: "Graph", icon: iconSvg("graph") },
  { id: "tokens", label: "Tokens", icon: iconSvg("tokens") },
  { id: "feedback", label: "Feedback", icon: iconSvg("feedback") },
  { id: "mcps", label: "MCPs", icon: iconSvg("mcps") },
  { id: "specialists", label: "Specialists", icon: iconSvg("specialists") },
  { id: "system", label: "System", icon: iconSvg("system") },
  { id: "validation", label: "Validation", icon: iconSvg("validation") },
  { id: "machine", label: "Machine", icon: iconSvg("system") }
];

const BRIDGE_UNAVAILABLE_NEXT_STEP = "Confirm kiwi-control works in Terminal, then run kc ui again.";
const AUTO_REFRESH_INTERVAL_MS = 45_000;
const AUTO_REFRESH_MIN_AGE_MS = 30_000;
const READY_STATE_PULSE_MS = 4_500;
const GRAPH_INTERACTION_SETTLE_MS = 180;
const MACHINE_LIGHTWEIGHT_SECTIONS: MachineSectionName[] = [
  "inventory",
  "configHealth",
  "mcpInventory",
];
const MACHINE_HEAVY_SECTIONS: MachineSectionName[] = [
  "guidance",
  "optimizationLayers",
  "setupPhases",
  "usage"
];

const EMPTY_KC: KiwiControlState = {
  contextView: {
    task: null,
    selectedFiles: [],
    excludedPatterns: [],
    reason: null,
    confidence: null,
    confidenceDetail: null,
    keywordMatches: [],
    tree: { nodes: [], selectedCount: 0, candidateCount: 0, excludedCount: 0 },
    timestamp: null
  },
  tokenAnalytics: {
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
  },
  efficiency: {
    instructionsGenerated: false,
    instructionsPath: null
  },
  nextActions: {
    actions: [],
    summary: ""
  },
  feedback: {
    totalRuns: 0,
    successRate: 0,
    adaptationLevel: "limited",
    note: "Adaptive feedback is idle.",
    basedOnPastRuns: false,
    reusedPattern: null,
    similarTasks: [],
    recentEntries: [],
    topBoostedFiles: [],
    topPenalizedFiles: []
  },
  execution: {
    totalExecutions: 0,
    totalTokensUsed: 0,
    averageTokensPerRun: 0,
    successRate: 0,
    recentExecutions: [],
    tokenTrend: "insufficient-data"
  },
  wastedFiles: {
    files: [],
    totalWastedTokens: 0,
    removalSavingsPercent: 0
  },
  heavyDirectories: {
    directories: []
  },
  indexing: {
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
  },
  fileAnalysis: {
    totalFiles: 0,
    scannedFiles: 0,
    skippedFiles: 0,
    selectedFiles: 0,
    excludedFiles: 0,
    selected: [],
    excluded: [],
    skipped: []
  },
  contextTrace: {
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
  },
  tokenBreakdown: {
    partialScan: false,
    categories: []
  },
  decisionLogic: {
    summary: "",
    decisionPriority: "low",
    inputSignals: [],
    reasoningChain: [],
    ignoredSignals: []
  },
  runtimeLifecycle: {
    currentTask: null,
    currentStage: "idle",
    validationStatus: null,
    nextSuggestedCommand: null,
    nextRecommendedAction: null,
    recentEvents: []
  },
  executionEvents: {
    source: "unavailable",
    latestRevision: null,
    recentEvents: []
  },
  measuredUsage: {
    available: false,
    source: "none",
    totalTokens: 0,
    totalRuns: 0,
    runs: [],
    workflows: [],
    files: [],
    note: "No measured token usage is available yet."
  },
  skills: {
    activeSkills: [],
    suggestedSkills: [],
    totalSkills: 0
  },
  workflow: {
    task: null,
    status: "pending",
    currentStepId: null,
    steps: []
  },
  executionTrace: {
    steps: [],
    whyThisHappened: ""
  },
  executionPlan: {
    summary: "",
    state: "idle",
    currentStepIndex: 0,
    confidence: null,
    risk: "low",
    blocked: false,
    steps: [],
    nextCommands: [],
    lastError: null
  },
  repoIntelligence: {
    reviewPackAvailable: false,
    reviewPackPath: null,
    reviewPackSummary: null
  }
};

const app = document.querySelector<HTMLDivElement>("#app");
const bootOverlay = document.querySelector<HTMLDivElement>("#boot-overlay");

if (!app) {
  throw new Error("App root not found");
}

let activeView: NavView = "overview";
let activeLogTab: LogTab = "history";
let activeValidationTab: ValidationTab = "all";
let activeHandoffTab: HandoffTab = "handoffs";
let isLogDrawerOpen = false;
let isInspectorOpen = false;
let inspectorPreferenceLocked = false;
let currentState = buildBridgeUnavailableState("");
let activeTheme: ThemeMode = loadStoredTheme();
let activeMode: UiMode = "execution";
const platformMode = detectPlatform();
const RUNTIME_REVISION_FALLBACK_POLL_MS = 1_000;

let shellElement!: HTMLElement;
let railNavElement!: HTMLElement;
let bridgeNoteElement!: HTMLElement;
let topbarElement!: HTMLElement;
let centerMainElement!: HTMLElement;
let inspectorElement!: HTMLElement;
let logDrawerElement!: HTMLElement;
let workspaceSurfaceElement!: HTMLElement;

let currentTargetRoot = "";
let isLoadingRepoState = false;
let isRefreshingFreshRepoState = false;
let queuedLaunchRequest: LaunchRequestPayload | null = null;
let queuedRepoStateChange: RepoStateChangedPayload | null = null;
let lastHandledLaunchRequestId = "";
let machineHydrationRound = 0;
let machineHydrationInFlight = false;
let machineHydrationActiveSections = new Set<MachineSectionName>();
let hydratedMachineSections = new Set<MachineSectionName>();
let currentLoadSource: "cli" | "manual" | "auto" | null = null;
let desktopRuntimeInfo: DesktopRuntimeInfo | null = null;
let defaultCliInstallAttempted = false;
let defaultCliInstallInFlight = false;
let lastRepoRefreshAt = 0;
let lastRepoLoadFailure: string | null = null;
let renderQueued = false;
let centerRenderQueued = false;
let deferredMachineHydrationTimer: number | null = null;
let deferredShellRenderTimer: number | null = null;
let pendingShellRenderAfterInteraction = false;
let lastGraphInteractionAt = 0;
let activeInteractiveTargetRoot = "";
let lastReadyStateSignal:
  | {
      at: number;
      detail: string;
    }
  | null = null;
let lastRenderProbeFingerprint = "";
let readyStateTimer: number | null = null;
let commandState: CommandState = {
  activeCommand: null,
  loading: false,
  composer: null,
  draftValue: "",
  lastResult: null,
  lastError: null
};
let lastBlockedActionGuidance: RecoveryGuidance | null = null;
let focusedItem: FocusedItem | null = null;
let contextOverrides = new Map<string, ContextOverrideMode>();
let contextOverrideHistory: Array<Map<string, ContextOverrideMode>> = [];
let graphNodePositions = new Map<string, { x: number; y: number }>();
let graphPan = { x: 0, y: 0 };
let graphZoom = 1;
let graphDepth = 2;
let graphSelectedPath: string | null = null;
let graphInteraction:
  | { mode: "pan"; lastClientX: number; lastClientY: number }
  | { mode: "drag-node"; path: string; lastClientX: number; lastClientY: number }
  | null = null;
let localPlanOrder: string[] = [];
let localPlanSkipped = new Set<string>();
let localPlanEdits = new Map<string, { label: string; note: string }>();
let editingPlanStepId: string | null = null;
let editingPlanDraft = "";
let approvalMarkers = new Map<string, "approved" | "rejected">();
let contextOverrideVersion = 0;
let derivedTreeCache:
  | {
      baseTree: KiwiControlContextTree;
      overrideVersion: number;
      tree: KiwiControlContextTree;
      flatNodes: KiwiControlContextTreeNode[];
    }
  | null = null;
let graphProjectionCache:
  | {
      baseTree: KiwiControlContextTree;
      overrideVersion: number;
      targetRoot: string;
      graphDepth: number;
      focusPath: string | null;
      selectedAnalysis: KiwiControlFileAnalysis["selected"];
      projection: GraphProjection;
    }
  | null = null;
let activeGraphProjection: GraphProjection | null = null;
let graphPatchQueued = false;
let pendingGraphPatchPaths = new Set<string>();
let graphViewportElement: SVGGElement | null = null;
let renderActionInFlight = false;
let pendingCenterScrollReset = false;

function syncInspectorOpenState(): void {
  if (!inspectorPreferenceLocked) {
    isInspectorOpen = isInspectorDefaultOpen(activeView, activeMode);
  }
}

try {
  app.innerHTML = buildShellHtml();

  shellElement = requireElement<HTMLElement>(".kc-shell");
  railNavElement = requireElement<HTMLElement>("#rail-nav");
  bridgeNoteElement = requireElement<HTMLElement>("#bridge-note");
  topbarElement = requireElement<HTMLElement>("#topbar");
  centerMainElement = requireElement<HTMLElement>("#center-main");
  inspectorElement = requireElement<HTMLElement>("#inspector");
  logDrawerElement = requireElement<HTMLElement>("#log-drawer");
  workspaceSurfaceElement = requireElement<HTMLElement>("#workspace-surface");

  applyChromePreferences();
  renderState(currentState);
  bridgeNoteElement.textContent = buildBridgeNote(currentState, "shell");
  finalizeInitialRender();

  app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  const mouseEvent = event as MouseEvent;

  const viewButton = target.closest<HTMLElement>("[data-view]");
  if (viewButton?.dataset.view) {
    const nextView = viewButton.dataset.view as NavView;
    if (nextView !== activeView) {
      activeView = nextView;
      pendingCenterScrollReset = true;
      syncInspectorOpenState();
    }
    scheduleRenderState();
    scheduleMachineHydrationForView(activeView, false);
    return;
  }

  if (target.closest("[data-toggle-logs]")) {
    isLogDrawerOpen = !isLogDrawerOpen;
    scheduleRenderState();
    return;
  }

  if (target.closest("[data-toggle-inspector]")) {
    inspectorPreferenceLocked = true;
    isInspectorOpen = !isInspectorOpen;
    scheduleRenderState();
    return;
  }

  const logTabButton = target.closest<HTMLElement>("[data-log-tab]");
  if (logTabButton?.dataset.logTab) {
    activeLogTab = logTabButton.dataset.logTab as LogTab;
    scheduleRenderState();
    return;
  }

  const validationTabButton = target.closest<HTMLElement>("[data-validation-tab]");
  if (validationTabButton?.dataset.validationTab) {
    activeValidationTab = validationTabButton.dataset.validationTab as ValidationTab;
    scheduleRenderState();
    return;
  }

  if (target.closest("[data-theme-toggle]")) {
    activeTheme = activeTheme === "dark" ? "light" : "dark";
    applyChromePreferences();
    scheduleRenderState();
    return;
  }

  const modeButton = target.closest<HTMLElement>("[data-ui-mode]");
  if (modeButton?.dataset.uiMode) {
    activeMode = modeButton.dataset.uiMode as UiMode;
    if (activeMode === "execution") {
      isLogDrawerOpen = false;
      activeLogTab = "history";
    }
    syncInspectorOpenState();
    scheduleRenderState();
    return;
  }

  if (handleInteractiveClick(mouseEvent, target)) {
    return;
  }

  if (target.closest("[data-reload-state]")) {
    if (currentTargetRoot) {
      void loadAndRenderTarget(currentTargetRoot, "manual");
    }
  }
  });

  app.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!target) {
      return;
    }
    if (target.matches("[data-command-draft]")) {
      commandState.draftValue = target.value;
      return;
    }
    if (target.matches("[data-plan-edit-input]")) {
      editingPlanDraft = target.value;
    }
  });

  app.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    if (target.matches("[data-command-draft]")) {
      commandState.draftValue = target.value;
    }
  });

  app.addEventListener("wheel", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target || !target.closest("[data-graph-surface]")) {
      return;
    }
    event.preventDefault();
    markGraphInteractionActivity();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    graphZoom = Math.max(0.65, Math.min(2.4, Number((graphZoom + delta).toFixed(2))));
    if (!updateGraphViewportTransform()) {
      scheduleCenterRender();
    }
  }, { passive: false });

  app.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const node = target.closest<HTMLElement>("[data-graph-node]");
    if (node?.dataset.path) {
      markGraphInteractionActivity();
      graphInteraction = {
        mode: "drag-node",
        path: node.dataset.path,
        lastClientX: event.clientX,
        lastClientY: event.clientY
      };
      return;
    }
    if (target.closest("[data-graph-surface]")) {
      markGraphInteractionActivity();
      graphInteraction = {
        mode: "pan",
        lastClientX: event.clientX,
        lastClientY: event.clientY
      };
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (!graphInteraction) {
      return;
    }
    const deltaX = event.clientX - graphInteraction.lastClientX;
    const deltaY = event.clientY - graphInteraction.lastClientY;
    markGraphInteractionActivity();
    if (graphInteraction.mode === "pan") {
      graphPan = {
        x: graphPan.x + deltaX,
        y: graphPan.y + deltaY
      };
      graphInteraction.lastClientX = event.clientX;
      graphInteraction.lastClientY = event.clientY;
      if (!updateGraphViewportTransform()) {
        scheduleCenterRender();
      }
      return;
    }
    const existing = graphNodePositions.get(graphInteraction.path) ?? { x: 0, y: 0 };
    graphNodePositions.set(graphInteraction.path, {
      x: existing.x + deltaX / graphZoom,
      y: existing.y + deltaY / graphZoom
    });
    graphInteraction.lastClientX = event.clientX;
    graphInteraction.lastClientY = event.clientY;
    scheduleGraphInteractionPatch(graphInteraction.path);
  });

  window.addEventListener("pointerup", () => {
    if (graphInteraction?.mode === "drag-node") {
      markGraphInteractionActivity();
      scheduleGraphInteractionPatch(graphInteraction.path);
    }
    graphInteraction = null;
    if (pendingShellRenderAfterInteraction) {
      scheduleNonCriticalShellRender();
    }
  });

  window.addEventListener("keydown", (event) => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLTextAreaElement
      || activeElement instanceof HTMLSelectElement
    ) {
      return;
    }

    if (event.altKey && event.key.toLowerCase() === "g") {
      event.preventDefault();
      void executeKiwiCommand("guide", [], { expectJson: true });
      return;
    }
    if (event.altKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      void executeKiwiCommand("next", [], { expectJson: true });
      return;
    }
    if (event.altKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void executeKiwiCommand("validate", [], { expectJson: true });
      return;
    }
    if (event.altKey && event.key === "Enter") {
      event.preventDefault();
      void executeKiwiCommand("run-auto", [seedComposerDraft("run-auto")], { expectJson: false });
    }
  });

  void boot();
} catch (error) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
  console.error(detail);
  window.__KIWI_BOOT_API__?.renderError(`Synchronous renderer boot failure:\n${detail}`);
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Shell mount point not found: ${selector}`);
  }
  return element;
}

function loadStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem("kiwi-control-theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to dark mode.
  }
  return "dark";
}

function finalizeInitialRender(): void {
  const bootApi = window.__KIWI_BOOT_API__;
  window.requestAnimationFrame(() => {
    const hasVisibleShell =
      Boolean(topbarElement.textContent?.trim()) ||
      Boolean(centerMainElement.textContent?.trim()) ||
      Boolean(inspectorElement.textContent?.trim());

    if (!hasVisibleShell) {
      bootApi?.renderError("Renderer mounted but produced no visible UI content.");
      return;
    }

    if (bootApi) {
      bootApi.mounted = true;
    }
    bootApi?.hide();
    reportRenderProbe(currentState);
  });
}

function detectPlatform(): PlatformMode {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("win")) {
    return "windows";
  }
  if (userAgent.includes("mac")) {
    return "macos";
  }
  return "linux";
}

function applyChromePreferences(): void {
  shellElement.dataset.theme = activeTheme;
  shellElement.dataset.platform = platformMode;
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.dataset.platform = platformMode;

  try {
    window.localStorage.setItem("kiwi-control-theme", activeTheme);
  } catch {
    // Theme persistence is best-effort only.
  }
}

function buildShellHtml(): string {
  return `
    <main class="kc-shell">
      <header class="kc-topbar" id="topbar"></header>
      <div class="kc-main-frame">
        <aside class="kc-rail">
          <div class="kc-rail-brand">
            <div class="kc-logo">K</div>
          </div>
          <nav class="kc-rail-nav" id="rail-nav"></nav>
          <div class="kc-rail-footer" id="bridge-note"></div>
        </aside>
        <section class="kc-workspace">
          <div class="kc-workspace-surface" id="workspace-surface">
            <div class="kc-main-stack">
              <div class="kc-view-scroll" id="center-main"></div>
              <section class="kc-log-drawer" id="log-drawer"></section>
            </div>
            <aside class="kc-inspector" id="inspector"></aside>
          </div>
        </section>
      </div>
    </main>
  `;
}

async function boot(): Promise<void> {
  if (await loadBrowserPreview()) {
    return;
  }

  await loadDesktopRuntimeInfo();
  await registerLaunchRequestListener();

  const initialLaunchRequest = await consumeInitialLaunchRequest();
  if (initialLaunchRequest) {
    await logUiEvent("ui-initial-launch-request-consumed", initialLaunchRequest.requestId, initialLaunchRequest.targetRoot);
    await handleLaunchRequest(initialLaunchRequest);
  } else {
    await logUiEvent("ui-initial-launch-request-missing");
  }

  window.setInterval(() => {
    void pollPendingLaunchRequest();
  }, 250);
  window.setInterval(() => {
    void pollLatestRuntimeRevision();
  }, RUNTIME_REVISION_FALLBACK_POLL_MS);
  window.setInterval(() => {
    void consumePendingRenderAction();
  }, 250);
}

function resolveBrowserPreviewRequest(): { fixturePath: string } | null {
  if (isTauriBridgeAvailable()) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview");
  if (!preview) {
    return null;
  }

  return {
    fixturePath: params.get("fixture") ?? `/preview/${preview}.json`
  };
}

async function loadBrowserPreview(): Promise<boolean> {
  const previewRequest = resolveBrowserPreviewRequest();
  if (!previewRequest) {
    return false;
  }

  const response = await fetch(previewRequest.fixturePath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Preview fixture failed to load: ${previewRequest.fixturePath}`);
  }

  const payload = await response.json() as BrowserPreviewPayload;
  currentState = payload.state;
  currentTargetRoot = payload.state.targetRoot;
  desktopRuntimeInfo = payload.runtimeInfo ?? null;
  if (payload.activeView) {
    activeView = payload.activeView;
  }
  if (payload.activeMode) {
    activeMode = payload.activeMode;
  }
  inspectorPreferenceLocked = false;
  syncInspectorOpenState();

  bridgeNoteElement.textContent = payload.state.repoState.detail;
  renderState(payload.state);
  noteReadyState(`Preview loaded for ${payload.activeView ?? "overview"}.`);
  return true;
}

async function registerLaunchRequestListener(): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await listen<LaunchRequestPayload>("desktop-launch-request", (event) => {
      void handleLaunchRequest(event.payload);
    });
    await listen<RepoStateChangedPayload>("repo-state-changed", (event) => {
      void handleRepoStateChange(event.payload);
    });
  } catch {
    // Browser-only contexts do not need live retarget listeners.
  }
}

async function handleRepoStateChange(payload: RepoStateChangedPayload): Promise<void> {
  if (!payload.targetRoot || payload.targetRoot !== currentTargetRoot) {
    return;
  }

  if (payload.revision <= currentState.executionState.revision) {
    return;
  }

  if (isLoadingRepoState || isRefreshingFreshRepoState || commandState.loading) {
    queuedRepoStateChange = payload;
    return;
  }

  await loadAndRenderTarget(payload.targetRoot, "auto", undefined, { preferSnapshot: false });
}

async function pollLatestRuntimeRevision(): Promise<void> {
  if (
    !currentTargetRoot
    || !isTauriBridgeAvailable()
    || isLoadingRepoState
    || isRefreshingFreshRepoState
  ) {
    return;
  }

  try {
    const revision = await invoke<number>("get_latest_runtime_revision", {
      targetRoot: currentTargetRoot,
      afterRevision: currentState.executionState.revision
    });
    if (revision > currentState.executionState.revision) {
      await handleRepoStateChange({
        targetRoot: currentTargetRoot,
        revision
      });
    }
  } catch {
    // The Rust watcher remains primary; this runtime-backed poll is only a convergence fallback.
  }
}

async function loadDesktopRuntimeInfo(): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    desktopRuntimeInfo = await invoke<DesktopRuntimeInfo>("get_desktop_runtime_info");
    const probeView = normalizeRenderProbeView(desktopRuntimeInfo.renderProbeView);
    if (probeView) {
      activeView = probeView;
    }
    scheduleRenderState();
    queueDefaultCliInstallIfNeeded();
  } catch {
    desktopRuntimeInfo = null;
  }
}

function shouldAutoInstallBundledCli(runtimeInfo: DesktopRuntimeInfo | null): boolean {
  return Boolean(
    runtimeInfo
    && runtimeInfo.runtimeMode === "installed-user"
    && runtimeInfo.cli.bundledInstallerAvailable
    && !runtimeInfo.cli.installed
    && runtimeInfo.cli.verificationStatus === "not-run"
  );
}

function queueDefaultCliInstallIfNeeded(): void {
  if (!shouldAutoInstallBundledCli(desktopRuntimeInfo) || defaultCliInstallAttempted || defaultCliInstallInFlight) {
    return;
  }

  defaultCliInstallAttempted = true;
  defaultCliInstallInFlight = true;
  queueMicrotask(() => {
    void installBundledCli({ mode: "default" }).finally(() => {
      defaultCliInstallInFlight = false;
    });
  });
}

async function installBundledCli(options: { mode: "manual" | "default" } = { mode: "manual" }): Promise<void> {
  if (!isTauriBridgeAvailable() || commandState.loading) {
    return;
  }

  const mode = options.mode;
  const commandLabel = mode === "default" ? "default terminal command setup" : "retry terminal command setup";

  if (mode === "manual") {
    const confirmed = window.confirm(
      "Retry terminal command setup for this machine?\n\nKiwi auto-attempts kc setup by default on installed desktop builds. It may ask for administrator approval to finish system-wide setup."
    );
    if (!confirmed) {
      return;
    }
  }

  commandState.loading = true;
  commandState.activeCommand = null;
  commandState.lastError = null;
  commandState.lastResult = null;
  renderState(currentState);

  try {
    const result = await invoke<CliInstallResult>("install_bundled_cli");
    await loadDesktopRuntimeInfo();
    commandState.lastResult = {
      ok: result.verificationStatus === "passed",
      exitCode: result.verificationStatus === "passed" ? 0 : 1,
      stdout: result.detail,
      stderr: result.verificationStatus === "passed" ? "" : result.verificationDetail,
      commandLabel
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    commandState.lastError = null;
    commandState.lastResult = {
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: detail,
      commandLabel
    };
  } finally {
    commandState.loading = false;
    renderState(currentState);
  }
}

async function chooseRepoDirectory(): Promise<void> {
  if (!isTauriBridgeAvailable() || commandState.loading) {
    return;
  }

  try {
    const selected = await invoke<string | null>("pick_repo_directory");
    if (!selected) {
      return;
    }

    await loadAndRenderTarget(selected, "manual", undefined, { preferSnapshot: false });
  } catch (error) {
    commandState.lastError = error instanceof Error ? error.message : String(error);
    renderState(currentState);
  }
}

async function handleLaunchRequest(request: LaunchRequestPayload): Promise<void> {
  await logUiEvent("ui-launch-request-received", request.requestId, request.targetRoot);
  lastHandledLaunchRequestId = request.requestId;

  if (isLoadingRepoState) {
    queuedLaunchRequest = request;
    await logUiEvent("ui-launch-request-queued", request.requestId, request.targetRoot);
    return;
  }

  const sameTarget = currentTargetRoot.trim().length > 0 && request.targetRoot === currentTargetRoot;
  const attachableCurrentState =
    sameTarget
    && currentState.repoState.mode !== "bridge-unavailable"
    && !isRefreshingFreshRepoState;

  if (attachableCurrentState) {
    await logUiEvent("ui-launch-request-attached", request.requestId, request.targetRoot, currentState.loadState.source);
    await setActiveRepoTarget(currentTargetRoot, currentState.executionState.revision);
    bridgeNoteElement.textContent = buildBridgeNote(currentState, "cli");
    noteReadyState(buildFinalReadyDetail(currentState));
    renderState(currentState);
    await acknowledgeLaunchRequest(
      request.requestId,
      currentTargetRoot,
      isSnapshotLoadSource(currentState.loadState.source) ? "hydrating" : "ready",
      isSnapshotLoadSource(currentState.loadState.source)
        ? `Already attached to ${currentTargetRoot}. Fresh repo-local state is still hydrating.`
        : `Already attached to ${currentTargetRoot}. Kiwi reused the active runtime-backed desktop session.`,
      currentState.executionState.revision
    );
    return;
  }

  await loadAndRenderTarget(request.targetRoot, "cli", request.requestId);
}

async function pollPendingLaunchRequest(): Promise<void> {
  if (isLoadingRepoState || !isTauriBridgeAvailable()) {
    return;
  }

  const pendingLaunchRequest = await consumeInitialLaunchRequest();
  if (!pendingLaunchRequest || pendingLaunchRequest.requestId === lastHandledLaunchRequestId) {
    return;
  }

  await logUiEvent("ui-fallback-launch-request-consumed", pendingLaunchRequest.requestId, pendingLaunchRequest.targetRoot);
  await handleLaunchRequest(pendingLaunchRequest);
}

async function loadAndRenderTarget(
  targetRoot: string,
  source: "cli" | "manual" | "auto",
  requestId?: string,
  options: { preferSnapshot?: boolean } = {}
): Promise<void> {
  if (isLoadingRepoState || isRefreshingFreshRepoState) {
    if (requestId) {
      queuedLaunchRequest = { requestId, targetRoot };
    }
    return;
  }

  isLoadingRepoState = true;
  currentLoadSource = source;
  currentTargetRoot = targetRoot;
  lastRepoLoadFailure = null;
  lastReadyStateSignal = null;
  lastBlockedActionGuidance = null;
  bridgeNoteElement.textContent =
    source === "cli"
      ? `Opening ${targetRoot} from ${requestId ? "kc ui" : "the CLI"}...`
      : source === "auto"
        ? `Refreshing repo-local state for ${targetRoot}...`
      : `Loading repo-local state for ${targetRoot}...`;
  renderState(currentState);

  try {
    const state = await loadRepoControlState(targetRoot, options.preferSnapshot ?? false);
    currentTargetRoot = state.targetRoot || targetRoot;
    currentState = state;
    lastRepoRefreshAt = Date.now();
    await setActiveRepoTarget(currentTargetRoot, state.executionState.revision);
    renderState(state);
    bridgeNoteElement.textContent = buildBridgeNote(state, source);
    await logUiEvent("ui-repo-state-rendered", requestId, state.targetRoot || targetRoot, `${state.repoState.mode}:${state.loadState.source}`);

    if ((state.loadState.source === "warm-snapshot" || state.loadState.source === "stale-snapshot") && source !== "auto") {
      isLoadingRepoState = false;
      currentLoadSource = null;
      isRefreshingFreshRepoState = true;
      renderState(currentState);

      if (requestId) {
        await acknowledgeLaunchRequest(
          requestId,
          currentTargetRoot,
          "hydrating",
          state.loadState.source === "stale-snapshot"
            ? `Loaded an older repo snapshot for ${currentTargetRoot}. Fresh repo-local state is still hydrating.`
            : `Loaded a warm repo snapshot for ${currentTargetRoot}. Fresh repo-local state is still hydrating.`
        );
      }

      window.setTimeout(() => {
        void refreshFreshRepoState(currentTargetRoot, requestId);
      }, 32);
      return;
    }

    startMachineHydrationCycle(false);
    noteReadyState(buildFinalReadyDetail(state));
    scheduleRenderState();

    if (requestId) {
      await acknowledgeLaunchRequest(
        requestId,
        currentTargetRoot,
        state.repoState.mode === "bridge-unavailable" ? "error" : "ready"
      );
    }
  } catch (error) {
    lastRepoLoadFailure = error instanceof Error ? error.message : String(error);
    const canRetainCurrentState =
      (source === "auto" || source === "manual")
      && currentState.targetRoot === targetRoot
      && currentState.repoState.mode !== "bridge-unavailable";

    if (canRetainCurrentState) {
      bridgeNoteElement.textContent = `Kiwi kept the last known repo-local state for ${targetRoot}. Refresh failed: ${lastRepoLoadFailure}`;
      renderState(currentState);
      await logUiEvent("ui-repo-state-retained-after-refresh-failure", requestId, targetRoot, lastRepoLoadFailure);
      return;
    }

    const fallbackState = buildBridgeUnavailableState(targetRoot);
    currentState = fallbackState;
    currentTargetRoot = fallbackState.targetRoot || targetRoot;
    bridgeNoteElement.textContent = `Kiwi could not load repo-local state for ${targetRoot}. ${lastRepoLoadFailure}`;
    renderState(fallbackState);
    await logUiEvent("ui-repo-state-failed", requestId, targetRoot, lastRepoLoadFailure);
    if (requestId) {
      await acknowledgeLaunchRequest(requestId, targetRoot, "error", lastRepoLoadFailure);
    }
  } finally {
    isLoadingRepoState = false;
    currentLoadSource = null;

    if (!isRefreshingFreshRepoState) {
      await flushQueuedLaunchRequest(requestId);
      await flushQueuedRepoStateChange();
    }
  }
}

async function maybeAutoRefreshState(): Promise<void> {
  const refreshAgeMs = Date.now() - lastRepoRefreshAt;
  const recentFreshState =
    currentState.loadState.source === "fresh"
    && currentState.repoState.mode !== "initialized-invalid"
    && refreshAgeMs < 5 * 60_000;

  if (
    !currentTargetRoot
    || isLoadingRepoState
    || isRefreshingFreshRepoState
    || commandState.loading
    || document.hidden
    || refreshAgeMs < AUTO_REFRESH_MIN_AGE_MS
    || recentFreshState
  ) {
    return;
  }

  await loadAndRenderTarget(currentTargetRoot, "auto", undefined, { preferSnapshot: false });
}

async function refreshFreshRepoState(targetRoot: string, requestId?: string): Promise<void> {
  try {
    const freshState = await loadRepoControlState(targetRoot, false);
    currentTargetRoot = freshState.targetRoot || targetRoot;
    currentState = freshState;
    lastRepoRefreshAt = Date.now();
    lastRepoLoadFailure = null;
    await setActiveRepoTarget(currentTargetRoot, freshState.executionState.revision);
    if (shouldDeferShellRenderForGraphInteraction()) {
      scheduleNonCriticalShellRender();
    } else {
      renderState(freshState);
    }
    bridgeNoteElement.textContent = buildBridgeNote(freshState, "manual");
    await logUiEvent("ui-repo-state-refreshed", requestId, currentTargetRoot, freshState.repoState.mode);
    startMachineHydrationCycle(false);
    noteReadyState(buildFinalReadyDetail(freshState));
    scheduleNonCriticalShellRender();

    if (requestId) {
      await acknowledgeLaunchRequest(
        requestId,
        currentTargetRoot,
        freshState.repoState.mode === "bridge-unavailable" ? "error" : "ready"
      );
    }
  } catch (error) {
    lastRepoLoadFailure = error instanceof Error ? error.message : String(error);
    bridgeNoteElement.textContent = `Showing a warm repo snapshot for ${targetRoot}. Fresh refresh failed: ${lastRepoLoadFailure}`;
    await logUiEvent("ui-repo-state-refresh-failed", requestId, targetRoot, lastRepoLoadFailure);
    scheduleNonCriticalShellRender();
  } finally {
    isRefreshingFreshRepoState = false;
    await flushQueuedLaunchRequest(requestId);
    await flushQueuedRepoStateChange();
  }
}

async function flushQueuedLaunchRequest(currentRequestId?: string): Promise<void> {
  if (queuedLaunchRequest && queuedLaunchRequest.requestId !== currentRequestId) {
    const nextRequest = queuedLaunchRequest;
    queuedLaunchRequest = null;
    await handleLaunchRequest(nextRequest);
    return;
  }

  queuedLaunchRequest = null;
}

async function flushQueuedRepoStateChange(): Promise<void> {
  if (!queuedRepoStateChange) {
    return;
  }

  const nextChange = queuedRepoStateChange;
  queuedRepoStateChange = null;
  await handleRepoStateChange(nextChange);
}

async function acknowledgeLaunchRequest(
  requestId: string,
  targetRoot: string,
  status: "ready" | "error" | "hydrating",
  detail?: string,
  revision = currentState.executionState.revision
): Promise<void> {
  const resolvedDetail = detail ?? (status === "ready"
    ? `Loaded repo-local state for ${targetRoot}.`
    : status === "hydrating"
      ? `Loaded a warm repo snapshot for ${targetRoot}. Fresh repo-local state is still hydrating.`
      : BRIDGE_UNAVAILABLE_NEXT_STEP);

  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await logUiEvent("ui-ack-attempt", requestId, targetRoot, status);
    await invoke("ack_launch_request", { requestId, targetRoot, status, detail: resolvedDetail, revision });
    await logUiEvent("ui-ack-succeeded", requestId, targetRoot, status);
  } catch (error) {
    bridgeNoteElement.textContent = "Kiwi Control loaded this repo, but the desktop launch acknowledgement did not complete yet.";
    await logUiEvent("ui-ack-failed", requestId, targetRoot, error instanceof Error ? error.message : String(error));
  }
}

async function logUiEvent(event: string, requestId?: string, targetRoot?: string, detail?: string): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await invoke("append_ui_launch_log", { event, requestId, targetRoot, detail });
  } catch {
    // Logging must never interrupt the product flow.
  }
}

function isSnapshotLoadSource(source: RepoControlLoadState["source"]): boolean {
  return source === "warm-snapshot" || source === "stale-snapshot";
}

function isMachineHeavyView(view: NavView): boolean {
  return view === "machine" || view === "tokens" || view === "mcps" || view === "system";
}

function dedupeMachineSections(sections: MachineSectionName[]): MachineSectionName[] {
  return [...new Set(sections)];
}

function machinePrioritySectionsForView(view: NavView): MachineSectionName[] {
  switch (view) {
    case "tokens":
      return ["usage", "optimizationLayers"];
    case "mcps":
      return ["mcpInventory", "optimizationLayers"];
    case "system":
      return ["inventory", "configHealth", "setupPhases"];
    case "machine":
      return ["guidance", "inventory", "configHealth"];
    default:
      return MACHINE_LIGHTWEIGHT_SECTIONS;
  }
}

function machineSecondarySectionsForView(view: NavView): MachineSectionName[] {
  if (!isMachineHeavyView(view)) {
    return [];
  }

  return dedupeMachineSections([
    ...MACHINE_LIGHTWEIGHT_SECTIONS,
    ...MACHINE_HEAVY_SECTIONS
  ]);
}

function sectionsNeedingHydration(sections: MachineSectionName[], refresh: boolean): MachineSectionName[] {
  return sections.filter((section) => {
    if (refresh) {
      return true;
    }
    if (!hydratedMachineSections.has(section)) {
      return true;
    }
    return currentState.machineAdvisory.sections[section]?.status !== "fresh";
  });
}

function scheduleMachineHydrationForView(view: NavView, refresh: boolean): void {
  if (!currentTargetRoot || !isTauriBridgeAvailable()) {
    return;
  }

  const prioritySections = sectionsNeedingHydration(machinePrioritySectionsForView(view), refresh);
  const secondarySections = sectionsNeedingHydration(
    machineSecondarySectionsForView(view).filter((section) => !prioritySections.includes(section)),
    refresh
  );

  const round = ++machineHydrationRound;
  if (deferredMachineHydrationTimer != null) {
    window.clearTimeout(deferredMachineHydrationTimer);
    deferredMachineHydrationTimer = null;
  }

  if (prioritySections.length > 0) {
    void hydrateMachineAdvisory(refresh, prioritySections, round);
  }

  if (secondarySections.length > 0) {
    deferredMachineHydrationTimer = window.setTimeout(() => {
      void hydrateMachineAdvisory(refresh, secondarySections, round);
      deferredMachineHydrationTimer = null;
    }, 900);
  }
}

function startMachineHydrationCycle(refresh: boolean): void {
  scheduleMachineHydrationForView(activeView, refresh);
}

async function hydrateMachineAdvisory(
  refresh: boolean,
  sections: MachineSectionName[],
  round: number
): Promise<void> {
  if (!isTauriBridgeAvailable() || sections.length === 0) {
    return;
  }

  machineHydrationInFlight = true;
  for (const section of sections) {
    machineHydrationActiveSections.add(section);
  }
  scheduleRenderState();

  await Promise.all(sections.map((section) => hydrateMachineSection(section, refresh, round)));

  if (round !== machineHydrationRound) {
    for (const section of sections) {
      machineHydrationActiveSections.delete(section);
    }
    if (machineHydrationActiveSections.size === 0) {
      machineHydrationInFlight = false;
    }
    scheduleRenderState();
    return;
  }
  for (const section of sections) {
    machineHydrationActiveSections.delete(section);
  }
  if (machineHydrationActiveSections.size === 0) {
    machineHydrationInFlight = false;
  }
  scheduleRenderState();
}

async function hydrateAllMachineAdvisory(refresh: boolean): Promise<void> {
  const round = ++machineHydrationRound;
  await hydrateMachineAdvisory(
    refresh,
    [
      "inventory",
      "mcpInventory",
      "optimizationLayers",
      "setupPhases",
      "configHealth",
      "usage",
      "guidance"
    ],
    round
  );
}

async function hydrateMachineSection(section: MachineSectionName, refresh: boolean, round: number): Promise<void> {
  try {
    const payload = await invoke<MachineSectionPayload>("load_machine_advisory_section", {
      section,
      refresh
    });
    if (round !== machineHydrationRound) {
      return;
    }
    applyMachineSectionPayload(payload);
    hydratedMachineSections.add(section);
    scheduleNonCriticalShellRender();
  } catch (error) {
    if (round !== machineHydrationRound) {
      return;
    }
    currentState.machineAdvisory.sections[section] = {
      status: "partial",
      updatedAt: new Date().toISOString(),
      reason: error instanceof Error ? error.message : String(error)
    };
    scheduleNonCriticalShellRender();
  }
}

function applyMachineSectionPayload(payload: MachineSectionPayload): void {
  currentState.machineAdvisory.sections[payload.section] = payload.meta;
  switch (payload.section) {
    case "inventory":
      currentState.machineAdvisory.inventory = payload.data as RepoControlState["machineAdvisory"]["inventory"];
      break;
    case "mcpInventory":
      currentState.machineAdvisory.mcpInventory = payload.data as RepoControlState["machineAdvisory"]["mcpInventory"];
      break;
    case "optimizationLayers":
      currentState.machineAdvisory.optimizationLayers = payload.data as RepoControlState["machineAdvisory"]["optimizationLayers"];
      break;
    case "setupPhases":
      currentState.machineAdvisory.setupPhases = payload.data as RepoControlState["machineAdvisory"]["setupPhases"];
      break;
    case "configHealth":
      currentState.machineAdvisory.configHealth = payload.data as RepoControlState["machineAdvisory"]["configHealth"];
      break;
    case "usage":
      currentState.machineAdvisory.usage = payload.data as RepoControlState["machineAdvisory"]["usage"];
      break;
    case "guidance":
      currentState.machineAdvisory.guidance = filterGuidanceForCurrentState(
        payload.data as RepoControlState["machineAdvisory"]["guidance"]
      );
      break;
  }
  currentState.machineAdvisory.updatedAt = payload.meta.updatedAt;
  currentState.machineAdvisory.stale = Object.values(currentState.machineAdvisory.sections).some((entry) => entry.status !== "fresh");
  currentState.machineAdvisory.systemHealth = recomputeMachineSystemHealth(currentState.machineAdvisory);
}

function filterGuidanceForCurrentState(
  entries: RepoControlState["machineAdvisory"]["guidance"]
): RepoControlState["machineAdvisory"]["guidance"] {
  const task = currentState.kiwiControl?.contextView.task?.toLowerCase() ?? "";
  const workflowStep = currentState.kiwiControl?.workflow.currentStepId ?? null;
  const validationFailed = currentState.validation.errors > 0;
  const evalPrecisionLow = (currentState.kiwiControl?.feedback.totalRuns ?? 0) > 0 && (currentState.kiwiControl?.feedback.successRate ?? 100) < 50;
  const executionRetriesTriggered = currentState.kiwiControl?.workflow.steps.some((step) => step.retryCount > 0) ?? false;
  const triggered = validationFailed || evalPrecisionLow || executionRetriesTriggered;
  return entries.filter((entry) => {
    if (!triggered && entry.priority !== "critical") {
      return false;
    }
    if ((/\b(read|inspect|review|summarize)\b/.test(task) || /\bdocs?|document|readme\b/.test(task)) && workflowStep === "prepare" && entry.id === "missing-ccusage") {
      return false;
    }
    return true;
  });
}

function recomputeMachineSystemHealth(machine: RepoControlState["machineAdvisory"]): RepoControlState["machineAdvisory"]["systemHealth"] {
  const criticalCount = machine.guidance.filter((entry) => entry.priority === "critical").length;
  const warningCount = machine.guidance.filter((entry) => entry.priority === "recommended").length;
  const okCount =
    machine.inventory.filter((tool) => tool.installed).length +
    machine.configHealth.filter((entry) => entry.healthy).length +
    machine.optimizationLayers.filter((layer) => layer.claude || layer.codex || layer.copilot).length;
  return {
    criticalCount,
    warningCount,
    okCount
  };
}

function syncInteractiveSessionState(state: RepoControlState): void {
  const targetRoot = state.targetRoot || "";
  if (targetRoot !== activeInteractiveTargetRoot) {
    activeInteractiveTargetRoot = targetRoot;
    commandState = {
      activeCommand: null,
      loading: false,
      composer: null,
      draftValue: "",
      lastResult: null,
      lastError: null
    };
    lastBlockedActionGuidance = null;
    focusedItem = null;
    contextOverrides = new Map<string, ContextOverrideMode>();
    contextOverrideHistory = [];
    graphNodePositions = new Map<string, { x: number; y: number }>();
    graphPan = { x: 0, y: 0 };
    graphZoom = 1;
    graphDepth = 2;
    graphSelectedPath = null;
    localPlanOrder = [];
    localPlanSkipped = new Set<string>();
    localPlanEdits = new Map<string, { label: string; note: string }>();
    editingPlanStepId = null;
    editingPlanDraft = "";
    approvalMarkers = new Map<string, "approved" | "rejected">();
    contextOverrideVersion = 0;
    derivedTreeCache = null;
    graphProjectionCache = null;
    activeGraphProjection = null;
    pendingGraphPatchPaths.clear();
    graphPatchQueued = false;
    hydratedMachineSections.clear();
    machineHydrationActiveSections.clear();
    machineHydrationInFlight = false;
    inspectorPreferenceLocked = false;
    syncInspectorOpenState();
    if (deferredMachineHydrationTimer != null) {
      window.clearTimeout(deferredMachineHydrationTimer);
      deferredMachineHydrationTimer = null;
    }
  }

  mergePlanUiState(state);
  ensureFocusedItem(state);
}

function ensureFocusedItem(state: RepoControlState): void {
  const currentFocus = focusedItem;

  if (currentFocus?.kind === "path" && !viewKeepsPathFocus(activeView)) {
    focusedItem = null;
  } else if (currentFocus?.kind === "step" && !viewKeepsStepFocus(activeView)) {
    focusedItem = null;
  } else if (currentFocus?.kind === "path" && findContextNodeByPath(state, currentFocus.path)) {
    return;
  } else if (currentFocus?.kind === "step" && deriveDisplayExecutionPlanSteps(state).some((step) => step.id === currentFocus.id)) {
    return;
  }

  if (!viewKeepsPathFocus(activeView) && !viewKeepsStepFocus(activeView)) {
    focusedItem = null;
    return;
  }

  const selectedFiles = deriveInteractiveSelectedFiles(state);
  const firstSelectedFile = selectedFiles[0];
  if (firstSelectedFile && viewKeepsPathFocus(activeView)) {
    focusedItem = {
      kind: "path",
      id: firstSelectedFile,
      label: basenameForPath(firstSelectedFile),
      path: firstSelectedFile
    };
    return;
  }

  const primaryStep = deriveDisplayExecutionPlanSteps(state)[0];
  if (primaryStep && viewKeepsStepFocus(activeView)) {
    focusedItem = {
      kind: "step",
      id: primaryStep.id,
      label: primaryStep.displayTitle
    };
    return;
  }

  focusedItem = null;
}

function viewKeepsPathFocus(view: NavView): boolean {
  return view === "overview" || view === "context" || view === "graph";
}

function viewKeepsStepFocus(view: NavView): boolean {
  return view === "overview";
}

function mergePlanUiState(state: RepoControlState): void {
  const stepIds = (state.kiwiControl ?? EMPTY_KC).executionPlan.steps.map((step) => step.id);
  if (stepIds.length === 0) {
    localPlanOrder = [];
    localPlanSkipped.clear();
    localPlanEdits.clear();
    editingPlanStepId = null;
    editingPlanDraft = "";
    return;
  }

  if (localPlanOrder.length === 0) {
    localPlanOrder = [...stepIds];
  } else {
    localPlanOrder = [
      ...localPlanOrder.filter((stepId) => stepIds.includes(stepId)),
      ...stepIds.filter((stepId) => !localPlanOrder.includes(stepId))
    ];
  }

  for (const stepId of [...localPlanSkipped]) {
    if (!stepIds.includes(stepId)) {
      localPlanSkipped.delete(stepId);
    }
  }
  for (const stepId of [...localPlanEdits.keys()]) {
    if (!stepIds.includes(stepId)) {
      localPlanEdits.delete(stepId);
    }
  }
}

function deriveInteractiveTree(state: RepoControlState): KiwiControlContextTree {
  const baseTree = (state.kiwiControl ?? EMPTY_KC).contextView.tree;
  if (derivedTreeCache && derivedTreeCache.baseTree === baseTree && derivedTreeCache.overrideVersion === contextOverrideVersion) {
    return derivedTreeCache.tree;
  }
  const nodes = baseTree.nodes.map((node) => applyOverridesToTreeNode(node));
  const counts = countTreeStatuses(nodes);
  const tree = {
    nodes,
    selectedCount: counts.selected,
    candidateCount: counts.candidate,
    excludedCount: counts.excluded
  };
  derivedTreeCache = {
    baseTree,
    overrideVersion: contextOverrideVersion,
    tree,
    flatNodes: flattenContextNodes(nodes)
  };
  return tree;
}

function applyOverridesToTreeNode(node: KiwiControlContextTreeNode): KiwiControlContextTreeNode {
  const override = contextOverrides.get(node.path);
  const status = override == null
    ? node.status
    : override === "include"
      ? "selected"
      : "excluded";
  return {
    ...node,
    status,
    children: node.children.map((child) => applyOverridesToTreeNode(child))
  };
}

function countTreeStatuses(nodes: KiwiControlContextTreeNode[]): { selected: number; candidate: number; excluded: number } {
  return nodes.reduce(
    (accumulator, node) => {
      if (node.status === "selected") {
        accumulator.selected += 1;
      } else if (node.status === "candidate") {
        accumulator.candidate += 1;
      } else {
        accumulator.excluded += 1;
      }
      const childCounts = countTreeStatuses(node.children);
      accumulator.selected += childCounts.selected;
      accumulator.candidate += childCounts.candidate;
      accumulator.excluded += childCounts.excluded;
      return accumulator;
    },
    { selected: 0, candidate: 0, excluded: 0 }
  );
}

function deriveInteractiveSelectedFiles(state: RepoControlState): string[] {
  return deriveFlatInteractiveNodes(state)
    .filter((node) => node.kind === "file" && node.status === "selected")
    .map((node) => node.path);
}

function flattenContextNodes(nodes: KiwiControlContextTreeNode[]): KiwiControlContextTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenContextNodes(node.children)]);
}

function deriveFlatInteractiveNodes(state: RepoControlState): KiwiControlContextTreeNode[] {
  const baseTree = (state.kiwiControl ?? EMPTY_KC).contextView.tree;
  if (derivedTreeCache && derivedTreeCache.baseTree === baseTree && derivedTreeCache.overrideVersion === contextOverrideVersion) {
    return derivedTreeCache.flatNodes;
  }
  deriveInteractiveTree(state);
  return derivedTreeCache?.flatNodes ?? [];
}

function findContextNodeByPath(state: RepoControlState, path: string): KiwiControlContextTreeNode | null {
  return deriveFlatInteractiveNodes(state).find((node) => node.path === path) ?? null;
}

function pushContextOverrideHistory(): void {
  contextOverrideHistory.push(new Map(contextOverrides));
  if (contextOverrideHistory.length > 20) {
    contextOverrideHistory.shift();
  }
}

function applyLocalContextOverride(path: string, mode: ContextOverrideMode): void {
  pushContextOverrideHistory();
  contextOverrides.set(path, mode);
  contextOverrideVersion += 1;
  derivedTreeCache = null;
  focusedItem = {
    kind: "path",
    id: path,
    label: basenameForPath(path),
    path
  };
  graphSelectedPath = path;
  scheduleRenderState();
}

function resetLocalContextOverrides(): void {
  if (contextOverrides.size === 0) {
    return;
  }
  pushContextOverrideHistory();
  contextOverrides.clear();
  contextOverrideVersion += 1;
  derivedTreeCache = null;
  scheduleRenderState();
}

function undoLocalContextOverride(): void {
  const previous = contextOverrideHistory.pop();
  if (!previous) {
    return;
  }
  contextOverrides = new Map(previous);
  contextOverrideVersion += 1;
  derivedTreeCache = null;
  scheduleRenderState();
}

function seedComposerDraft(mode: Exclude<CommandComposerMode, null>): string {
  if (mode === "handoff") {
    return currentState.specialists.handoffTargets[0] ?? currentState.specialists.recommendedSpecialist ?? "";
  }
  if (mode === "checkpoint") {
    return getPanelValue(currentState.repoOverview, "Current phase") !== "none recorded"
      ? getPanelValue(currentState.repoOverview, "Current phase")
      : `${getRepoLabel(currentTargetRoot)} checkpoint`;
  }
  const task = currentState.kiwiControl?.contextView.task?.trim() ?? "";
  if (task && task.toLowerCase() !== "task") {
    return task;
  }
  return currentState.kiwiControl?.nextActions.actions[0]?.action
    ?? "";
}

function isPlaceholderTask(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length === 0 || normalized === "task";
}

function deriveComposerConstraint(
  state: RepoControlState,
  mode: Exclude<CommandComposerMode, null>,
  draftValue: string
): { blocked: boolean; reason: string; nextCommand: string | null } {
  const plan = state.kiwiControl?.executionPlan;
  const validateStep = plan?.steps.find((step) => step.id === "validate");
  const validateFixCommand =
    state.runtimeDecision.recovery?.fixCommand
    ?? state.runtimeDecision.nextCommand
    ?? state.executionState.nextCommand
    ?? state.readiness.nextCommand
    ?? validateStep?.fixCommand
    ?? validateStep?.retryCommand
    ?? plan?.lastError?.fixCommand
    ?? plan?.lastError?.retryCommand
    ?? plan?.nextCommands[0]
    ?? "kiwi-control validate \"task\"";

  if (mode === "run-auto" && isPlaceholderTask(draftValue)) {
    return {
      blocked: true,
      reason: "Enter a real goal instead of the placeholder task.",
      nextCommand: "kiwi-control prepare \"real goal\""
    };
  }

  if (mode === "checkpoint" && (state.executionState.lifecycle === "blocked" || state.executionState.lifecycle === "failed" || validateStep?.status === "failed" || state.validation.errors > 0)) {
    return {
      blocked: true,
      reason: "Checkpoint is blocked until validation passes.",
      nextCommand: validateFixCommand
    };
  }

  if (mode === "handoff" && (state.executionState.lifecycle === "blocked" || state.executionState.lifecycle === "failed" || validateStep?.status === "failed" || state.validation.errors > 0)) {
    return {
      blocked: true,
      reason: "Handoff is blocked until validation passes.",
      nextCommand: validateFixCommand
    };
  }

  return {
    blocked: false,
    reason: mode === "run-auto" ? "Run a concrete goal in the loaded repo." : "Ready to run.",
    nextCommand: null
  };
}

function toggleComposer(mode: Exclude<CommandComposerMode, null>): void {
  if (commandState.loading) {
    return;
  }
  lastBlockedActionGuidance = null;
  if (commandState.composer === mode) {
    commandState.composer = null;
    commandState.draftValue = "";
  } else {
    commandState.composer = mode;
    commandState.draftValue = seedComposerDraft(mode);
  }
  scheduleRenderState();
}

async function refreshCurrentRepoState(): Promise<void> {
  if (!currentTargetRoot) {
    return;
  }
  await loadAndRenderTarget(currentTargetRoot, "manual", undefined, { preferSnapshot: false });
}

async function executeKiwiCommand(
  command: UiCommandName,
  args: string[],
  options: { expectJson: boolean }
): Promise<CliCommandResultPayload | null> {
  if (!currentTargetRoot || commandState.loading || !isTauriBridgeAvailable()) {
    return null;
  }

  commandState.loading = true;
  commandState.activeCommand = command;
  commandState.lastError = null;
  commandState.lastResult = null;
  lastBlockedActionGuidance = null;
  renderState(currentState);

  try {
    const result = await invoke<CliCommandResultPayload>("run_cli_command", {
      command,
      args,
      targetRoot: currentTargetRoot,
      expectJson: options.expectJson
    });
    commandState.lastResult = result;
    commandState.lastError = result.ok ? null : summarizeCliCommandFailure(result);
    isLogDrawerOpen = true;
    if (result.ok) {
      commandState.composer = null;
      commandState.draftValue = "";
      await refreshCurrentRepoState();
    } else {
      renderState(currentState);
    }
    return result;
  } catch (error) {
    const hiddenCommandError = error instanceof Error ? error.message : String(error);
    if (await openTerminalForKiwiCommand(command, args)) {
      commandState.lastError = `Opened Terminal to run ${command} because desktop subprocess execution failed: ${hiddenCommandError}`;
    } else {
      commandState.lastError = hiddenCommandError;
    }
    isLogDrawerOpen = true;
    renderState(currentState);
    return null;
  } finally {
    commandState.loading = false;
    commandState.activeCommand = null;
    renderState(currentState);
  }
}

async function executePackCommand(
  action: "status" | "set" | "clear",
  packId?: string
): Promise<CliCommandResultPayload | null> {
  if (!currentTargetRoot || commandState.loading || !isTauriBridgeAvailable()) {
    return null;
  }

  commandState.loading = true;
  commandState.activeCommand = "status";
  commandState.lastError = null;
  commandState.lastResult = null;
  lastBlockedActionGuidance = null;
  renderState(currentState);

  try {
    const args = action === "set" && packId ? [action, packId, "--json"] : [action, "--json"];
    const result = await invoke<CliCommandResultPayload>("run_cli_command", {
      command: "pack",
      args,
      targetRoot: currentTargetRoot,
      expectJson: true
    });
    commandState.lastResult = result;
    commandState.lastError = result.ok ? null : summarizeCliCommandFailure(result);
    isLogDrawerOpen = true;
    if (result.ok) {
      await refreshCurrentRepoState();
    } else {
      renderState(currentState);
    }
    return result;
  } catch (error) {
    commandState.lastError = error instanceof Error ? error.message : String(error);
    isLogDrawerOpen = true;
    renderState(currentState);
    return null;
  } finally {
    commandState.loading = false;
    commandState.activeCommand = null;
    renderState(currentState);
  }
}

async function openTerminalForKiwiCommand(command: UiCommandName, args: string[]): Promise<boolean> {
  if (!currentTargetRoot || !isTauriBridgeAvailable()) {
    return false;
  }
  try {
    await invoke("open_terminal_command", {
      command,
      args,
      targetRoot: currentTargetRoot
    });
    return true;
  } catch {
    return false;
  }
}

async function openRepoPath(path: string): Promise<void> {
  if (!currentTargetRoot || !isTauriBridgeAvailable()) {
    return;
  }
  try {
    await invoke("open_path", {
      targetRoot: currentTargetRoot,
      path
    });
  } catch (error) {
    commandState.lastError = error instanceof Error ? error.message : String(error);
    renderState(currentState);
  }
}

function summarizeCliCommandFailure(result: CliCommandResultPayload): string {
  const payload = result.jsonPayload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const failureReason = typeof record.failureReason === "string" ? record.failureReason.trim() : "";
    const validation = typeof record.validation === "string" ? record.validation.trim() : "";
    const detail = typeof record.detail === "string" ? record.detail.trim() : "";
    const nextCommand =
      typeof record.nextCommand === "string"
        ? record.nextCommand.trim()
        : typeof record.nextSuggestedCommand === "string"
          ? record.nextSuggestedCommand.trim()
          : "";

    const summary = failureReason || validation || detail;
    if (summary) {
      return nextCommand ? `${summary} Next: ${formatCliCommand(nextCommand, currentTargetRoot)}` : summary;
    }
  }

  return result.stderr || result.stdout || `${result.commandLabel} failed`;
}

function noteReadyState(detail: string): void {
  lastReadyStateSignal = {
    at: Date.now(),
    detail
  };
  if (readyStateTimer != null) {
    window.clearTimeout(readyStateTimer);
  }
  readyStateTimer = window.setTimeout(() => {
    readyStateTimer = null;
    scheduleNonCriticalShellRender();
  }, READY_STATE_PULSE_MS + 32);
}

function markGraphInteractionActivity(): void {
  lastGraphInteractionAt = Date.now();
}

function shouldDeferShellRenderForGraphInteraction(): boolean {
  return activeView === "graph" && Date.now() - lastGraphInteractionAt < GRAPH_INTERACTION_SETTLE_MS;
}

function scheduleNonCriticalShellRender(): void {
  if (!shouldDeferShellRenderForGraphInteraction()) {
    pendingShellRenderAfterInteraction = false;
    if (deferredShellRenderTimer != null) {
      window.clearTimeout(deferredShellRenderTimer);
      deferredShellRenderTimer = null;
    }
    scheduleRenderState();
    return;
  }

  pendingShellRenderAfterInteraction = true;
  if (deferredShellRenderTimer != null) {
    return;
  }

  const remainingMs = Math.max(0, GRAPH_INTERACTION_SETTLE_MS - (Date.now() - lastGraphInteractionAt));
  deferredShellRenderTimer = window.setTimeout(() => {
    deferredShellRenderTimer = null;
    if (!pendingShellRenderAfterInteraction) {
      return;
    }
    pendingShellRenderAfterInteraction = false;
    scheduleRenderState();
  }, remainingMs + 16);
}

function resolveGraphViewportElement(): SVGGElement | null {
  if (graphViewportElement?.isConnected) {
    return graphViewportElement;
  }
  graphViewportElement = centerMainElement.querySelector<SVGGElement>("[data-graph-viewport]");
  return graphViewportElement;
}

function updateGraphViewportTransform(): boolean {
  if (activeView !== "graph") {
    return false;
  }
  const viewport = resolveGraphViewportElement();
  if (!viewport) {
    return false;
  }
  viewport.setAttribute("transform", `translate(${graphPan.x} ${graphPan.y}) scale(${graphZoom})`);
  return true;
}

function scheduleGraphInteractionPatch(path: string): void {
  pendingGraphPatchPaths.add(path);
  if (graphPatchQueued || renderQueued || centerRenderQueued) {
    return;
  }

  graphPatchQueued = true;
  window.requestAnimationFrame(() => {
    graphPatchQueued = false;
    const paths = [...pendingGraphPatchPaths];
    pendingGraphPatchPaths.clear();
    if (!patchGraphSurface(paths)) {
      scheduleCenterRender();
    }
  });
}

function patchGraphSurface(paths: string[]): boolean {
  if (activeView !== "graph" || paths.length === 0) {
    return false;
  }

  const projection = activeGraphProjection ?? getGraphProjection(currentState);
  if (!projection) {
    return false;
  }

  const graphSurface = centerMainElement.querySelector<SVGElement>("[data-graph-canvas-root]");
  if (!graphSurface) {
    return false;
  }

  for (const path of paths) {
    const selector = `[data-graph-node-wrap][data-path="${escapeSelectorValue(path)}"]`;
    const nodeWrap = graphSurface.querySelector<SVGGElement>(selector);
    const position = resolveProjectedNodePosition(projection, graphNodePositions, path);
    if (nodeWrap && position) {
      nodeWrap.setAttribute("transform", `translate(${position.x}, ${position.y})`);
    }

    const edgeSelector = [
      `[data-graph-edge][data-from-path="${escapeSelectorValue(path)}"]`,
      `[data-graph-edge][data-to-path="${escapeSelectorValue(path)}"]`
    ].join(",");
    for (const edge of graphSurface.querySelectorAll<SVGLineElement>(edgeSelector)) {
      const fromPath = edge.dataset.fromPath;
      const toPath = edge.dataset.toPath;
      if (!fromPath || !toPath) {
        continue;
      }
      const from = resolveProjectedNodePosition(projection, graphNodePositions, fromPath);
      const to = resolveProjectedNodePosition(projection, graphNodePositions, toPath);
      if (!from || !to) {
        continue;
      }
      edge.setAttribute("x1", String(from.x));
      edge.setAttribute("y1", String(from.y));
      edge.setAttribute("x2", String(to.x));
      edge.setAttribute("y2", String(to.y));
    }
  }

  return true;
}

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function parseKiwiCommand(commandText: string): { command: UiCommandName; args: string[] } | null {
  const tokens = tokenizeCommand(commandText);
  if (tokens.length < 2) {
    return null;
  }
  const executable = tokens[0] ?? "";
  if (!["kiwi-control", "kc", "shrey-junior", "sj"].includes(executable)) {
    return null;
  }
  const [subcommand = "", ...rest] = tokens.slice(1);
  if (subcommand === "run" && rest[0] === "--auto") {
    const task = rest.find((token, index) => index > 0 && token !== "--target" && token !== currentTargetRoot);
    return task ? { command: "run-auto", args: [task] } : null;
  }
  if (subcommand === "handoff") {
    const toIndex = rest.findIndex((token) => token === "--to");
    const handoffTarget = toIndex >= 0 ? rest[toIndex + 1] : undefined;
    if (handoffTarget) {
      return { command: "handoff", args: [handoffTarget] };
    }
  }
  if (subcommand === "checkpoint") {
    const label = rest.find((token) => !token.startsWith("--"));
    return label ? { command: "checkpoint", args: [label] } : null;
  }
  if (subcommand === "validate") {
    const task = rest.find((token) => !token.startsWith("--") && token !== currentTargetRoot);
    return { command: "validate", args: task ? [task] : [] };
  }
  if (subcommand === "review") {
    const reviewArgs: string[] = [];
    const baseIndex = rest.findIndex((token) => token === "--base");
    const baseRef = baseIndex >= 0 ? rest[baseIndex + 1] : undefined;
    if (baseRef && !baseRef.startsWith("--")) {
      reviewArgs.push("--base", baseRef);
    }
    if (rest.includes("--json")) {
      reviewArgs.push("--json");
    }
    return { command: "review", args: reviewArgs };
  }
  if (subcommand === "init") {
    return { command: "init", args: [] };
  }
  if (subcommand === "sync") {
    const allowedFlags = rest.filter((token) => token === "--dry-run" || token === "--diff-summary" || token === "--backup");
    return { command: "sync", args: allowedFlags };
  }
  if (subcommand === "setup") {
    const allowed = rest.filter((token) =>
      token === "--dry-run"
      || token === "--json"
      || token === "--profile"
      || ["desktop-only", "desktop-plus-cli", "repo-only", "repair", "full-dev-machine"].includes(token)
      || ["status", "verify", "doctor", "repair", "install", "init"].includes(token)
      || ["global-cli", "global-preferences", "lean-ctx", "repomix", "repo-contract", "repo-assistant-wiring", "repo-graph", "repo-hygiene"].includes(token)
    );
    return { command: "setup", args: allowed };
  }
  if (["guide", "next", "retry", "resume", "status", "trace"].includes(subcommand)) {
    return { command: subcommand as UiCommandName, args: rest.includes("--json") ? ["--json"] : [] };
  }
  return null;
}

function tokenizeCommand(value: string): string[] {
  const tokens = [...value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)];
  return tokens.map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").filter(Boolean);
}

async function executePlanStepCommand(step: DisplayExecutionPlanStep): Promise<void> {
  const parsed = parseKiwiCommand(step.command);
  if (parsed) {
    await executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
    return;
  }

  if (step.retryCommand) {
    const retryParsed = parseKiwiCommand(step.retryCommand);
    if (retryParsed) {
      await executeKiwiCommand(retryParsed.command, retryParsed.args, { expectJson: retryParsed.args.includes("--json") });
      return;
    }
  }

  if (step.id === "execute") {
    await executeKiwiCommand("run-auto", [seedComposerDraft("run-auto")], { expectJson: false });
    return;
  }
  if (step.id.includes("validate")) {
    await executeKiwiCommand("validate", [], { expectJson: true });
    return;
  }
  await executeKiwiCommand("next", ["--json"], { expectJson: true });
}

function deriveDisplayExecutionPlanSteps(state: RepoControlState): DisplayExecutionPlanStep[] {
  const plan = (state.kiwiControl ?? EMPTY_KC).executionPlan;
  const sourceById = new Map(plan.steps.map((step) => [step.id, step]));
  return localPlanOrder
    .map((stepId) => sourceById.get(stepId))
    .filter((step): step is ExecutionPlanStep => Boolean(step))
    .map((step) => {
      const edit = localPlanEdits.get(step.id);
      return {
        ...step,
        displayTitle: edit?.label?.trim() || step.description,
        displayNote: edit?.note?.trim() || step.result.summary || step.expectedOutput || null,
        skipped: localPlanSkipped.has(step.id)
      };
    });
}

function movePlanStep(stepId: string, direction: -1 | 1): void {
  const index = localPlanOrder.indexOf(stepId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= localPlanOrder.length) {
    return;
  }
  const reordered = [...localPlanOrder];
  const currentValue = reordered[index];
  const nextValue = reordered[nextIndex];
  if (!currentValue || !nextValue) {
    return;
  }
  reordered[index] = nextValue;
  reordered[nextIndex] = currentValue;
  localPlanOrder = reordered;
  scheduleRenderState();
}

function toggleSkippedPlanStep(stepId: string): void {
  if (localPlanSkipped.has(stepId)) {
    localPlanSkipped.delete(stepId);
  } else {
    localPlanSkipped.add(stepId);
  }
  scheduleRenderState();
}

function startEditingPlanStep(stepId: string, currentLabel: string): void {
  editingPlanStepId = stepId;
  editingPlanDraft = currentLabel;
  scheduleRenderState();
}

function commitPlanStepEdit(stepId: string): void {
  const existing = localPlanEdits.get(stepId) ?? { label: "", note: "" };
  localPlanEdits.set(stepId, {
    ...existing,
    label: editingPlanDraft.trim() || existing.label
  });
  editingPlanStepId = null;
  editingPlanDraft = "";
  scheduleRenderState();
}

function getGraphProjection(state: RepoControlState): GraphProjection {
  const tree = deriveInteractiveTree(state);
  const rootPath = state.targetRoot || "repo";
  const focusPath = graphSelectedPath ?? (focusedItem?.kind === "path" ? focusedItem.path : null);
  const selectedAnalysis = state.kiwiControl?.fileAnalysis.selected ?? [];

  if (
    graphProjectionCache
    && graphProjectionCache.baseTree === tree
    && graphProjectionCache.overrideVersion === contextOverrideVersion
    && graphProjectionCache.targetRoot === rootPath
    && graphProjectionCache.graphDepth === graphDepth
    && graphProjectionCache.focusPath === focusPath
    && graphProjectionCache.selectedAnalysis === selectedAnalysis
  ) {
    activeGraphProjection = graphProjectionCache.projection;
    return graphProjectionCache.projection;
  }

  const projection = deriveGraphProjection({
    tree,
    rootPath,
    rootLabel: getRepoLabel(rootPath) || "repo",
    graphDepth,
    focusPath,
    selectedAnalysis
  });

  graphProjectionCache = {
    baseTree: tree,
    overrideVersion: contextOverrideVersion,
    targetRoot: rootPath,
    graphDepth,
    focusPath,
    selectedAnalysis,
    projection
  };
  activeGraphProjection = projection;
  return projection;
}

function deriveGraphModel(state: RepoControlState): InteractiveGraphModel {
  return materializeGraphModel(getGraphProjection(state), graphNodePositions);
}

function basenameForPath(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function renderRecoveryGuidanceBanner(
  guidance: RecoveryGuidance,
  options: {
    kicker: string;
    actionLabel?: string | null;
  }
): string {
  const bannerTone = guidance.tone === "blocked" ? "blocked" : "warn";
  const detail =
    activeView === "overview"
      ? "A recovery path is active. Use the repo-scoped command below."
      : guidance.detail;
  return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${bannerTone}" data-render-section="command-banner">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${escapeHtml(options.kicker)}</p>
            <strong>${escapeHtml(guidance.title)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${escapeHtml(guidance.tone)}</span>
        </div>
        <p>${escapeHtml(detail)}</p>
        <div class="kc-command-banner-actions">
          ${guidance.nextCommand ? `<code class="kc-command-chip">${escapeHtml(formatCliCommand(guidance.nextCommand, currentTargetRoot))}</code>` : ""}
          ${guidance.followUpCommand ? `<code class="kc-command-chip">${escapeHtml(formatCliCommand(guidance.followUpCommand, currentTargetRoot))}</code>` : ""}
          ${options.actionLabel ? `<button class="kc-secondary-button" type="button" data-reload-state>${escapeHtml(options.actionLabel)}</button>` : ""}
        </div>
      </section>
    </div>
  `;
}

function renderCommandBanner(): string {
  if (lastBlockedActionGuidance) {
    return renderRecoveryGuidanceBanner(lastBlockedActionGuidance, {
      kicker: "Action blocked"
    });
  }

  if (!commandState.lastResult && !commandState.lastError) {
    return "";
  }

  const tone = commandState.lastError ? "warn" : commandState.lastResult?.ok ? "success" : "warn";
  const title = commandState.lastError
    ? "Last command failed"
    : commandState.lastResult?.ok
      ? "Last command completed"
      : "Last command reported an issue";
  const detail = commandState.lastError
    ?? commandState.lastResult?.stderr
    ?? commandState.lastResult?.stdout
    ?? "No command detail was recorded.";

  return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${tone}" data-render-section="command-banner">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">Command Result</p>
            <strong>${escapeHtml(title)}</strong>
          </div>
          ${commandState.lastResult ? `<code class="kc-command-chip">${escapeHtml(commandState.lastResult.commandLabel)}</code>` : ""}
        </div>
        <p>${escapeHtml(detail)}</p>
      </section>
    </div>
  `;
}

function handleInteractiveClick(event: MouseEvent, target: HTMLElement): boolean {
  const onboardingAction = target.closest<HTMLElement>("[data-onboarding-action]");
  if (onboardingAction?.dataset.onboardingAction) {
    const action = onboardingAction.dataset.onboardingAction;
    const commandArgs = (() => {
      const raw = onboardingAction.dataset.onboardingCommandArgs;
      if (!raw) {
        return [];
      }
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
      } catch {
        return [];
      }
    })();
    if (action === "install-cli") {
      void installBundledCli({ mode: "manual" });
    } else if (action === "choose-repo") {
      void chooseRepoDirectory();
    } else if (action === "init-repo" && currentTargetRoot) {
      void executeKiwiCommand("init", [], { expectJson: false });
    } else if (action === "setup-machine") {
      void executeKiwiCommand("setup", commandArgs, { expectJson: false });
    }
    return true;
  }

  const directCommandButton = target.closest<HTMLElement>("[data-ui-command]");
  if (directCommandButton?.dataset.uiCommand) {
    const command = directCommandButton.dataset.uiCommand as UiCommandName;
    if (command === "run-auto" || command === "checkpoint" || command === "handoff") {
      toggleComposer(command as Exclude<CommandComposerMode, null>);
    } else if (command === "retry") {
      const retryText = currentState.kiwiControl?.executionPlan.lastError?.retryCommand ?? "";
      const parsed = retryText ? parseKiwiCommand(retryText) : null;
      if (parsed) {
        void executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
      } else {
        void executeKiwiCommand("retry", [], { expectJson: false });
      }
    } else {
      void executeKiwiCommand(command, commandRequiresJson(command) ? ["--json"] : [], { expectJson: commandRequiresJson(command) });
    }
    return true;
  }

  const explicitCommandButton = target.closest<HTMLElement>("[data-direct-command]");
  if (explicitCommandButton?.dataset.directCommand) {
    const parsed = parseKiwiCommand(explicitCommandButton.dataset.directCommand);
    if (parsed) {
      void executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
    } else {
      commandState.lastError = `Kiwi could not run this desktop action directly: ${explicitCommandButton.dataset.directCommand}`;
      renderState(currentState);
    }
    return true;
  }

  const packAction = target.closest<HTMLElement>("[data-pack-action]");
  if (packAction?.dataset.packAction) {
    const action = packAction.dataset.packAction;
    if (action === "clear") {
      void executePackCommand("clear");
      return true;
    }
    if (action === "set" && packAction.dataset.packId) {
      void executePackCommand("set", packAction.dataset.packId);
      return true;
    }
  }

  const submitComposer = target.closest<HTMLElement>("[data-composer-submit]");
  if (submitComposer?.dataset.composerSubmit) {
    const mode = submitComposer.dataset.composerSubmit as Exclude<CommandComposerMode, null>;
    const value = commandState.draftValue.trim();
    const constraint = deriveComposerConstraint(currentState, mode, value);
    if (constraint.blocked) {
      lastBlockedActionGuidance = buildBlockedActionGuidance(mode, constraint.reason, constraint.nextCommand);
      commandState.lastError = null;
      scheduleRenderState();
      return true;
    }
    if (!value) {
      commandState.lastError = `${mode} requires a value before running.`;
      lastBlockedActionGuidance = null;
      scheduleRenderState();
      return true;
    }
    const command = mode === "run-auto" ? "run-auto" : mode === "checkpoint" ? "checkpoint" : "handoff";
    void executeKiwiCommand(command, [value], { expectJson: false });
    return true;
  }

  if (target.closest("[data-composer-cancel]")) {
    commandState.composer = null;
    commandState.draftValue = "";
    lastBlockedActionGuidance = null;
    scheduleRenderState();
    return true;
  }

  const treeAction = target.closest<HTMLElement>("[data-tree-action]");
  if (treeAction?.dataset.treeAction && treeAction.dataset.path) {
    event.preventDefault();
    event.stopPropagation();
    const path = treeAction.dataset.path;
    const action = treeAction.dataset.treeAction;
    if (action === "open") {
      void openRepoPath(path);
    } else if (action === "focus") {
      focusedItem = { kind: "path", id: path, label: basenameForPath(path), path };
      graphSelectedPath = path;
      scheduleRenderState();
    } else {
      applyLocalContextOverride(path, action as ContextOverrideMode);
    }
    return true;
  }

  const bulkAction = target.closest<HTMLElement>("[data-tree-bulk]");
  if (bulkAction?.dataset.treeBulk) {
    const interactiveTree = deriveInteractiveTree(currentState);
    const paths = flattenContextNodes(interactiveTree.nodes).map((node) => node.path);
    if (bulkAction.dataset.treeBulk === "reset") {
      resetLocalContextOverrides();
    } else if (bulkAction.dataset.treeBulk === "undo") {
      undoLocalContextOverride();
    } else {
      pushContextOverrideHistory();
      for (const path of paths) {
        contextOverrides.set(path, bulkAction.dataset.treeBulk as ContextOverrideMode);
      }
      contextOverrideVersion += 1;
      derivedTreeCache = null;
      scheduleRenderState();
    }
    return true;
  }

  const graphNode = target.closest<HTMLElement>("[data-graph-node]");
  if (graphNode?.dataset.path) {
    const path = graphNode.dataset.path;
    focusedItem = { kind: "path", id: path, label: basenameForPath(path), path };
    graphSelectedPath = path;
    if (event.detail > 1 && graphNode.dataset.kind === "file") {
      void openRepoPath(path);
    }
    scheduleRenderState();
    return true;
  }

  const graphAction = target.closest<HTMLElement>("[data-graph-action]");
  if (graphAction?.dataset.graphAction) {
    const path = graphAction.dataset.path;
    const action = graphAction.dataset.graphAction;
    if (action === "depth-up") {
      graphDepth = Math.min(3, graphDepth + 1);
    } else if (action === "depth-down") {
      graphDepth = Math.max(1, graphDepth - 1);
    } else if (action === "reset-view") {
      graphPan = { x: 0, y: 0 };
      graphZoom = 1;
      graphNodePositions.clear();
    } else if (path) {
      if (action === "open") {
        void openRepoPath(path);
      } else if (action === "focus") {
        focusedItem = { kind: "path", id: path, label: basenameForPath(path), path };
        graphSelectedPath = path;
        scheduleRenderState();
        return true;
      } else {
        applyLocalContextOverride(path, action as ContextOverrideMode);
        return true;
      }
    }
    scheduleRenderState();
    return true;
  }

  const planAction = target.closest<HTMLElement>("[data-plan-action]");
  if (planAction?.dataset.planAction && planAction.dataset.stepId) {
    const stepId = planAction.dataset.stepId;
    const step = deriveDisplayExecutionPlanSteps(currentState).find((entry) => entry.id === stepId);
    if (!step) {
      return true;
    }
    switch (planAction.dataset.planAction) {
      case "run":
        void executePlanStepCommand(step);
        break;
      case "retry":
        if (step.retryCommand) {
          const parsed = parseKiwiCommand(step.retryCommand);
          if (parsed) {
            void executeKiwiCommand(parsed.command, parsed.args, { expectJson: parsed.args.includes("--json") });
          } else {
            void executeKiwiCommand("retry", [], { expectJson: false });
          }
        } else {
          void executeKiwiCommand("retry", [], { expectJson: false });
        }
        break;
      case "skip":
        toggleSkippedPlanStep(stepId);
        break;
      case "edit":
        startEditingPlanStep(stepId, step.displayTitle);
        break;
      case "edit-save":
        commitPlanStepEdit(stepId);
        break;
      case "edit-cancel":
        editingPlanStepId = null;
        editingPlanDraft = "";
        scheduleRenderState();
        break;
      case "move-up":
        movePlanStep(stepId, -1);
        break;
      case "move-down":
        movePlanStep(stepId, 1);
        break;
      case "focus":
        focusedItem = { kind: "step", id: step.id, label: step.displayTitle };
        scheduleRenderState();
        break;
    }
    return true;
  }

  const inspectorAction = target.closest<HTMLElement>("[data-inspector-action]");
  if (inspectorAction?.dataset.inspectorAction) {
    const action = inspectorAction.dataset.inspectorAction;
    if (action === "approve" || action === "reject") {
      const markerKey = focusedItem?.id;
      if (markerKey) {
        approvalMarkers.set(markerKey, action === "approve" ? "approved" : "rejected");
      }
      scheduleRenderState();
      return true;
    }
    if (action === "add-to-context" && focusedItem?.kind === "path") {
      applyLocalContextOverride(focusedItem.path, "include");
      return true;
    }
    if (action === "validate") {
      void executeKiwiCommand("validate", [], { expectJson: true });
      return true;
    }
    if (action === "handoff") {
      toggleComposer("handoff");
      return true;
    }
  }

  return false;
}

function commandRequiresJson(command: UiCommandName): boolean {
  return ["guide", "next", "validate", "status", "trace"].includes(command);
}

function normalizeRenderProbeView(view: string | null | undefined): NavView | null {
  if (!view) {
    return null;
  }
  const normalized = view.trim().toLowerCase();
  return NAV_ITEMS.some((item) => item.id === normalized) ? (normalized as NavView) : null;
}

function reportRenderProbe(state: RepoControlState): void {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  const bootVisible = Boolean(bootOverlay && !bootOverlay.classList.contains("is-hidden"));
  const loadStatus = buildLoadStatus(state);
  const visibleSections = [...document.querySelectorAll<HTMLElement>("[data-render-section]")]
    .map((element) => element.dataset.renderSection ?? "")
    .filter((value): value is string => value.length > 0);
  const visibleCommands = [...document.querySelectorAll<HTMLElement>("[data-ui-command]")]
    .map((element) => element.dataset.uiCommand ?? "")
    .filter((value): value is string => value.length > 0);
  const selectablePackIds = [...document.querySelectorAll<HTMLElement>("[data-pack-action=\"set\"][data-pack-id]")]
    .map((element) => element.dataset.packId ?? "")
    .filter((value): value is string => value.length > 0);
  const historyLineCount = document.querySelectorAll(".kc-log-body .kc-log-line").length;
  const executionPlan = state.kiwiControl?.executionPlan;
  const currentStep =
    state.runtimeDecision.currentStepId
    ?? executionPlan?.steps[executionPlan.currentStepIndex]?.id
    ?? state.kiwiControl?.workflow.currentStepId
    ?? null;

  const payload = {
    mounted: Boolean(window.__KIWI_BOOT_API__?.mounted),
    bootVisible,
    activeView,
    activeMode,
    targetRoot: state.targetRoot,
    settledOnTarget:
      Boolean(window.__KIWI_BOOT_API__?.mounted)
      && !bootVisible
      && state.targetRoot === currentTargetRoot
      && !isLoadingRepoState,
    selectedPack: state.mcpPacks.selectedPack.id,
    selectedPackSource: state.mcpPacks.selectedPackSource,
    aiSetupDetected: state.machineAdvisory.inventory.some((entry) => entry.name === "ai-setup" && entry.installed),
    machineSetupStatus:
      state.machineAdvisory.stale
        ? "stale"
        : state.machineAdvisory.systemHealth.criticalCount > 0
          || state.machineAdvisory.setupSummary.healthyConfigs.readyCount < state.machineAdvisory.setupSummary.healthyConfigs.totalCount
          || state.machineAdvisory.setupSummary.installedTools.readyCount < state.machineAdvisory.setupSummary.installedTools.totalCount
          ? "needs-work"
          : "ready",
    selectablePackIds,
    packCatalog: state.mcpPacks.available.map((pack) => ({
      id: pack.id,
      executable: pack.executable,
      unavailablePackReason: pack.unavailablePackReason
    })),
    repoMode: state.repoState.mode,
    executionState: state.executionState.lifecycle,
    executionRevision: state.executionState.revision,
    inspectorOpen: isInspectorOpen,
    mainScrollTop: Math.round(centerMainElement?.scrollTop ?? 0),
    historyLineCount,
    onboardingActions: [...document.querySelectorAll<HTMLElement>("[data-onboarding-action]")]
      .map((element) => element.dataset.onboardingAction ?? "")
      .filter((value): value is string => value.length > 0),
    currentStep,
    loadPhase: loadStatus.phase,
    loadLabel: loadStatus.label,
    loadDetail: loadStatus.detail,
    visibleSections,
    visibleCommands
  };

  const fingerprint = JSON.stringify(payload);
  if (fingerprint === lastRenderProbeFingerprint) {
    return;
  }

  lastRenderProbeFingerprint = fingerprint;
  void invoke("write_render_probe", { payload }).catch(() => {
    // Probe reporting is opt-in and must never affect the product flow.
  });
}

interface RenderActionPayload {
  actionType: "click-pack" | "clear-pack" | "switch-view" | "switch-mode" | "set-main-scroll";
  packId?: string;
  view?: string;
  mode?: UiMode;
  y?: number;
}

async function consumePendingRenderAction(): Promise<void> {
  if (!isTauriBridgeAvailable() || renderActionInFlight) {
    return;
  }
  renderActionInFlight = true;
  try {
    const action = await invoke<RenderActionPayload | null>("consume_render_action");
    if (!action) {
      return;
    }
    if (action.actionType === "click-pack" && action.packId) {
      const button = document.querySelector<HTMLElement>(`[data-pack-action="set"][data-pack-id="${escapeSelectorValue(action.packId)}"]`);
      if (button) {
        button.click();
        return;
      }
      const summary = document.querySelector<HTMLElement>(`[data-pack-card="true"][data-pack-id="${escapeSelectorValue(action.packId)}"] summary`);
      summary?.click();
      return;
    }
    if (action.actionType === "clear-pack") {
      const clearButton = document.querySelector<HTMLElement>("[data-pack-action=\"clear\"]");
      clearButton?.click();
      return;
    }
    if (action.actionType === "switch-view" && action.view) {
      const nextView = normalizeRenderProbeView(action.view);
      if (nextView && nextView !== activeView) {
        activeView = nextView;
        pendingCenterScrollReset = true;
        syncInspectorOpenState();
      }
      scheduleRenderState();
      scheduleMachineHydrationForView(activeView, false);
      return;
    }
    if (action.actionType === "switch-mode" && action.mode) {
      activeMode = action.mode;
      if (activeMode === "execution") {
        isLogDrawerOpen = false;
        activeLogTab = "history";
      }
      syncInspectorOpenState();
      scheduleRenderState();
      return;
    }
    if (action.actionType === "set-main-scroll" && typeof action.y === "number") {
      centerMainElement.scrollTop = action.y;
      reportRenderProbe(currentState);
    }
  } catch {
    // Render actions are test-only and must never affect normal product flow.
  } finally {
    renderActionInFlight = false;
  }
}

function renderState(state: RepoControlState): void {
  currentState = state;
  syncInteractiveSessionState(state);

  railNavElement.innerHTML = renderRailNav();
  topbarElement.innerHTML = renderTopBar(state);
  renderCenterSurface(state);
  inspectorElement.innerHTML = renderInspector(state);
  logDrawerElement.innerHTML = renderLogDrawer(state);

  workspaceSurfaceElement.classList.toggle("is-inspector-open", isInspectorOpen);
  workspaceSurfaceElement.classList.toggle("is-log-open", isLogDrawerOpen);
  inspectorElement.classList.toggle("is-hidden", !isInspectorOpen);
  logDrawerElement.classList.toggle("is-hidden", !isLogDrawerOpen);
  if (pendingCenterScrollReset) {
    centerMainElement.scrollTop = 0;
    pendingCenterScrollReset = false;
  }
  if (!window.__KIWI_BOOT_API__?.mounted) {
    finalizeInitialRender();
  }
  reportRenderProbe(state);
}

function renderCenterSurface(state: RepoControlState): void {
  centerMainElement.innerHTML = `${renderCommandBanner()}${renderCenterView(state)}`;
  graphViewportElement = null;
  if (activeView !== "graph") {
    activeGraphProjection = null;
  }
}

function scheduleRenderState(): void {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    renderState(currentState);
  });
}

function scheduleCenterRender(): void {
  if (centerRenderQueued || renderQueued) {
    return;
  }
  centerRenderQueued = true;
  window.requestAnimationFrame(() => {
    centerRenderQueued = false;
    renderCenterSurface(currentState);
  });
}

function renderRailNav(): string {
  const primaryViews = NAV_ITEMS.filter((item) => item.id === "overview" || item.id === "context");
  const inspectViews = NAV_ITEMS.filter((item) => item.id !== "overview" && item.id !== "context");
  const renderItem = (item: typeof NAV_ITEMS[number]) => `
    <button class="kc-rail-button ${item.id === activeView ? "is-active" : ""}" data-view="${item.id}" type="button">
      <span class="kc-rail-icon">${item.icon}</span>
      <span class="kc-rail-label">${escapeHtml(item.label)}</span>
    </button>
  `;
  return `
    <div class="kc-rail-group">
      <span class="kc-rail-group-label">Main</span>
      ${primaryViews.map(renderItem).join("")}
    </div>
    <div class="kc-rail-group kc-rail-group-secondary">
      <span class="kc-rail-group-label">Inspect</span>
      ${inspectViews.map(renderItem).join("")}
    </div>
  `;
}

function renderTopBar(state: RepoControlState): string {
  const decision = buildDecisionSummary(state);
  const repoLabel = getRepoLabel(state.targetRoot);
  const phase = getPanelValue(state.repoOverview, "Current phase");
  const validationState = getPanelValue(state.repoOverview, "Validation state");
  const topMetadata = buildTopMetadataGroups({
    state: {
      projectType: state.projectType,
      executionMode: state.executionMode,
      validationState,
      decision
    }
  });
  const primaryBanner = buildPrimaryBannerState({
    loadStatus: buildLoadStatus(state),
    activeView
  });
  const themeLabel = activeTheme === "dark" ? "Light mode" : "Dark mode";
  const currentTask = state.kiwiControl?.contextView.task ?? state.kiwiControl?.nextActions.actions[0]?.action ?? "";
  const retryEnabled = Boolean(state.runtimeDecision.recovery?.retryCommand) || Boolean(currentTargetRoot);
  const composerConstraint =
    commandState.composer
      ? deriveComposerConstraint(state, commandState.composer, commandState.draftValue)
      : null;
  const actionCluster = buildExecutionActionCluster({
    nextActionLabel: state.runtimeDecision.nextAction?.action ?? decision.nextAction,
    nextCommand: state.runtimeDecision.nextAction?.command ?? state.runtimeDecision.nextCommand,
    retryEnabled,
    hasTask: Boolean(currentTask),
    handoffAvailable: state.specialists.handoffTargets.length > 0
  });
  const runtimeBadge = desktopRuntimeInfo
    ? `${desktopRuntimeInfo.runtimeMode === "installed-user" ? "desktop" : "source"} · ${desktopRuntimeInfo.buildSource}`
    : state.runtimeIdentity
      ? `runtime · ${state.runtimeIdentity.packagingSourceCategory}`
      : null;

  return renderTopBarView({
    state,
    decision,
    repoLabel,
    phase,
    validationState,
    topMetadata,
    primaryBanner,
    actionCluster,
    runtimeBadge,
    themeLabel,
    activeTheme,
    activeMode,
    isLogDrawerOpen,
    isInspectorOpen,
    currentTargetRoot,
    commandState,
    currentTask,
    retryEnabled,
    composerConstraint,
    helpers: buildUiRenderHelpers()
  });
}

function describeMachineHydration(): string {
  const sectionCount = machineHydrationActiveSections.size;
  if (sectionCount === 0) {
    return "Refreshing machine-local diagnostics in the background.";
  }

  const labels = [...machineHydrationActiveSections].map((section) => {
    switch (section) {
      case "mcpInventory":
        return "MCP inventory";
      case "optimizationLayers":
        return "optimization layers";
      case "setupPhases":
        return "setup phases";
      case "configHealth":
        return "config health";
      default:
        return section;
    }
  });

  return `Refreshing ${labels.join(", ")}${sectionCount > 1 ? " in the background" : ""}.`;
}

function buildRepoRecoveryGuidance(state: RepoControlState): RecoveryGuidance | null {
  return deriveRepoRecoveryGuidance(state, {
    lastRepoLoadFailure
  });
}

function buildReadinessEnv(state: RepoControlState): ReadinessEnv {
  return {
    commandState: {
      loading: commandState.loading,
      activeCommand: commandState.activeCommand
    },
    currentLoadSource,
    currentTargetRoot,
    isLoadingRepoState,
    isRefreshingFreshRepoState,
    lastRepoLoadFailure,
    lastReadyStateSignal,
    readyStatePulseMs: READY_STATE_PULSE_MS,
    machineHydrationInFlight,
    machineHydrationDetail: describeMachineHydration(),
    activeTargetHint: buildActiveTargetHintModel(state),
    recoveryGuidance: buildRepoRecoveryGuidance(state),
    isMachineHeavyViewActive: isMachineHeavyView(activeView),
    machineAdvisoryStale: state.machineAdvisory.stale
  };
}

function buildLoadStatus(state: RepoControlState): {
  visible: boolean;
  label: string;
  detail: string;
  progress: number;
  tone: "loading" | "running" | "ready" | "warm" | "degraded" | "blocked";
  phase: DesktopReadinessState["phase"];
  nextCommand: string | null;
} {
  return buildLoadStatusModel(state, buildReadinessEnv(state));
}

function buildDecisionSummary(state: RepoControlState): DecisionSummary {
  return buildDecisionSummaryModel(state, {
    isLoadingRepoState,
    isRefreshingFreshRepoState,
    hasWarmSnapshot: state.loadState.source === "warm-snapshot" || state.loadState.source === "stale-snapshot",
    formatTimestamp
  });
}

function renderHeaderMeta(label: string, value: string): string {
  return `
    <div class="kc-inline-meta">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildUiRenderHelpers(): RenderHelperSet {
  return {
    escapeHtml,
    escapeAttribute,
    iconSvg,
    iconLabel,
    formatCliCommand,
    renderHeaderBadge,
    renderHeaderMeta,
    renderPanelHeader,
    renderInlineBadge,
    renderNoteRow,
    renderEmptyState,
    renderStatCard,
    renderInfoRow,
    renderListBadges,
    renderExplainabilityBadge,
    renderGateRow,
    renderBulletRow,
    deriveSignalImpact,
    formatInteger,
    formatPercent,
    formatCurrency,
    formatTimestamp,
    formatTokensShort
  };
}

function renderCenterView(state: RepoControlState): string {
  switch (activeView) {
    case "context":
      return renderContextView(state);
    case "graph":
      return renderGraphView(state);
    case "tokens":
      return renderTokensView(state);
    case "feedback":
      return renderFeedbackView(state);
    case "mcps":
      return renderMcpView(state);
    case "specialists":
      return renderSpecialistsView(state);
    case "system":
      return renderSystemView(state);
    case "validation":
      return renderValidationView(state);
    case "machine":
      return renderMachineView(state);
    case "overview":
    default:
      return renderOverviewView(state);
  }
}

function deriveReadinessSummary(state: RepoControlState): { label: string; detail: string } {
  return deriveReadinessSummaryModel(state, buildReadinessEnv(state));
}

function renderOverviewView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const interactiveTree = deriveInteractiveTree(state);
  const readiness = deriveReadinessSummary(state);
  const repoRecoveryGuidance = buildRepoRecoveryGuidance(state);
  const primaryActionCommand = formatCliCommand(kc.nextActions.actions[0]?.command, state.targetRoot);
  const currentFocus = getPanelValue(state.continuity, "Current focus");
  const activeSpecialist = state.specialists.activeProfile?.name ?? state.specialists.activeSpecialist;
  const selectedTask = kc.contextView.task ?? "No prepared task";
  const overviewHero = buildOverviewHeroState({
    state: {
      repoTitle: state.repoState.title,
      repoDetail: state.repoState.detail,
      nextActionSummary: kc.nextActions.summary,
      primaryAction: kc.nextActions.actions[0] ?? null
    },
    currentFocus,
    primaryActionCommand
  });
  const explainSelectionEntries = buildExplainSelectionEntries(kc.fileAnalysis.selected);
  const blockedWorkflowEntries = buildBlockedWorkflowEntries({
    targetRoot: state.targetRoot,
    recoveryGuidance: repoRecoveryGuidance,
    executionPlan: kc.executionPlan
  });
  const onboarding = buildOnboardingPanelModel({
    runtimeInfo: desktopRuntimeInfo,
    targetRoot: state.targetRoot,
    repoMode: state.repoState.mode,
    machineSetup: {
      needsAttention:
        state.machineAdvisory.stale
        || state.machineAdvisory.systemHealth.criticalCount > 0
        || state.machineAdvisory.setupSummary.healthyConfigs.readyCount < state.machineAdvisory.setupSummary.healthyConfigs.totalCount
        || state.machineAdvisory.setupSummary.installedTools.readyCount < state.machineAdvisory.setupSummary.installedTools.totalCount,
      recommendedProfile: desktopRuntimeInfo?.cli.installed ? "desktop-only" : "desktop-plus-cli",
      detail: state.machineAdvisory.stale
        ? "Refresh and apply Kiwi-managed machine setup before trusting deeper machine guidance."
        : "Apply Kiwi-managed machine setup and repo wiring with one guided flow."
    }
  });

  return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-panel-primary" data-render-section="overview-primary-hero">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${iconLabel(iconSvg("overview"), "Next Action")}
            ${renderHeaderBadge(overviewHero.badgeLabel, overviewHero.badgeTone)}
          </div>
          <h1>${escapeHtml(overviewHero.title)}</h1>
          <p>${escapeHtml(overviewHero.detail)}</p>
        </div>
        <div class="kc-primary-footer">
          ${overviewHero.command ? `<code class="kc-command-chip">${escapeHtml(overviewHero.command)}</code>` : ""}
          <span>${escapeHtml(overviewHero.supportingText)}</span>
        </div>
      </section>

      ${onboarding ? renderOnboardingPanelView(onboarding, buildUiRenderHelpers()) : ""}

      <div class="kc-stat-grid">
        ${renderStatCard("Repo State", state.repoState.title, state.validation.ok ? "ready to use" : `${state.validation.errors + state.validation.warnings} issues`, state.validation.ok ? "success" : "warn")}
        ${renderStatCard("Task", selectedTask, kc.contextView.confidenceDetail ?? "current working set", "neutral")}
        ${renderStatCard("Selected Files", String(interactiveTree.selectedCount), "current bounded context", "neutral")}
        ${renderStatCard("Lifecycle", state.executionState.lifecycle, readiness.detail, state.executionState.lifecycle === "blocked" || state.executionState.lifecycle === "failed" ? "warn" : "neutral")}
      </div>

      ${blockedWorkflowEntries.length > 0
        ? `
          <section class="kc-panel" data-render-section="blocked-workflow-fix">
            ${renderPanelHeader("How To Unblock", "Follow the recovery steps below.")}
            <div class="kc-stack-list">
              ${blockedWorkflowEntries.map((entry, index) => renderNoteRow(`${index + 1}. ${entry.title}`, entry.command, entry.detail)).join("")}
            </div>
          </section>
        `
        : ""}

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Repo State", "Current repo truth and routing for this session.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Project type", state.projectType)}
            ${renderInfoRow("Execution mode", state.executionMode)}
            ${renderInfoRow("Active specialist", activeSpecialist)}
            ${renderInfoRow("Selected pack", state.mcpPacks.selectedPack.name ?? state.mcpPacks.selectedPack.id)}
            ${renderInfoRow("Next action", primaryActionCommand || "No repo-scoped next command is recorded.")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Task Summary", "The current working set and why it matters.")}
          <div class="kc-keyline-value">
            <strong>${escapeHtml(selectedTask)}</strong>
            <span>${escapeHtml((kc.indexing.selectionReason ?? kc.contextView.reason ?? kc.nextActions.summary) || state.repoState.detail)}</span>
          </div>
          <div class="kc-stack-list">
            ${renderNoteRow("Current focus", "repo-local", currentFocus)}
            ${renderNoteRow(
              "Review pack",
              kc.repoIntelligence.reviewPackAvailable ? (kc.repoIntelligence.reviewPackPath ?? "ready") : "not generated",
              kc.repoIntelligence.reviewPackSummary ?? "Run kc review to write the compact local review workflow for the current diff."
            )}
          </div>
        </section>
      </div>

      <section class="kc-panel" data-render-section="explain-selection">
        ${renderPanelHeader("Explain This Selection", "Why the most important files are in the current working set.")}
        ${explainSelectionEntries.length > 0
          ? `<div class="kc-stack-list">${explainSelectionEntries.slice(0, 6).map((entry) => renderNoteRow(entry.title, entry.metric, entry.note)).join("")}</div>`
          : renderEmptyState("No selected-file reasoning is available yet. Run kc prepare to build a bounded working set first.")}
      </section>

      ${renderExecutionPlanPanel(state)}

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${renderPanelHeader("Context Tree", "What Kiwi selected, considered, and ignored from the live selector state.")}
          ${renderHeaderBadge(kc.contextView.confidence?.toUpperCase() ?? "UNKNOWN", kc.contextView.confidence === "high" ? "success" : kc.contextView.confidence === "low" ? "warn" : "neutral")}
        </div>
        ${interactiveTree.nodes.length > 0
          ? renderContextTree(interactiveTree)
          : renderEmptyState('Run kc prepare "your task" to build a repo-local context tree.')}
      </section>
    </div>
  `;
}

function renderContextView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const ctx = kc.contextView;
  const indexing = kc.indexing;
  const interactiveTree = deriveInteractiveTree(state);
  const selectedFiles = deriveInteractiveSelectedFiles(state);
  const topLevelMap = interactiveTree.nodes.slice(0, 8);
  const indexingMechanics = buildIndexingMechanicsItems(state);

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Context Selection</p>
          <h1>${escapeHtml(ctx.task ?? "No prepared task")}</h1>
          <p>${escapeHtml(ctx.confidenceDetail ?? "Kiwi Control only shows files the selector actually considered.")}</p>
        </div>
        <div class="kc-header-metrics">
          ${renderSmallMetric(String(ctx.tree.selectedCount), "selected")}
          ${renderSmallMetric(String(ctx.tree.candidateCount), "candidate")}
          ${renderSmallMetric(String(ctx.tree.excludedCount), "excluded")}
        </div>
      </section>

      <div class="kc-context-grid">
        <section class="kc-panel">
          <div class="kc-panel-head-row">
            ${renderPanelHeader("Repo Tree", "Selected, candidate, and excluded files grounded in live selector state.")}
            <div class="kc-inline-badges">
              <button class="kc-secondary-button" type="button" data-tree-bulk="include">Include visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="exclude">Exclude visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="reset">Reset local edits</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="undo">Undo</button>
              <button class="kc-secondary-button" type="button" data-reload-state>${iconSvg("refresh")}Refresh</button>
            </div>
          </div>
          <p class="kc-support-copy">Local include, exclude, and ignore edits stay in this desktop session until a CLI or runtime write commits them.</p>
          ${interactiveTree.nodes.length > 0
            ? renderContextTree(interactiveTree)
            : renderEmptyState('Run kc prepare "your task" to build the repo tree from live selection signals.')}
        </section>

        <section class="kc-panel">
          ${renderPanelHeader("Navigation Map", "Use this as a high-density orientation strip before drilling into the full tree.")}
          ${topLevelMap.length > 0
            ? `<div class="kc-inline-badges">${topLevelMap.map((node) => renderInlineBadge(`${node.name}:${node.status}`)).join("")}</div>`
            : renderEmptyState("No top-level repo map is available yet.")}
          <div class="kc-divider"></div>
          ${renderPanelHeader("Selection State", ctx.reason ?? "No selection reason recorded.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Confidence", ctx.confidence?.toUpperCase() ?? "UNKNOWN")}
            ${renderInfoRow("Scope area", indexing.scopeArea ?? "unknown")}
            ${renderInfoRow("Selected files", String(selectedFiles.length))}
            ${renderInfoRow("Observed files", String(indexing.observedFiles))}
            ${renderInfoRow("Indexed files", String(indexing.indexedFiles))}
            ${renderInfoRow("Impact files", String(indexing.impactFiles))}
            ${renderInfoRow("Keyword matches", String(indexing.keywordSignals))}
            ${renderInfoRow("Import neighbors", String(indexing.importSignals))}
            ${renderInfoRow("Discovery depth", String(indexing.maxDepthExplored))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Coverage</p>
            <p class="kc-support-copy">${escapeHtml(indexing.coverageNote)}</p>
            <div class="kc-inline-badges">
              ${renderInlineBadge(`visited ${indexing.visitedDirectories} dirs`)}
              ${renderInlineBadge(indexing.fileBudgetReached ? "file budget hit" : "file budget clear")}
              ${renderInlineBadge(indexing.directoryBudgetReached ? "dir budget hit" : "dir budget clear")}
            </div>
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Selected files</p>
            ${selectedFiles.length > 0 ? renderListBadges(selectedFiles) : renderEmptyState("No active files are selected yet.")}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("How Kiwi Indexed This Repo", "These are the actual scan and signal mechanics behind the current tree, not generic advice.")}
        <div class="kc-stack-list">
          ${indexingMechanics.map((item) => renderNoteRow(item.title, item.metric, item.note)).join("")}
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("FILE ANALYSIS PANEL", "Measured scan counts plus why files were selected, excluded, or skipped.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Total files", String(kc.fileAnalysis.totalFiles))}
            ${renderInfoRow("Scanned files", String(kc.fileAnalysis.scannedFiles))}
            ${renderInfoRow("Skipped files", String(kc.fileAnalysis.skippedFiles))}
            ${renderInfoRow("Selected files", String(kc.fileAnalysis.selectedFiles))}
            ${renderInfoRow("Excluded files", String(kc.fileAnalysis.excludedFiles))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${kc.fileAnalysis.selected.slice(0, 3).map((entry) => renderNoteRow(entry.file, "selected", entry.selectionWhy ?? entry.reasons.join(", "))).join("")}
            ${kc.fileAnalysis.excluded.slice(0, 3).map((entry) => renderNoteRow(entry.file, "excluded", entry.note ?? entry.reasons.join(", "))).join("")}
            ${kc.fileAnalysis.skipped.slice(0, 3).map((entry) => renderNoteRow(entry.path, "skipped", entry.reason)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("CONTEXT TRACE", "Initial signals, expansion steps, and final bounded selection.")}
          ${kc.contextTrace.expansionSteps.length > 0
            ? `<div class="kc-fold-grid">${kc.contextTrace.expansionSteps.map((step) => `
                <details class="kc-fold-card" open>
                  <summary>
                    <div>
                      <strong>${escapeHtml(step.step)}</strong>
                      <span>${escapeHtml(step.summary)}</span>
                    </div>
                    ${renderHeaderBadge(`${step.filesAdded.length} files`, "neutral")}
                  </summary>
                  <div class="kc-fold-body">
                    ${step.filesAdded.length > 0 ? renderListBadges(step.filesAdded.slice(0, 8)) : renderEmptyState("No files recorded for this step.")}
                    ${step.filesRemoved && step.filesRemoved.length > 0 ? `<div class="kc-divider"></div>${renderListBadges(step.filesRemoved.slice(0, 8))}` : ""}
                  </div>
                </details>
              `).join("")}</div>`
            : renderEmptyState("Run kc prepare to record a trace of how Kiwi built the working set.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Dependency Chains", "Shortest structural paths that pulled files into the working set.")}
        ${kc.fileAnalysis.selected.some((entry) => Array.isArray(entry.dependencyChain) && entry.dependencyChain.length > 1)
          ? `<div class="kc-stack-list">${kc.fileAnalysis.selected
              .filter((entry) => Array.isArray(entry.dependencyChain) && entry.dependencyChain.length > 1)
              .slice(0, 6)
              .map((entry) => renderNoteRow(entry.file, "chain", (entry.dependencyChain ?? []).join(" -> ")))
              .join("")}</div>`
          : renderEmptyState("No structural dependency chain was needed for the current selection.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("INDEXING", "How the repo scan progressed, where it stopped, and which ignore rules were applied.")}
        <div class="kc-info-grid">
          ${renderInfoRow("Directories visited", String(indexing.visitedDirectories))}
          ${renderInfoRow("Skipped directories", String(indexing.skippedDirectories))}
          ${renderInfoRow("Depth reached", String(indexing.maxDepthExplored))}
          ${renderInfoRow("Files discovered", String(indexing.discoveredFiles))}
          ${renderInfoRow("Files analyzed", String(indexing.analyzedFiles))}
          ${renderInfoRow("Index reused", String(indexing.indexReusedFiles))}
          ${renderInfoRow("Index refreshed", String(indexing.indexUpdatedFiles))}
          ${renderInfoRow("Ignore rules", String(indexing.ignoreRulesApplied.length))}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-inline-badges">
          ${renderExplainabilityBadge("heuristic", kc.contextTrace.honesty.heuristic)}
          ${renderExplainabilityBadge("low confidence", kc.contextTrace.honesty.lowConfidence)}
          ${renderExplainabilityBadge("partial scan", kc.contextTrace.honesty.partialScan || indexing.partialScan)}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${indexing.ignoreRulesApplied.slice(0, 4).map((rule) => renderBulletRow(rule)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderGraphView(state: RepoControlState): string {
  const graph = deriveGraphModel(state);
  const focusedNode = graph.nodes.find((node) => node.path === (graphSelectedPath ?? (focusedItem?.kind === "path" ? focusedItem.path : null))) ?? null;
  return renderGraphViewPanel({
    state,
    graph,
    focusedNode,
    graphDepth,
    graphPan,
    graphZoom,
    graphMechanics: buildGraphMechanicsItems(state, graph),
    treeMechanics: buildTreeMechanicsItems(state),
    helpers: buildUiRenderHelpers()
  });
}

function renderValidationView(state: RepoControlState): string {
  const issues = state.validation.issues ?? [];
  const warnings = issues.filter((issue) => issue.level === "warn");
  const errors = issues.filter((issue) => issue.level === "error");

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Validation</p>
          <h1>${escapeHtml(state.repoState.title)}</h1>
          <p>${escapeHtml(state.repoState.detail)}</p>
        </div>
        <button class="kc-secondary-button" type="button" data-reload-state>${iconSvg("refresh")}Reload state</button>
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Passing", state.validation.ok ? "yes" : "no", "repo contract", state.validation.ok ? "success" : "warn")}
        ${renderStatCard("Errors", String(state.validation.errors), "blocking", state.validation.errors > 0 ? "critical" : "neutral")}
        ${renderStatCard("Warnings", String(state.validation.warnings), "non-blocking", state.validation.warnings > 0 ? "warn" : "neutral")}
        ${renderStatCard("Memory", `${state.memoryBank.filter((entry) => entry.present).length}/${state.memoryBank.length}`, "surfaces present", "neutral")}
      </div>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${renderTabButton("all", activeValidationTab, "All")}
          ${renderTabButton("issues", activeValidationTab, `Issues ${errors.length + warnings.length > 0 ? `(${errors.length + warnings.length})` : ""}`, "data-validation-tab")}
          ${renderTabButton("pending", activeValidationTab, "Pending", "data-validation-tab")}
        </div>
        ${renderValidationTabBody(state)}
      </section>
    </div>
  `;
}

function renderValidationTabBody(state: RepoControlState): string {
  const issues = state.validation.issues ?? [];
  const flaggedIssues = issues.filter((issue) => issue.level === "error" || issue.level === "warn");

  if (activeValidationTab === "issues") {
    return flaggedIssues.length > 0
      ? `<div class="kc-stack-list">${flaggedIssues.map(renderValidationIssueCard).join("")}</div>`
      : renderEmptyState("No warnings or errors are currently recorded in repo-local validation.");
  }

  if (activeValidationTab === "pending") {
    return renderEmptyState("Kiwi Control does not infer pending checks beyond repo-local validation state.");
  }

  return `
    <div class="kc-two-column">
      <section class="kc-subpanel">
        ${renderPanelHeader("Repo Contract", state.repoState.sourceOfTruthNote)}
        <div class="kc-info-grid">
          ${state.repoOverview.map((item) => renderInfoRow(item.label, item.value, item.tone === "warn" ? "warn" : "default")).join("")}
        </div>
      </section>
      <section class="kc-subpanel">
        ${renderPanelHeader("Continuity", "Latest checkpoint, handoff, reconcile, and open risk state.")}
        <div class="kc-info-grid">
          ${state.continuity.map((item) => renderInfoRow(item.label, item.value, item.tone === "warn" ? "warn" : "default")).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderActivityView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const items = buildActivityItems(state);

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Activity</p>
          <h1>Repo Activity</h1>
          <p>Timeline of real execution, continuity, and validation events.</p>
        </div>
        ${renderHeaderBadge(`${kc.execution.totalExecutions} executions`, "neutral")}
      </section>

      <section class="kc-panel kc-timeline-panel">
        ${items.length > 0
          ? `<div class="kc-timeline">${items.map((item) => `
              <article class="kc-timeline-item">
                <div class="kc-timeline-marker ${item.tone}">
                  ${item.icon}
                </div>
                <div class="kc-timeline-copy">
                  <div class="kc-timeline-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.timestamp)}</span>
                  </div>
                  <p>${escapeHtml(item.detail)}</p>
                  ${item.meta ? `<div class="kc-inline-badges">${renderListBadges(item.meta)}</div>` : ""}
                </div>
              </article>
            `).join("")}</div>`
          : renderEmptyState("No activity has been recorded yet.")}
      </section>
    </div>
  `;
}

function renderTokensView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const tokens = kc.tokenAnalytics;

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Token Analytics</p>
          <h1>${escapeHtml(tokens.task ?? "No token estimate yet")}</h1>
          <p>${escapeHtml(tokens.estimateNote ?? 'Run kc prepare "your task" to generate a repo-local rough estimate.')}</p>
        </div>
        ${renderHeaderBadge(tokens.estimationMethod ?? "not generated", "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Selected", `~${formatTokensShort(tokens.selectedTokens)}`, "approximate", "neutral")}
        ${renderStatCard("Full Repo", `~${formatTokensShort(tokens.fullRepoTokens)}`, "approximate", "neutral")}
        ${renderStatCard("Saved", `~${tokens.savingsPercent}%`, "approximate", "success")}
        ${renderStatCard("Measured Files", `${tokens.fileCountSelected}/${tokens.fileCountTotal}`, "direct count", "neutral")}
        ${renderStatCard("Measured Usage", kc.measuredUsage.available ? formatTokensShort(kc.measuredUsage.totalTokens) : "unavailable", kc.measuredUsage.available ? `${kc.measuredUsage.totalRuns} real runs` : "falling back to estimate", kc.measuredUsage.available ? "success" : "warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Measured Usage", kc.measuredUsage.note)}
          ${kc.measuredUsage.available
            ? `<div class="kc-stack-list">
                ${renderNoteRow("Source", kc.measuredUsage.source, kc.measuredUsage.note)}
                ${kc.measuredUsage.workflows.slice(0, 4).map((workflow) => renderNoteRow(workflow.workflow, `${formatTokensShort(workflow.tokens)} tokens`, `${workflow.runs} runs`)).join("")}
              </div>`
            : renderEmptyState("No measured repo usage was found in local session or execution logs.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Estimated Usage", tokens.estimationMethod ?? "No estimate method recorded.")}
          <div class="kc-stack-list">
            ${renderNoteRow("Selected working set", `~${formatTokensShort(tokens.selectedTokens)}`, "Heuristic estimate for the current bounded context.")}
            ${renderNoteRow("Full repo", `~${formatTokensShort(tokens.fullRepoTokens)}`, "Heuristic estimate for all scanned repo files.")}
            ${renderNoteRow("Savings", `~${tokens.savingsPercent}%`, "Measured file counts with heuristic token estimation.")}
          </div>
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Top Directories", "Measured directories with the largest share of estimated token usage.")}
          ${tokens.topDirectories.length > 0
            ? `<div class="kc-bar-list">${tokens.topDirectories.slice(0, 6).map((entry) => renderBarRow(entry.directory, entry.tokens, tokens.fullRepoTokens, `${entry.fileCount} files`)).join("")}</div>`
            : renderEmptyState("No directory analytics recorded yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Context Breakdown", tokens.estimationMethod ?? "No estimate method recorded.")}
          ${renderMeterRow("Selected vs repo", tokens.selectedTokens, tokens.fullRepoTokens)}
          ${kc.wastedFiles.files.length > 0 ? renderMeterRow("Wasted within selection", kc.wastedFiles.totalWastedTokens, tokens.selectedTokens) : ""}
          <div class="kc-divider"></div>
          ${kc.wastedFiles.files.length > 0
            ? `<div class="kc-stack-list">${kc.wastedFiles.files.slice(0, 4).map((file) => renderNoteRow(file.file, `${formatTokensShort(file.tokens)} tokens`, file.reason)).join("")}</div>`
            : renderEmptyState("No wasted files are recorded in the active selection.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("How To Reduce Tokens", "Concrete actions that affect selection size, measured usage, and model tradeoffs.")}
        <div class="kc-stack-list">
          ${buildTokenGuidanceItems(state).map((entry) => renderNoteRow(entry.title, entry.metric, entry.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Why These Token Numbers Look This Way", "Token analytics here are driven by the indexed tree, selected working set, and measured local execution data when available.")}
        <div class="kc-stack-list">
          ${buildTokenMechanicsItems(state).map((entry) => renderNoteRow(entry.title, entry.metric, entry.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Heavy Directories", "Directories that dominate repo token volume.")}
        ${kc.heavyDirectories.directories.length > 0
          ? `<div class="kc-stack-list">${kc.heavyDirectories.directories.slice(0, 4).map((directory) => renderNoteRow(directory.directory, `${directory.percentOfRepo}% of repo`, directory.suggestion)).join("")}</div>`
          : renderEmptyState("No heavy-directory warnings are recorded for this repo.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("TOKEN BREAKDOWN", "Where token reduction came from, and whether that reduction is measured or heuristic.")}
        ${kc.tokenBreakdown.categories.length > 0
          ? `<div class="kc-stack-list">${kc.tokenBreakdown.categories.map((category) => renderNoteRow(
              category.category,
              `${category.basis} · ~${formatTokensShort(category.estimated_tokens_avoided)}`,
              category.note
            )).join("")}</div>`
          : renderEmptyState("No token breakdown has been recorded yet.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Measured Files", "Per-file measured usage is only shown when repo-local execution entries carry non-zero token totals.")}
        ${kc.measuredUsage.files.length > 0
          ? `<div class="kc-stack-list">${kc.measuredUsage.files.slice(0, 6).map((file) => renderNoteRow(
              file.file,
              `${formatTokensShort(file.tokens)} tokens`,
              `${file.runs} runs · ${file.attribution}`
            )).join("")}</div>`
          : renderEmptyState("No measured per-file attribution is available yet.")}
      </section>
    </div>
  `;
}

function renderMcpView(state: RepoControlState): string {
  const capabilities = state.mcpPacks.compatibleCapabilities;
  const highTrustCount = capabilities.filter((entry) => entry.trustLevel === "high").length;
  const writeCapableCount = capabilities.filter((entry) => entry.writeCapable).length;
  const approvalCount = capabilities.filter((entry) => entry.approvalRequired).length;
  const packPanel = buildPackPanelState({
    selectedPack: state.mcpPacks.selectedPack,
    selectedPackSource: state.mcpPacks.selectedPackSource,
    explicitSelection: state.mcpPacks.explicitSelection,
    available: state.mcpPacks.available
  });

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">MCP / Tool Integrations</p>
          <h1>${escapeHtml(packPanel.selectedPackCard.name)}</h1>
          <p>${escapeHtml(`${packPanel.selectedPackLabel}. ${packPanel.selectedPackCard.description}`)}</p>
        </div>
        ${renderHeaderBadge(state.mcpPacks.capabilityStatus, state.mcpPacks.capabilityStatus === "compatible" ? "success" : "warn")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Compatible MCPs", String(capabilities.length), packPanel.selectedPackSourceLabel, capabilities.length > 0 ? "success" : "warn")}
        ${renderStatCard("High Trust", String(highTrustCount), "preferred first", highTrustCount > 0 ? "success" : "neutral")}
        ${renderStatCard("Write Capable", String(writeCapableCount), "requires judgment", writeCapableCount > 0 ? "warn" : "neutral")}
        ${renderStatCard("Approval Gates", String(approvalCount), "use with care", approvalCount > 0 ? "warn" : "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel" data-render-section="mcp-selected-pack">
          ${renderPanelHeader("Selected Pack", state.mcpPacks.note)}
          <div class="kc-stack-list">
            ${renderNoteRow("Current state", packPanel.selectedPackCard.stateLabel, packPanel.selectedPackCard.sourceLabel ?? state.mcpPacks.note)}
            ${renderInfoRow("Source", packPanel.selectedPackSourceLabel)}
            ${renderInfoRow("Heuristic default", state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id)}
            ${renderInfoRow("Executable", state.mcpPacks.executable ? "yes" : "no")}
          </div>
          ${state.mcpPacks.unavailablePackReason ? `<div class="kc-divider"></div><div class="kc-stack-list">${renderNoteRow("Blocked", "warn", state.mcpPacks.unavailablePackReason)}</div>` : ""}
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${packPanel.selectedPackCard.guidance.map((item: string) => renderBulletRow(item)).join("")}
          </div>
          ${packPanel.showClearAction ? `<div class="kc-divider"></div><div class="kc-stack-list"><button class="kc-action-button secondary" data-pack-action="clear">Clear explicit pack</button></div>` : ""}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Compatible MCP Capabilities", "These integrations are active for the selected pack, repo profile, and workflow role.")}
          ${capabilities.length > 0
            ? `<div class="kc-stack-list">${capabilities.map((capability) => renderCapabilityCard(capability)).join("")}</div>`
            : renderEmptyState("No compatible MCP integrations are currently exposed for this workflow role and profile.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel" data-render-section="mcp-selectable-packs">
          ${renderPanelHeader("Selectable Packs", "Executable packs you can switch to in this repo.")}
          <div class="kc-fold-grid">
            ${packPanel.executablePackCards.length > 0
              ? packPanel.executablePackCards.map((pack) => `
            <details class="kc-fold-card" data-pack-card="true" data-pack-id="${escapeHtml(pack.id)}">
              <summary>
                <div>
                  <strong>${escapeHtml(pack.name)}</strong>
                  <span>${escapeHtml(pack.description)}</span>
                </div>
                ${renderHeaderBadge(pack.stateLabel, pack.stateTone)}
              </summary>
              <div class="kc-fold-body">
                <div class="kc-stack-list">
                  ${pack.guidance.map((item) => renderBulletRow(item)).join("")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  ${renderInfoRow("Allowed", pack.allowedCapabilityIds.join(", ") || "none")}
                  ${renderInfoRow("Preferred", pack.preferredCapabilityIds.join(", ") || "none")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  <button class="kc-action-button" data-pack-action="set" data-pack-id="${escapeHtml(pack.id)}">Select pack</button>
                </div>
              </div>
            </details>
          `).join("")
              : renderEmptyState("No alternative executable packs are available in this repo.")}
          </div>
        </section>
        <section class="kc-panel" data-render-section="mcp-blocked-packs">
          ${renderPanelHeader("Unavailable Here", "Visible for clarity, but blocked until matching integrations are registered.")}
          ${packPanel.blockedPackCards.length > 0
            ? `<div class="kc-stack-list">${packPanel.blockedPackCards.map((pack) => `
                <div class="kc-note-row kc-note-row-blocked">
                  <div>
                    <strong>${escapeHtml(pack.name)}</strong>
                    <span>${escapeHtml(pack.blockedReason ?? "This pack is not available in the current repo.")}</span>
                  </div>
                  <button class="kc-action-button secondary" data-pack-action="blocked" data-pack-id="${escapeHtml(pack.id)}" disabled>Unavailable</button>
                </div>
              `).join("")}</div>`
            : renderEmptyState("All visible packs are currently executable in this repo.")}
        </section>
      </div>
    </div>
  `;
}

function buildTokenGuidanceItems(state: RepoControlState): Array<{ title: string; metric: string; note: string }> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const tokens = kc.tokenAnalytics;
  const items: Array<{ title: string; metric: string; note: string }> = [];

  if (isPlaceholderTask(kc.contextView.task)) {
    items.push({
      title: "Replace the placeholder task",
      metric: "task is too broad",
      note: "The current task label is generic, so Kiwi leans on repo-context and recent-file signals. Preparing with a real goal narrows the selected tree and usually lowers token estimates."
    });
  } else if (!tokens.estimationMethod) {
    items.push({
      title: "Generate a bounded estimate",
      metric: "prepare first",
      note: 'Run kc prepare with the actual task goal so Kiwi can record a selected working set before showing reduction guidance.'
    });
  } else {
    items.push({
      title: "Narrow the working set",
      metric: `${tokens.fileCountSelected}/${tokens.fileCountTotal} files`,
      note: "Use Include, Exclude, and Ignore in Context or Graph to shrink the selected tree before execution. Those tree changes are what alter the next token estimate."
    });
  }

  items.push({
    title: "Tree drives token estimates",
    metric: `${kc.contextView.tree.selectedCount} selected · ${kc.contextView.tree.excludedCount} excluded`,
    note: "The graph is a projection of the tree. If a file stays selected in the tree, it still counts toward the working-set estimate."
  });

  items.push({
    title: "Index reuse reduces rescanning",
    metric: `${kc.indexing.indexReusedFiles} reused · ${kc.indexing.indexUpdatedFiles} refreshed`,
    note: "Kiwi reuses index entries when it can and only refreshes changed or newly discovered files. The token estimate is still based on the current selected tree, not random guesses."
  });

  if (kc.wastedFiles.files.length > 0) {
    items.push({
      title: "Remove wasted files",
      metric: `~${formatTokensShort(kc.wastedFiles.totalWastedTokens)}`,
      note: `Exclude or ignore ${kc.wastedFiles.files[0]?.file ?? "low-value files"} to reduce token use without changing the task goal.`
    });
  }

  if (kc.heavyDirectories.directories.length > 0) {
    const heavyDirectory = kc.heavyDirectories.directories[0];
    if (heavyDirectory) {
      items.push({
        title: "Scope the heaviest directory",
        metric: `${heavyDirectory.percentOfRepo}%`,
        note: heavyDirectory.suggestion
      });
    }
  }

  items.push({
    title: "Understand the tradeoff",
    metric: tokens.savingsPercent > 0 ? `~${tokens.savingsPercent}% saved` : "no savings yet",
    note: "Smaller context usually lowers tokens and speeds review, but it increases the risk of missing adjacent files or reverse dependents."
  });

  if (!kc.measuredUsage.available) {
    items.push({
      title: "Collect real usage",
      metric: "estimated only",
      note: "Measured token usage appears only after local guide, validate, or execution flows record real runs. Until then, the token view is an indexed working-set estimate."
    });
  }

  return items;
}

function buildIndexingMechanicsItems(state: RepoControlState): Array<{ title: string; metric: string; note: string }> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const indexing = kc.indexing;
  const trace = kc.contextTrace.initialSignals;

  return [
    {
      title: "Index coverage",
      metric: `${indexing.indexedFiles} indexed · ${indexing.indexUpdatedFiles} refreshed · ${indexing.indexReusedFiles} reused`,
      note: indexing.coverageNote
    },
    {
      title: "Selection signals",
      metric: `${indexing.changedSignals} changed · ${indexing.importSignals} import · ${indexing.keywordSignals} keyword · ${indexing.repoContextSignals} repo`,
      note: "These are the signal buckets Kiwi used to pull files into the working set."
    },
    {
      title: "Observed tree",
      metric: `${kc.contextView.tree.selectedCount} selected · ${kc.contextView.tree.candidateCount} candidate · ${kc.contextView.tree.excludedCount} excluded`,
      note: "The repo tree is built from the current context-selection artifact. Selected files are in-scope, candidate files were considered, and excluded files were filtered out."
    },
    {
      title: "Initial evidence",
      metric: `${trace.changedFiles.length} changed · ${trace.importNeighbors.length} import neighbors · ${trace.keywordMatches.length} keyword matches`,
      note: "Before Kiwi expands scope, it starts from changed files, import neighbors, keyword matches, recent files, and repo-context files."
    }
  ];
}

function buildGraphMechanicsItems(
  state: RepoControlState,
  graph: InteractiveGraphModel
): Array<{ title: string; metric: string; note: string }> {
  const indexing = state.kiwiControl?.indexing ?? EMPTY_KC.indexing;

  return [
    {
      title: "Source of truth",
      metric: "context tree",
      note: "This graph is drawn from the current selected/candidate/excluded tree. It is not a full semantic code graph or call graph."
    },
    {
      title: "Visible projection",
      metric: `${graph.nodes.length} nodes · ${graph.edges.length} links`,
      note: `Depth ${graphDepth} controls how much of the current tree projection is visible from the repo root.`
    },
    {
      title: "Highlight behavior",
      metric: "dependency chain when available",
      note: "When Kiwi has a structural dependency chain for a file, it highlights that path. Otherwise it falls back to the ancestor path in the tree."
    },
    {
      title: "Indexed evidence behind the map",
      metric: `${indexing.changedSignals} changed · ${indexing.importSignals} import · ${indexing.keywordSignals} keyword`,
      note: "Those index signals decide which files appear in the working set before the graph turns them into a visual map."
    }
  ];
}

function buildTreeMechanicsItems(state: RepoControlState): Array<{ title: string; metric: string; note: string }> {
  const tree = state.kiwiControl?.contextView.tree ?? EMPTY_KC.contextView.tree;

  return [
    {
      title: "Selected",
      metric: String(tree.selectedCount),
      note: "Selected files are the current bounded working set. They drive validation expectations and token estimates."
    },
    {
      title: "Candidate",
      metric: String(tree.candidateCount),
      note: "Candidate files were considered relevant enough to surface, but are not currently in the selected working set."
    },
    {
      title: "Excluded",
      metric: String(tree.excludedCount),
      note: "Excluded files were filtered by the selector. Local Include/Exclude/Ignore UI edits are session-local until a real CLI command rewrites repo state."
    }
  ];
}

function buildTokenMechanicsItems(state: RepoControlState): Array<{ title: string; metric: string; note: string }> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const tokens = kc.tokenAnalytics;

  return [
    {
      title: "Estimate basis",
      metric: tokens.estimationMethod ?? "heuristic only",
      note: tokens.estimateNote ?? "Kiwi is using the indexed working set to estimate token volume."
    },
    {
      title: "Tree to token path",
      metric: `${kc.contextView.tree.selectedCount} selected files`,
      note: "The selected tree is the direct input to the working-set token estimate. Excluding a file from the tree is what reduces the next estimate."
    },
    {
      title: "Measured vs estimated",
      metric: kc.measuredUsage.available ? `${formatTokensShort(kc.measuredUsage.totalTokens)} measured` : "estimate only",
      note: kc.measuredUsage.available
        ? kc.measuredUsage.note
        : "No local execution runs have recorded measured usage yet, so the token numbers are derived from the current indexed tree."
    },
    {
      title: "Index churn",
      metric: `${kc.indexing.indexReusedFiles} reused · ${kc.indexing.indexUpdatedFiles} refreshed`,
      note: "Kiwi does not blindly rescan everything every time. It reuses indexed entries when possible, then recomputes token estimates from the current selected tree."
    }
  ];
}

function renderSpecialistsView(state: RepoControlState): string {
  const activeProfile = state.specialists.activeProfile;
  const recommendedProfile = state.specialists.recommendedProfile;

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Specialists</p>
          <h1>${escapeHtml(activeProfile?.name ?? state.specialists.activeSpecialist)}</h1>
          <p>${escapeHtml(activeProfile?.purpose ?? "Specialist routing is derived from repo-local role hints, task type, and file area.")}</p>
        </div>
        ${renderHeaderBadge(activeProfile?.riskPosture ?? "active", activeProfile?.riskPosture === "conservative" ? "success" : "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Active", activeProfile?.name ?? state.specialists.activeSpecialist, "current role fit", "neutral")}
        ${renderStatCard("Recommended", recommendedProfile?.name ?? state.specialists.recommendedSpecialist, "best next handoff", "success")}
        ${renderStatCard("Targets", String(state.specialists.handoffTargets.length), "handoff candidates", "neutral")}
        ${renderStatCard("Preferred Tools", String(activeProfile?.preferredTools?.length ?? 0), "active specialist", "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Active Specialist", "The role currently shaping the workspace and compatible capability set.")}
          ${activeProfile ? renderSpecialistCard(activeProfile) : renderEmptyState("No active specialist is currently recorded.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Routing Safety", state.specialists.safeParallelHint)}
          <div class="kc-stack-list">
            ${renderNoteRow("Current role", state.specialists.activeSpecialist, activeProfile?.purpose ?? "No active specialist profile is available.")}
            ${renderNoteRow("Recommended next", state.specialists.recommendedSpecialist, recommendedProfile?.purpose ?? "No recommended specialist profile is available.")}
            ${renderNoteRow("Handoff targets", `${state.specialists.handoffTargets.length}`, state.specialists.safeParallelHint)}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Specialist Catalog", "Available specialists for the current profile, including their role and risk posture.")}
        <div class="kc-fold-grid">
          ${(state.specialists.available ?? []).map((specialist) => `
            <details class="kc-fold-card" ${specialist.specialistId === state.specialists.activeSpecialist ? "open" : ""}>
              <summary>
                <div>
                  <strong>${escapeHtml(specialist.name ?? specialist.specialistId)}</strong>
                  <span>${escapeHtml(specialist.purpose ?? "No purpose recorded.")}</span>
                </div>
                ${renderHeaderBadge(specialist.riskPosture ?? "neutral", specialist.specialistId === state.specialists.activeSpecialist ? "success" : "neutral")}
              </summary>
              <div class="kc-fold-body">
                ${renderSpecialistCard(specialist)}
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderSystemView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const failures = Math.max(0, kc.execution.totalExecutions - Math.round((kc.execution.successRate / 100) * kc.execution.totalExecutions));
  const activityItems = buildActivityItems(state);
  const successfulWorkflowSteps = kc.workflow.steps.filter((step) => step.status === "success").length;
  const failedWorkflowStep = kc.workflow.steps.find((step) => step.status === "failed") ?? null;
  const executionPlanSnapshotNote = runtimeDerivedSnapshotNote(state, "execution-plan");
  const workflowSnapshotNote = runtimeDerivedSnapshotNote(state, "workflow");
  const runtimeLifecycleSnapshotNote = runtimeDerivedSnapshotNote(state, "runtime-lifecycle");
  const decisionLogicSnapshotNote = runtimeDerivedSnapshotNote(state, "decision-logic");

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">System State</p>
          <h1>System visibility</h1>
          <p>Execution health, indexing coverage, adaptive learning, and repo-control operating signals.</p>
        </div>
        ${renderHeaderBadge(kc.execution.tokenTrend, kc.execution.tokenTrend === "improving" ? "success" : kc.execution.tokenTrend === "worsening" ? "warn" : "neutral")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Executions", String(kc.execution.totalExecutions), "tracked runs", "neutral")}
        ${renderStatCard("Failures", String(failures), "recorded scope or completion failures", failures > 0 ? "warn" : "success")}
        ${renderStatCard("Success Rate", `${kc.execution.successRate}%`, "real completion history", kc.execution.successRate >= 80 ? "success" : "warn")}
        ${renderStatCard("Feedback Strength", kc.feedback.adaptationLevel, `${kc.feedback.totalRuns} successful runs`, kc.feedback.adaptationLevel === "active" ? "success" : "neutral")}
        ${renderStatCard("Lifecycle", state.executionState.lifecycle, state.executionState.reason ?? state.readiness.detail, state.executionState.lifecycle === "blocked" || state.executionState.lifecycle === "failed" ? "warn" : "neutral")}
        ${renderStatCard("Workflow", kc.workflow.status, kc.workflow.currentStepId ?? "no current step", kc.workflow.status === "failed" ? "warn" : "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Indexing & Structure", kc.indexing.coverageNote)}
          <div class="kc-info-grid">
            ${renderInfoRow("Observed files", String(kc.indexing.observedFiles))}
            ${renderInfoRow("Discovered files", String(kc.indexing.discoveredFiles))}
            ${renderInfoRow("Indexed files", String(kc.indexing.indexedFiles))}
            ${renderInfoRow("Impact files", String(kc.indexing.impactFiles))}
            ${renderInfoRow("Visited directories", String(kc.indexing.visitedDirectories))}
            ${renderInfoRow("Max depth", String(kc.indexing.maxDepthExplored))}
            ${renderInfoRow("Changed signals", String(kc.indexing.changedSignals))}
            ${renderInfoRow("Repo-context signals", String(kc.indexing.repoContextSignals))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-inline-badges">
            ${renderInlineBadge(kc.indexing.fileBudgetReached ? "file budget limited" : "file budget clear")}
            ${renderInlineBadge(kc.indexing.directoryBudgetReached ? "dir budget limited" : "dir budget clear")}
            ${renderInlineBadge(`scope: ${kc.indexing.scopeArea ?? "unknown"}`)}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Execution Health", "Real runtime accounting from repo-local execution history.")}
          ${activityItems.length > 0
            ? `<div class="kc-timeline">${activityItems.slice(0, 5).map((item) => `
                <article class="kc-timeline-item">
                  <div class="kc-timeline-marker ${item.tone}">
                    ${item.icon}
                  </div>
                  <div class="kc-timeline-copy">
                    <div class="kc-timeline-head">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.timestamp)}</span>
                    </div>
                    <p>${escapeHtml(item.detail)}</p>
                  </div>
                </article>
              `).join("")}</div>`
            : renderEmptyState("No execution history has been recorded yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Task Lifecycle", `A runtime-derived lifecycle snapshot from prepare to packet generation, checkpoint, and handoff. ${runtimeLifecycleSnapshotNote}`)}
          <div class="kc-stack-list">
            ${renderNoteRow("Current stage", state.executionState.lifecycle, state.executionState.reason ?? state.readiness.detail)}
            ${renderNoteRow("Validation", kc.runtimeLifecycle.validationStatus ?? "unknown", kc.runtimeLifecycle.nextSuggestedCommand ?? "No suggested command is recorded yet.")}
            ${renderNoteRow("Task", kc.runtimeLifecycle.currentTask ?? "none recorded", kc.runtimeLifecycle.recentEvents[0]?.summary ?? "No lifecycle events are recorded yet.")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Waste & Weight", "Files and directories that inflate scope without helping the task.")}
          ${kc.wastedFiles.files.length > 0
            ? `<div class="kc-stack-list">${kc.wastedFiles.files.slice(0, 4).map((file) => renderNoteRow(file.file, `${formatTokensShort(file.tokens)} tokens`, file.reason)).join("")}</div>`
            : renderEmptyState("No wasted files are recorded in the current selection.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Heavy Directories", "Areas that dominate estimated token volume and deserve tighter scoping.")}
          ${kc.heavyDirectories.directories.length > 0
            ? `<div class="kc-stack-list">${kc.heavyDirectories.directories.slice(0, 4).map((directory) => renderNoteRow(directory.directory, `${directory.percentOfRepo}%`, directory.suggestion)).join("")}</div>`
            : renderEmptyState("No heavy-directory signal is recorded for this repo yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Next Commands", `Exact CLI commands from the runtime-derived execution plan. ${executionPlanSnapshotNote}`)}
        ${kc.executionPlan.nextCommands.length > 0
          ? renderListBadges(kc.executionPlan.nextCommands)
          : renderEmptyState("No next commands are currently recorded.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Workflow Steps", `Runtime-derived workflow snapshot for the active task. ${workflowSnapshotNote}`)}
          <div class="kc-inline-badges">
            ${renderInlineBadge(`${successfulWorkflowSteps}/${kc.workflow.steps.length} successful`)}
            ${failedWorkflowStep ? renderInlineBadge(`failed: ${failedWorkflowStep.action}`) : renderInlineBadge("no failed step")}
          </div>
          ${failedWorkflowStep?.failureReason ? `<div class="kc-divider"></div>${renderNoteRow("Failure reason", failedWorkflowStep.action, failedWorkflowStep.failureReason)}` : ""}
          ${kc.workflow.steps.length > 0
            ? `<div class="kc-stack-list">${kc.workflow.steps.map((step) => renderNoteRow(
                `${step.action}`,
                `${step.status}${step.retryCount > 0 ? ` · retry ${step.retryCount}` : ""}${step.attemptCount > 0 ? ` · attempt ${step.attemptCount}` : ""}`,
                step.failureReason
                  ?? step.result.summary
                  ?? step.validation
                  ?? step.expectedOutput
                  ?? step.result.suggestedFix
                  ?? step.tokenUsage.note
              )).join("")}</div>`
            : renderEmptyState("No workflow state has been recorded yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Execution Trace", "What executed, which files were used, which skills applied, and token usage per step.")}
          ${kc.executionTrace.steps.length > 0
            ? `<div class="kc-stack-list">${kc.executionTrace.steps.map((step) => renderNoteRow(
                step.action,
                step.tokenUsage.source === "none"
                  ? `${step.status}${step.retryCount > 0 ? ` · retry ${step.retryCount}` : ""}`
                  : `${step.status}${step.retryCount > 0 ? ` · retry ${step.retryCount}` : ""} · ${step.tokenUsage.measuredTokens != null ? formatTokensShort(step.tokenUsage.measuredTokens) : `~${formatTokensShort(step.tokenUsage.estimatedTokens ?? 0)}`}`,
                step.failureReason
                  ? `${step.failureReason}${step.files.length > 0 ? ` | files: ${step.files.slice(0, 3).join(", ")}` : ""}`
                  : `${step.result.summary ?? (step.files.slice(0, 3).join(", ") || "no files")}${step.skillsApplied.length > 0 ? ` | skills: ${step.skillsApplied.join(", ")}` : ""}${step.result.validation ? ` | validation: ${step.result.validation}` : step.expectedOutput ? ` | expects: ${step.expectedOutput}` : ""}${step.result.retryCommand ? ` | retry: ${step.result.retryCommand}` : ""}`
              )).join("")}</div>`
            : renderEmptyState("No execution trace is available yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("DECISION LOGIC", `Runtime-derived decision snapshot showing which signals won and which signals were intentionally ignored. ${decisionLogicSnapshotNote}`)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${renderPanelHeader("Reasoning chain", kc.decisionLogic.summary || "No decision summary recorded.")}
            ${kc.decisionLogic.reasoningChain.length > 0
              ? `<div class="kc-stack-list">${kc.decisionLogic.reasoningChain.map((item) => renderBulletRow(item)).join("")}</div>`
              : renderEmptyState("No reasoning chain is available yet.")}
          </section>
          <section class="kc-subpanel">
            ${renderPanelHeader("Ignored signals", "Signals Kiwi saw but did not let dominate the next action.")}
            ${kc.decisionLogic.ignoredSignals.length > 0
              ? `<div class="kc-stack-list">${kc.decisionLogic.ignoredSignals.map((item) => renderBulletRow(item)).join("")}</div>`
              : renderEmptyState("No ignored signals are currently recorded.")}
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Runtime Events", `Hook-style events emitted by Kiwi’s lightweight runtime integration. ${runtimeLifecycleSnapshotNote}`)}
        ${kc.runtimeLifecycle.recentEvents.length > 0
          ? `<div class="kc-stack-list">${kc.runtimeLifecycle.recentEvents.slice(0, 6).map((event) => renderNoteRow(
              `${event.type} · ${event.stage}`,
              event.status,
              event.summary
            )).join("")}</div>`
          : renderEmptyState("No runtime events are recorded yet.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Ecosystem Discovery", "Read-only external capability metadata used to inform decisions without executing tools directly.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${renderPanelHeader("Known tools", "Selected tools and ecosystems from Awesome Copilot and Awesome Claude Code.")}
            <div class="kc-stack-list">
              ${state.ecosystem.tools.slice(0, 5).map((tool) => renderNoteRow(tool.name, tool.category, tool.description)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            ${renderPanelHeader("Known workflows", "Advisory workflow patterns only.")}
            <div class="kc-stack-list">
              ${state.ecosystem.workflows.slice(0, 4).map((workflow) => renderNoteRow(workflow.name, workflow.source, workflow.description)).join("")}
            </div>
          </section>
        </div>
      </section>
    </div>
  `;
}

function renderMachineView(state: RepoControlState): string {
  return renderMachinePanelView({
    state,
    activeMode,
    helpers: buildUiRenderHelpers()
  });
}

function buildRepoGraph(nodes: KiwiControlContextTreeNode[]): {
  nodes: Array<{ label: string; x: number; y: number; radius: number; tone: string }>;
  edges: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  summary: Array<{ label: string; kind: string; meta: string }>;
} {
  const root = { label: "repo", x: 600, y: 360, radius: 34, tone: "tone-root" };
  const topLevel = nodes.slice(0, 8);
  const graphNodes: Array<{ label: string; x: number; y: number; radius: number; tone: string }> = [root];
  const edges: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  const summary: Array<{ label: string; kind: string; meta: string }> = [];

  topLevel.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(topLevel.length, 1);
    const folderNode = {
      label: node.name,
      x: 600 + Math.cos(angle) * 220,
      y: 360 + Math.sin(angle) * 220,
      radius: 24,
      tone: `tone-${node.status}`
    };
    graphNodes.push(folderNode);
    edges.push({ from: root, to: folderNode });
    summary.push({
      label: node.name,
      kind: node.kind,
      meta: node.children.length > 0 ? `${node.children.length} child nodes` : "leaf"
    });

    node.children.slice(0, 4).forEach((child, childIndex) => {
      const childAngle = angle + ((childIndex - 1.5) * 0.35);
      const fileNode = {
        label: child.name,
        x: folderNode.x + Math.cos(childAngle) * 160,
        y: folderNode.y + Math.sin(childAngle) * 160,
        radius: 16,
        tone: `tone-${child.status}`
      };
      graphNodes.push(fileNode);
      edges.push({ from: folderNode, to: fileNode });
    });
  });

  return {
    nodes: graphNodes,
    edges,
    summary
  };
}

function runtimeDerivedSnapshotNote(state: RepoControlState, outputName: string): string {
  const metadata = state.derivedFreshness.find((entry) => entry.outputName === outputName);
  if (!metadata) {
    return "Compatibility/debug snapshot.";
  }
  return `Compatibility/debug snapshot${metadata.sourceRevision != null ? ` · revision ${metadata.sourceRevision}` : ""}${metadata.generatedAt ? ` · generated ${metadata.generatedAt}` : ""}.`;
}

function renderHandoffsView(state: RepoControlState): string {
  const latestCheckpoint = getPanelValue(state.continuity, "Latest checkpoint");
  const latestHandoff = getPanelValue(state.continuity, "Latest handoff");
  const latestReconcile = getPanelValue(state.continuity, "Latest reconcile");
  const recommendedTargets = state.specialists.handoffTargets.slice(0, 6);

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Handoffs & Checkpoints</p>
          <h1>Continuity Surfaces</h1>
          <p>Repo-local handoff, checkpoint, and specialist routing state.</p>
        </div>
        ${renderHeaderBadge(state.specialists.recommendedSpecialist, "neutral")}
      </section>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${renderTabButton("handoffs", activeHandoffTab, "Handoffs", "data-handoff-tab")}
          ${renderTabButton("checkpoints", activeHandoffTab, "Checkpoints", "data-handoff-tab")}
        </div>
        ${activeHandoffTab === "handoffs"
          ? `
            <div class="kc-two-column">
              <section class="kc-subpanel">
                ${renderPanelHeader("Latest Handoff", "Most recent repo-local handoff state")}
                <div class="kc-keyline-value">
                  <strong>${escapeHtml(latestHandoff)}</strong>
                  <span>${escapeHtml(state.specialists.safeParallelHint)}</span>
                </div>
              </section>
              <section class="kc-subpanel">
                ${renderPanelHeader("Suggested Targets", "Specialists that Kiwi Control currently considers safe handoff candidates.")}
                ${recommendedTargets.length > 0 ? renderListBadges(recommendedTargets) : renderEmptyState("No handoff targets are available yet.")}
              </section>
            </div>
          `
          : `
            <div class="kc-two-column">
              <section class="kc-subpanel">
                ${renderPanelHeader("Latest Checkpoint", "Newest saved checkpoint surface")}
                <div class="kc-keyline-value">
                  <strong>${escapeHtml(latestCheckpoint)}</strong>
                  <span>${escapeHtml(state.repoState.title)}</span>
                </div>
              </section>
              <section class="kc-subpanel">
                ${renderPanelHeader("Latest Reconcile", "Most recent dispatch reconcile record")}
                <div class="kc-keyline-value">
                  <strong>${escapeHtml(latestReconcile)}</strong>
                  <span>${escapeHtml(getPanelValue(state.repoOverview, "Current phase"))}</span>
                </div>
              </section>
            </div>
          `}
      </section>
    </div>
  `;
}

function renderFeedbackView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const feedback = kc.feedback;
  const hasMeaningfulFeedback =
    feedback.totalRuns > 0
    || feedback.topBoostedFiles.length > 0
    || feedback.topPenalizedFiles.length > 0
    || feedback.recentEntries.length > 0
    || feedback.basedOnPastRuns;
  const boostedFiles = feedback.topBoostedFiles.slice(0, 4);
  const penalizedFiles = feedback.topPenalizedFiles.slice(0, 4);
  const recentEntries = feedback.recentEntries.slice(0, 6);
  const detailPanels: string[] = [];

  if (boostedFiles.length > 0) {
    detailPanels.push(`
      <section class="kc-panel">
        ${renderPanelHeader("Boosted Files", "Files that helped successful runs in this task scope.")}
        <div class="kc-stack-list">${boostedFiles.map((entry) => renderScoreRow(entry.file, entry.score, "success")).join("")}</div>
      </section>
    `);
  }

  if (penalizedFiles.length > 0) {
    detailPanels.push(`
      <section class="kc-panel">
        ${renderPanelHeader("Penalized Files", "Files Kiwi is learning to avoid for this task scope.")}
        <div class="kc-stack-list">${penalizedFiles.map((entry) => renderScoreRow(entry.file, entry.score, "warn")).join("")}</div>
      </section>
    `);
  }

  if (feedback.basedOnPastRuns) {
    detailPanels.push(`
      <section class="kc-panel">
        ${renderPanelHeader("Retrieval Reuse", "Only shown when Kiwi is confidently reusing a past pattern.")}
        <div class="kc-stack-list">
          ${renderNoteRow("Reused pattern", feedback.reusedPattern ?? "similar work", feedback.note)}
          ${feedback.similarTasks.slice(0, 4).map((entry) => renderNoteRow(entry.task, `similarity ${entry.similarity}`, formatTimestamp(entry.timestamp))).join("")}
        </div>
      </section>
    `);
  }

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Feedback</p>
          <h1>${escapeHtml(feedback.adaptationLevel === "active" ? "Adaptive feedback is active" : "Adaptive feedback is limited")}</h1>
          <p>${escapeHtml(feedback.note)}</p>
        </div>
        ${renderHeaderBadge(`${feedback.totalRuns} runs`, feedback.adaptationLevel === "active" ? "success" : "neutral")}
      </section>

      ${!hasMeaningfulFeedback
        ? `
          <section class="kc-panel">
            ${renderPanelHeader("Adaptive Feedback", "Kiwi keeps this quiet until successful runtime-backed work creates useful signal.")}
            <div class="kc-stack-list">
              ${renderNoteRow("Current state", feedback.adaptationLevel, feedback.note)}
              ${renderNoteRow("What to do next", "keep working normally", "Use the main runtime-backed flow first. This page grows only when there is real signal to show.")}
            </div>
          </section>
        `
        : `
      <div class="kc-stat-grid">
        ${renderStatCard("Valid Runs", String(feedback.totalRuns), "successful completions", "neutral")}
        ${renderStatCard("Success Rate", `${feedback.successRate}%`, "repo-local", feedback.successRate >= 80 ? "success" : "neutral")}
        ${renderStatCard("Learned Files", String(feedback.topBoostedFiles.length + feedback.topPenalizedFiles.length), "boosted and penalized", feedback.topBoostedFiles.length > 0 ? "success" : feedback.topPenalizedFiles.length > 0 ? "warn" : "neutral")}
        ${renderStatCard("Reuse", feedback.basedOnPastRuns ? "active" : "idle", feedback.basedOnPastRuns ? "pattern reuse engaged" : "fresh selection first", feedback.basedOnPastRuns ? "success" : "neutral")}
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Recent Completions", "Only valid successful completions train future selection behavior.")}
        ${recentEntries.length > 0
          ? `<div class="kc-stack-list">${recentEntries.map((entry) => `
              <div class="kc-note-row">
                <div>
                  <strong>${escapeHtml(entry.task)}</strong>
                  <span>${escapeHtml(`${entry.filesUsed}/${entry.filesSelected} files used · ${formatTimestamp(entry.timestamp)}`)}</span>
                </div>
                ${renderHeaderBadge(entry.success ? "success" : "fail", entry.success ? "success" : "warn")}
              </div>
            `).join("")}</div>`
          : renderEmptyState("No recent feedback events are available yet.")}
      </section>

      ${detailPanels.length > 0 ? `<div class="kc-two-column">${detailPanels.join("")}</div>` : ""}
      `}
    </div>
  `;
}

function renderInspector(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const currentFocus = focusedItem;
  const marker = currentFocus ? approvalMarkers.get(currentFocus.id) ?? "unmarked" : "unmarked";

  return renderInspectorPanel({
    ...buildInspectorContextModel({
      state,
      focusedItem: currentFocus,
      marker,
      activeMode,
      commandState,
      resolveFocusedStep: (focused) => focused?.kind === "step"
        ? deriveDisplayExecutionPlanSteps(state).find((step) => step.id === focused.id) ?? null
        : null,
      resolveFocusedNode: (focused) => focused?.kind === "path" ? findContextNodeByPath(state, focused.path) : null
    }),
    helpers: {
      ...buildUiRenderHelpers(),
      renderGateRow,
      renderBulletRow
    }
  });
}

function renderExecutionPlanPanel(state: RepoControlState): string {
  const steps = deriveDisplayExecutionPlanSteps(state);
  return renderExecutionPlanPanelView({
    ...buildExecutionPlanPanelContextModel({
      state,
      steps,
      editingPlanStepId,
      editingPlanDraft,
      focusedItem,
      commandState,
      failureGuidance: deriveExecutionPlanFailureGuidance(state.kiwiControl?.executionPlan.lastError ?? null)
    }),
    helpers: {
      escapeHtml,
      escapeAttribute,
      formatCliCommand,
      renderPanelHeader,
      renderInlineBadge,
      renderNoteRow,
      renderEmptyState,
      renderHeaderBadge
    }
  });
}

function renderLogDrawer(state: RepoControlState): string {
  const lines = buildLogLines(state);
  const historyEntries = buildHistoryEntries(state);
  const historyBody = historyEntries.length > 0
    ? historyEntries.map((entry) => `
        <div class="kc-log-line ${entry.tone}">
          <span>${escapeHtml(entry.label)}</span>
          <strong>${escapeHtml(entry.value)}</strong>
        </div>
      `).join("")
    : renderHistoryEmptyState(state);

  return `
    <div class="kc-log-shell">
      <div class="kc-log-header">
        ${activeMode === "inspection"
          ? `<div class="kc-tab-row">
              ${renderTabButton("history", activeLogTab, "Execution History", "data-log-tab")}
              ${renderTabButton("validation", activeLogTab, "Validation Output", "data-log-tab")}
              ${renderTabButton("logs", activeLogTab, "System Logs", "data-log-tab")}
            </div>`
          : `<div class="kc-tab-row">${renderTabButton("history", "history", "Execution History")}</div>`}
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${iconSvg("close")}
        </button>
      </div>
      <div class="kc-log-body">
        ${activeMode === "execution"
          ? historyBody
          : activeLogTab === "validation"
          ? renderValidationLogBody(state.validation)
          : activeLogTab === "history"
            ? historyBody
            : lines.length > 0
            ? lines.map((line) => `
                <div class="kc-log-line">
                  <span>${escapeHtml(line.label)}</span>
                  <strong>${escapeHtml(line.value)}</strong>
                </div>
              `).join("")
            : renderEmptyState("No repo activity is recorded yet.")}
      </div>
    </div>
  `;
}

function renderValidationLogBody(validation: RepoControlState["validation"]): string {
  const issues = validation.issues ?? [];
  if (issues.length === 0) {
    return `<div class="kc-log-line"><span>info</span><strong>Repo validation is currently passing.</strong></div>`;
  }

  return issues.map((issue) => `
    <div class="kc-log-line ${issue.level === "error" ? "is-error" : issue.level === "warn" ? "is-warn" : ""}">
      <span>${escapeHtml(issue.level)}</span>
      <strong>${escapeHtml(`${issue.filePath ? `${issue.filePath}: ` : ""}${issue.message}`)}</strong>
    </div>
  `).join("");
}

function renderStatCard(label: string, value: string, meta: string, tone: "neutral" | "success" | "warn" | "critical"): string {
  return `
    <article class="kc-stat-card tone-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(meta)}</em>
    </article>
  `;
}

function renderSmallMetric(value: string, label: string): string {
  return `
    <div class="kc-small-metric">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderPanelHeader(title: string, description: string): string {
  return `
    <header class="kc-panel-header">
      <div>
        <p>${escapeHtml(title)}</p>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <span>${escapeHtml(description)}</span>
    </header>
  `;
}

function renderInfoRow(label: string, value: string, tone: "default" | "warn" = "default"): string {
  return `
    <div class="kc-info-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone === "warn" ? "is-warn" : ""}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function deriveSignalImpact(signal: string): string {
  const lowered = signal.toLowerCase();
  if (lowered.includes("low confidence")) {
    return "May miss relevant files or choose the wrong working set.";
  }
  if (lowered.includes("partial scan")) {
    return "Repo understanding may be incomplete until context expands.";
  }
  if (lowered.includes("changed files")) {
    return "Recent edits can dominate the plan and change the safest next step.";
  }
  if (lowered.includes("reverse depend")) {
    return "Downstream breakage can be missed if structural dependents are ignored.";
  }
  if (lowered.includes("keyword")) {
    return "Task matching may drift away from the user’s actual request.";
  }
  if (lowered.includes("repo context")) {
    return "Repo-local authority and critical files may be skipped.";
  }
  return "Ignoring this signal can reduce decision quality or hide relevant files.";
}

function renderHeaderBadge(
  label: string,
  tone: RepoControlMode | NextActionItem["priority"] | "neutral" | "success" | "warn" | "low" | "medium" | "high"
): string {
  const normalizedTone =
    tone === "bridge-unavailable"
      ? "warn"
      : tone === "low"
        ? "warn"
        : tone === "medium"
          ? "neutral"
          : tone === "high"
            ? "success"
            : tone;
  return `<span class="kc-badge badge-${escapeHtml(normalizedTone)}">${escapeHtml(label)}</span>`;
}

function renderGateRow(label: string, value: string, tone: "default" | "success" | "warn"): string {
  return `
    <div class="kc-info-row kc-gate-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone === "warn" ? "is-warn" : tone === "success" ? "is-success" : ""}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderTabButton(
  value: string,
  active: string,
  label: string,
  attributeName = "data-validation-tab"
): string {
  return `<button class="kc-tab-button ${value === active ? "is-active" : ""}" type="button" ${attributeName}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function renderListBadges(values: string[]): string {
  return `<div class="kc-inline-badges">${values.map((value) => `<span class="kc-inline-badge">${escapeHtml(value)}</span>`).join("")}</div>`;
}

function renderInlineBadge(value: string): string {
  return `<span class="kc-inline-badge">${escapeHtml(value)}</span>`;
}

function renderExplainabilityBadge(label: string, active: boolean): string {
  return `<span class="kc-inline-badge ${active ? "is-active" : "is-muted"}">${escapeHtml(label)}</span>`;
}

function renderBulletRow(copy: string): string {
  return `
    <div class="kc-bullet-row">
      <span class="kc-bullet-dot"></span>
      <span>${escapeHtml(copy)}</span>
    </div>
  `;
}

function renderCapabilityCard(capability: {
  id: string;
  category: string;
  purpose: string;
  trustLevel: "low" | "medium" | "high";
  readOnly: boolean;
  writeCapable: boolean;
  approvalRequired: boolean;
  usageGuidance: string[];
  antiPatterns: string[];
}): string {
  return `
    <article class="kc-capability-card">
      <div class="kc-capability-head">
        <div>
          <strong>${escapeHtml(capability.id)}</strong>
          <span>${escapeHtml(capability.category)}</span>
        </div>
        ${renderHeaderBadge(capability.trustLevel, capability.trustLevel === "high" ? "success" : capability.trustLevel === "low" ? "warn" : "neutral")}
      </div>
      <p>${escapeHtml(capability.purpose)}</p>
      <div class="kc-inline-badges">
        ${renderInlineBadge(capability.readOnly ? "read only" : "read write")}
        ${renderInlineBadge(capability.writeCapable ? "write capable" : "no writes")}
        ${renderInlineBadge(capability.approvalRequired ? "approval required" : "self-serve")}
      </div>
      ${capability.usageGuidance.length > 0
        ? `<div class="kc-capability-notes">${capability.usageGuidance.slice(0, 2).map(renderBulletRow).join("")}</div>`
        : ""}
    </article>
  `;
}

function renderSpecialistCard(specialist: {
  specialistId: string;
  name?: string;
  purpose?: string;
  aliases?: string[];
  preferredTools?: string[];
  riskPosture?: string;
}): string {
  return `
    <div class="kc-stack-list">
      <div class="kc-note-row">
        <div>
          <strong>${escapeHtml(specialist.name ?? specialist.specialistId)}</strong>
          <span>${escapeHtml(specialist.purpose ?? "No purpose recorded.")}</span>
        </div>
        <em>${escapeHtml(specialist.riskPosture ?? "unknown")}</em>
      </div>
      <div class="kc-inline-badges">
        ${renderInlineBadge(`id: ${specialist.specialistId}`)}
        ${renderInlineBadge(`tools: ${(specialist.preferredTools ?? []).join(", ") || "none"}`)}
        ${renderInlineBadge(`aliases: ${(specialist.aliases ?? []).join(", ") || "none"}`)}
      </div>
    </div>
  `;
}

function renderMemoryPresenceList(entries: Array<{ label: string; path: string; present: boolean }>): string {
  if (entries.length === 0) {
    return renderEmptyState("No repo-local memory entries are available.");
  }

  return `
    <div class="kc-memory-list">
      ${entries.map((entry) => `
        <div class="kc-memory-row ${entry.present ? "is-present" : "is-missing"}">
          <div>
            <strong>${escapeHtml(entry.label)}</strong>
            <span>${escapeHtml(entry.path)}</span>
          </div>
          <em>${entry.present ? "present" : "missing"}</em>
        </div>
      `).join("")}
    </div>
  `;
}

function renderScoreRow(file: string, score: number, tone: "success" | "warn"): string {
  return `
    <div class="kc-score-row">
      <span>${escapeHtml(file)}</span>
      <strong class="tone-${tone}">${score > 0 ? `+${score}` : `${score}`}</strong>
    </div>
  `;
}

function renderBarRow(label: string, value: number, total: number, meta: string): string {
  const percent = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 6;
  return `
    <div class="kc-bar-row">
      <div class="kc-bar-copy">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(`${formatTokensShort(value)} · ${meta}`)}</span>
      </div>
      <div class="kc-bar-track"><div class="kc-bar-fill" style="width: ${percent}%"></div></div>
    </div>
  `;
}

function renderNoteRow(title: string, metric: string, note: string): string {
  return `
    <div class="kc-note-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(note)}</span>
      </div>
      <em>${escapeHtml(metric)}</em>
    </div>
  `;
}

function renderMeterRow(label: string, value: number, total: number): string {
  if (total <= 0) {
    return "";
  }

  const percent = Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  return `
    <div class="kc-meter-row">
      <div class="kc-meter-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${percent}%</strong>
      </div>
      <div class="kc-meter-track"><div class="kc-meter-fill" style="width: ${percent}%"></div></div>
    </div>
  `;
}

function renderValidationIssueCard(issue: ValidationIssue): string {
  return `
    <article class="kc-issue-card issue-${escapeHtml(issue.level)}">
      <div>
        <strong>${escapeHtml(issue.filePath ?? "repo contract")}</strong>
        <span>${escapeHtml(issue.message)}</span>
      </div>
      ${renderHeaderBadge(issue.level, issue.level === "error" ? "critical" : "warn")}
    </article>
  `;
}

function renderEmptyState(message: string): string {
  return `<p class="kc-empty-state">${escapeHtml(message)}</p>`;
}

function renderContextTree(tree: KiwiControlContextTree): string {
  return renderContextTreePanel({
    tree,
    focusedItem,
    contextOverrides,
    helpers: {
      escapeHtml,
      escapeAttribute,
      renderEmptyState
    }
  });
}

function buildActivityItems(state: RepoControlState): Array<{
  title: string;
  detail: string;
  timestamp: string;
  tone: "tone-success" | "tone-warn" | "tone-neutral";
  icon: string;
  meta?: string[];
}> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const items: Array<{
    title: string;
    detail: string;
    timestamp: string;
    tone: "tone-success" | "tone-warn" | "tone-neutral";
    icon: string;
    meta?: string[];
  }> = [];

  for (const execution of kc.execution.recentExecutions) {
    items.push({
      title: execution.success ? "Execution completed" : "Execution failed",
      detail: `${execution.task} · ${execution.filesTouched} files touched`,
      timestamp: formatTimestamp(execution.timestamp),
      tone: execution.success ? "tone-success" : "tone-warn",
      icon: execution.success ? iconSvg("check") : iconSvg("alert"),
      ...(execution.tokensUsed > 0 ? { meta: [`~${formatTokensShort(execution.tokensUsed)} tokens`] } : {})
    });
  }

  for (const event of kc.runtimeLifecycle.recentEvents.slice(0, 4)) {
    items.push({
      title: `Runtime ${event.type}`,
      detail: event.summary,
      timestamp: formatTimestamp(event.timestamp),
      tone:
        event.status === "error"
          ? "tone-warn"
          : event.status === "warn"
            ? "tone-neutral"
            : "tone-success",
      icon:
        event.status === "error"
          ? iconSvg("alert")
          : event.status === "warn"
            ? iconSvg("system")
            : iconSvg("check"),
      ...(event.files.length > 0 ? { meta: event.files.slice(0, 3) } : {})
    });
  }

  const latestCheckpoint = getPanelValue(state.continuity, "Latest checkpoint");
  if (latestCheckpoint !== "none recorded") {
    items.push({
      title: "Checkpoint updated",
      detail: latestCheckpoint,
      timestamp: "repo-local",
      tone: "tone-neutral",
      icon: iconSvg("checkpoint")
    });
  }

  const latestHandoff = getPanelValue(state.continuity, "Latest handoff");
  if (latestHandoff !== "none recorded") {
    items.push({
      title: "Handoff available",
      detail: latestHandoff,
      timestamp: "repo-local",
      tone: "tone-neutral",
      icon: iconSvg("handoffs")
    });
  }

  const latestReconcile = getPanelValue(state.continuity, "Latest reconcile");
  if (latestReconcile !== "none recorded") {
    items.push({
      title: "Reconcile state updated",
      detail: latestReconcile,
      timestamp: "repo-local",
      tone: "tone-neutral",
      icon: iconSvg("activity")
    });
  }

  return items.slice(0, 8);
}

function buildRecentTouchedFiles(state: RepoControlState, latestExecution: KiwiControlExecution["recentExecutions"][number]): string[] {
  const primaryActionFile = (state.kiwiControl ?? EMPTY_KC).nextActions.actions[0]?.file;
  const items = new Set<string>();
  if (primaryActionFile) {
    items.add(primaryActionFile);
  }
  if (latestExecution.filesTouched > 0) {
    items.add(`${latestExecution.filesTouched} touched`);
  }
  if (latestExecution.tokensUsed > 0) {
    items.add(`~${formatTokensShort(latestExecution.tokensUsed)} tokens`);
  }
  return [...items];
}

function humanizeEventType(eventType: string): string {
  return eventType
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildHistoryEntries(state: RepoControlState): Array<{ label: string; value: string; tone: "" | "is-warn" | "is-error" }> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  if (kc.executionEvents.recentEvents.length > 0) {
    return kc.executionEvents.recentEvents.slice(0, 10).map((event) => {
      const detail = event.reason
        ?? event.sourceCommand
        ?? event.task
        ?? event.nextCommand
        ?? "No runtime detail recorded.";
      const artifactSummary = Object.keys(event.artifacts).length > 0 ? "artifacts updated" : null;
      return {
        label: humanizeEventType(event.eventType),
        value: `${detail}${artifactSummary ? ` · ${artifactSummary}` : ""} · ${formatTimestamp(event.recordedAt)}`,
        tone:
          event.lifecycle === "failed"
            ? "is-error"
            : event.lifecycle === "blocked"
              ? "is-warn"
              : ""
      };
    });
  }

  if (kc.runtimeLifecycle.recentEvents.length > 0) {
    return kc.runtimeLifecycle.recentEvents.slice(0, 8).map((event) => ({
      label: humanizeEventType(event.type),
      value: `${event.summary} · ${formatTimestamp(event.timestamp)}`,
      tone: event.status === "error" ? "is-error" : event.status === "warn" ? "is-warn" : ""
    }));
  }

  return kc.execution.recentExecutions.slice(0, 8).map((execution) => ({
    label: execution.success ? "Run" : "Failed run",
    value: `${execution.task} · ${execution.filesTouched} files · ~${formatTokensShort(execution.tokensUsed)} tokens · ${formatTimestamp(execution.timestamp)}`,
    tone: execution.success ? "" : "is-warn"
  }));
}

function renderHistoryEmptyState(state: RepoControlState): string {
  const source = (state.kiwiControl ?? EMPTY_KC).executionEvents.source;
  if (source === "runtime") {
    return renderEmptyState("Runtime execution events are available for this repo, but no recent entries are recorded yet.");
  }
  if (source === "compatibility") {
    return renderEmptyState("The repo-local compatibility event log is empty right now. Runtime event history is not currently available.");
  }
  return renderEmptyState("Runtime execution event history is unavailable for this repo right now.");
}

function buildLogLines(state: RepoControlState): Array<{ label: string; value: string }> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const lines = kc.execution.recentExecutions.map((execution) => ({
    label: execution.success ? "run" : "run failed",
    value: `${execution.task} · ${execution.filesTouched} files · ${formatTimestamp(execution.timestamp)}`
  }));

  return [
    ...lines,
    ...state.continuity.slice(0, 3).map((item) => ({
      label: item.label,
      value: item.value
    }))
  ].slice(0, 8);
}

function iconLabel(icon: string, label: string): string {
  return `<span class="kc-icon-label">${icon}<em>${escapeHtml(label)}</em></span>`;
}

function iconSvg(name: string): string {
  const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  switch (name) {
    case "overview":
      return `<svg ${common}><rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><rect x="3" y="13" width="7" height="7"/><rect x="14" y="13" width="7" height="7"/></svg>`;
    case "context":
      return `<svg ${common}><path d="M4 19V5h16v14Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;
    case "graph":
      return `<svg ${common}><circle cx="12" cy="12" r="2"/><circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M10.5 10.5 7.5 8.5"/><path d="m13.5 10.5 3-2"/><path d="m10.8 13.4-2.5 3"/><path d="m13.2 13.4 2.5 3"/></svg>`;
    case "validation":
      return `<svg ${common}><path d="M12 3 4 7v6c0 4.5 3.2 6.9 8 8 4.8-1.1 8-3.5 8-8V7Z"/><path d="m9 12 2 2 4-4"/></svg>`;
    case "activity":
      return `<svg ${common}><path d="M3 12h4l2-4 4 8 2-4h6"/></svg>`;
    case "tokens":
      return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`;
    case "handoffs":
      return `<svg ${common}><path d="m7 7 5-4 5 4"/><path d="M12 3v14"/><path d="m17 17-5 4-5-4"/></svg>`;
    case "feedback":
      return `<svg ${common}><path d="M12 3v6"/><path d="m15 12 6-3"/><path d="m9 12-6-3"/><path d="m15 15 4 4"/><path d="m9 15-4 4"/><circle cx="12" cy="12" r="3"/></svg>`;
    case "mcps":
      return `<svg ${common}><path d="M4 12h16"/><path d="M12 4v16"/><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>`;
    case "specialists":
      return `<svg ${common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`;
    case "system":
      return `<svg ${common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M4 9h16"/><path d="M4 15h16"/></svg>`;
    case "logs-open":
      return `<svg ${common}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="m19 15-3 3 3 3"/></svg>`;
    case "logs-closed":
      return `<svg ${common}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="m15 9 3 3-3 3"/></svg>`;
    case "panel-open":
      return `<svg ${common}><rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/></svg>`;
    case "panel-closed":
      return `<svg ${common}><rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/></svg>`;
    case "close":
      return `<svg ${common}><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>`;
    case "refresh":
      return `<svg ${common}><path d="M20 11a8 8 0 0 0-14.9-3"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3"/><path d="M20 20v-5h-5"/></svg>`;
    case "check":
      return `<svg ${common}><path d="m5 12 4 4 10-10"/></svg>`;
    case "alert":
      return `<svg ${common}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`;
    case "checkpoint":
      return `<svg ${common}><path d="M6 4h12v6H6z"/><path d="M9 10v10"/><path d="M15 10v10"/></svg>`;
    case "sun":
      return `<svg ${common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    case "moon":
      return `<svg ${common}><path d="M12 3a6 6 0 1 0 9 9A9 9 0 1 1 12 3Z"/></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="8"/></svg>`;
  }
}

function formatTokensShort(count: number): string {
  const absolute = Math.abs(count);
  const units = [
    { value: 1_000_000_000_000, suffix: "T" },
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "K" }
  ];

  for (const unit of units) {
    if (absolute >= unit.value) {
      const scaled = count / unit.value;
      return `${scaled.toFixed(1).replace(/\.0$/, "")}${unit.suffix}`;
    }
  }

  return formatInteger(count);
}

function formatInteger(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number | null): string {
  return value == null ? "n/a" : `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) {
    return "unknown time";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getPanelValue(items: PanelItem[], label: string): string {
  return items.find((item) => item.label === label)?.value ?? "none recorded";
}

function getRepoLabel(targetRoot: string): string {
  if (!targetRoot) {
    return "No repo loaded";
  }

  const segments = targetRoot.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? targetRoot;
}

function buildActiveTargetHint(state: RepoControlState): string {
  return buildActiveTargetHintModel(state);
}

function buildFinalReadyDetail(state: RepoControlState): string {
  return buildFinalReadyDetailModel(state, currentTargetRoot);
}

function buildBridgeNote(state: RepoControlState, source: "cli" | "manual" | "auto" | "shell"): string {
  return buildBridgeNoteModel(state, source, buildReadinessEnv(state));
}

async function consumeInitialLaunchRequest(): Promise<LaunchRequestPayload | null> {
  if (!isTauriBridgeAvailable()) {
    return null;
  }

  try {
    return await invoke<LaunchRequestPayload | null>("consume_initial_launch_request");
  } catch {
    return null;
  }
}

async function loadRepoControlState(targetRoot: string, preferSnapshot = false): Promise<RepoControlState> {
  if (!isTauriBridgeAvailable()) {
    return buildBridgeUnavailableState(targetRoot);
  }

  return await invoke<RepoControlState>("load_repo_control_state", { targetRoot, preferSnapshot });
}

async function setActiveRepoTarget(targetRoot: string, revision: number): Promise<void> {
  if (!isTauriBridgeAvailable() || !targetRoot) {
    return;
  }

  try {
    await invoke("set_active_repo_target", { targetRoot, revision });
  } catch {
    // Watch registration is best-effort and must never interrupt the product flow.
  }
}

function buildBridgeUnavailableState(targetRoot: string): RepoControlState {
  const hasTargetRoot = targetRoot.trim().length > 0;
  const resolvedTargetRoot = hasTargetRoot ? targetRoot : "";

  return {
    targetRoot: resolvedTargetRoot,
    loadState: {
      source: "bridge-fallback",
      freshness: "failed",
      generatedAt: new Date().toISOString(),
      snapshotSavedAt: null,
      snapshotAgeMs: null,
      detail: hasTargetRoot
        ? "Repo-local state could not be loaded from the Kiwi bridge."
        : "No repo is loaded yet."
    },
    profileName: "default",
    executionMode: "local",
    projectType: "unknown",
    repoState: {
      mode: "bridge-unavailable",
      title: hasTargetRoot ? "Could not load this repo yet" : "Open a repo",
      detail: hasTargetRoot
        ? "Kiwi Control could not read repo-local state for this folder yet."
        : "Run kc ui inside a repo to load it automatically.",
      sourceOfTruthNote:
        "Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state."
    },
    executionState: {
      revision: 0,
      operationId: null,
      task: null,
      sourceCommand: null,
      lifecycle: "failed",
      reason: hasTargetRoot ? "Kiwi Control could not read repo-local execution state for this folder yet." : "No repo is loaded yet.",
      nextCommand: hasTargetRoot ? "kc ui" : "kc init",
      blockedBy: hasTargetRoot ? ["Repo-local execution state is unavailable."] : [],
      lastUpdatedAt: null
    },
    readiness: {
      label: hasTargetRoot ? "Desktop bridge unavailable" : "Open a repo",
      tone: "failed",
      detail: hasTargetRoot
        ? "Kiwi Control could not read repo-local execution state for this folder yet."
        : "Run kc ui inside a repo to load it automatically.",
      nextCommand: hasTargetRoot ? "kc ui" : "kc init"
    },
    runtimeIdentity: null,
    derivedFreshness: [],
    runtimeDecision: {
      currentStepId: "idle",
      currentStepLabel: "Idle",
      currentStepStatus: "failed",
      nextCommand: hasTargetRoot ? "kc ui" : "kc init",
      readinessLabel: hasTargetRoot ? "Desktop bridge unavailable" : "Open a repo",
      readinessTone: "failed",
      readinessDetail: hasTargetRoot
        ? "Kiwi Control could not read repo-local execution state for this folder yet."
        : "Run kc ui inside a repo to load it automatically.",
      nextAction: {
        action: hasTargetRoot ? "Restore the desktop bridge" : "Open a repo",
        command: hasTargetRoot ? "kc ui" : "kc init",
        reason: hasTargetRoot
          ? "Kiwi Control could not read repo-local execution state for this folder yet."
          : "Run kc ui inside a repo to load it automatically.",
        priority: "critical"
      },
      recovery: {
        kind: "failed",
        reason: hasTargetRoot
          ? "Kiwi Control could not read repo-local execution state for this folder yet."
          : "Run kc ui inside a repo to load it automatically.",
        fixCommand: hasTargetRoot ? "kc ui" : "kc init",
        retryCommand: hasTargetRoot ? "kc ui" : "kc init"
      },
      decisionSource: "bridge-fallback",
      updatedAt: new Date().toISOString()
    },
    repoOverview: [
      { label: "Project type", value: hasTargetRoot ? "unknown (awaiting repo bridge)" : "no repo loaded", ...(hasTargetRoot ? { tone: "warn" as const } : {}) },
      { label: "Active role", value: "none recorded" },
      { label: "Next file", value: hasTargetRoot ? ".agent/project.yaml" : "run kc ui inside a repo" },
      { label: "Next command", value: hasTargetRoot ? "kc ui" : "kc init" },
      { label: "Validation state", value: hasTargetRoot ? "bridge unavailable" : "waiting for repo", ...(hasTargetRoot ? { tone: "warn" as const } : {}) },
      { label: "Current phase", value: hasTargetRoot ? "restore repo bridge" : "load a repo" }
    ],
    continuity: [
      { label: "Latest checkpoint", value: "none recorded" },
      { label: "Latest handoff", value: "none recorded" },
      { label: "Latest reconcile", value: "none recorded" },
      { label: "Current focus", value: hasTargetRoot ? `reload repo-local state for ${resolvedTargetRoot}` : "open a repo from the CLI" },
      { label: "Open risks", value: hasTargetRoot ? "Cannot read repo-local state yet." : "No repo loaded.", tone: "warn" }
    ],
    memoryBank: [],
    specialists: {
      activeSpecialist: "review-specialist",
      recommendedSpecialist: "review-specialist",
      activeProfile: null,
      recommendedProfile: null,
      handoffTargets: [],
      safeParallelHint: "Restore repo-local visibility first."
    },
    mcpPacks: {
      selectedPack: {
        id: "core-pack",
        description: "Default repo-first pack."
      },
      selectedPackSource: "heuristic-default",
      explicitSelection: null,
      suggestedPack: {
        id: "core-pack",
        description: "Default repo-first pack.",
        guidance: [],
        realismNotes: []
      },
      available: [],
      compatibleCapabilities: [],
      effectiveCapabilityIds: [],
      preferredCapabilityIds: [],
      executable: false,
      unavailablePackReason: "Pack selection is unavailable until repo-local state can be loaded.",
      capabilityStatus: "limited",
      note: "No compatible MCP integrations are available until repo-local state can be loaded."
    },
    validation: { ok: false, errors: hasTargetRoot ? 1 : 0, warnings: hasTargetRoot ? 0 : 1, issues: [] },
    ecosystem: {
      artifactType: "kiwi-control/ecosystem-catalog",
      version: 1,
      timestamp: new Date().toISOString(),
      tools: [],
      workflows: [],
      capabilities: [],
      notes: ["Ecosystem metadata becomes available once repo-local state loads."]
    },
    machineAdvisory: {
      artifactType: "kiwi-control/machine-advisory",
      version: 3,
      generatedBy: "kiwi-control machine-advisory",
      windowDays: 7,
      updatedAt: "",
      stale: true,
      sections: {
        inventory: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
        mcpInventory: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
        optimizationLayers: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
        setupPhases: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
        configHealth: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
        usage: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." },
        guidance: { status: "partial", updatedAt: "", reason: "Machine-local advisory is unavailable." }
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
          note: "Machine-local advisory is unavailable."
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
          note: "Machine-local advisory is unavailable."
        },
        copilot: {
          available: false,
          note: "Machine-local advisory is unavailable."
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
    },
    kiwiControl: EMPTY_KC
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function isTauriBridgeAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
