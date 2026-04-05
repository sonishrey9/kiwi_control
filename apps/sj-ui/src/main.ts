import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { renderTopBarView } from "./ui/TopBar.js";
import { renderGraphViewPanel } from "./ui/GraphPanel.js";
import { renderContextTreePanel } from "./ui/ContextTreePanel.js";
import { renderExecutionPlanPanelView } from "./ui/ExecutionPlanPanel.js";
import { renderInspectorPanel } from "./ui/InspectorPanel.js";
import type {
  CommandComposerMode,
  CommandState,
  ContextOverrideMode,
  DisplayExecutionPlanStep,
  FocusedItem,
  InteractiveGraphEdge,
  InteractiveGraphModel,
  InteractiveGraphNode,
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
  measuredUsage: KiwiControlMeasuredUsage;
  skills: KiwiControlSkills;
  workflow: KiwiControlWorkflow;
  executionTrace: KiwiControlExecutionTrace;
  executionPlan: KiwiControlExecutionPlan;
};

type RepoControlState = {
  targetRoot: string;
  profileName: string;
  executionMode: string;
  projectType: string;
  repoState: {
    mode: RepoControlMode;
    title: string;
    detail: string;
    sourceOfTruthNote: string;
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
    suggestedPack: { id: string; name?: string; description: string; realismNotes?: string[]; guidance?: string[] };
    available: Array<{ id: string; name?: string; description: string; realismNotes: string[]; guidance?: string[] }>;
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
    capabilityStatus: "compatible" | "limited";
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
let isLogDrawerOpen = true;
let isInspectorOpen = true;
let currentState = buildBridgeUnavailableState("");
let activeTheme: ThemeMode = loadStoredTheme();
let activeMode: UiMode = "execution";
const platformMode = detectPlatform();

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
let queuedLaunchRequest: LaunchRequestPayload | null = null;
let lastHandledLaunchRequestId = "";
let machineHydrationRound = 0;
let activeInteractiveTargetRoot = "";
let commandState: CommandState = {
  activeCommand: null,
  loading: false,
  composer: null,
  draftValue: "",
  lastResult: null,
  lastError: null
};
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
  void hydrateMachineAdvisory(false);

  app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  const mouseEvent = event as MouseEvent;

  const viewButton = target.closest<HTMLElement>("[data-view]");
  if (viewButton?.dataset.view) {
    activeView = viewButton.dataset.view as NavView;
    renderState(currentState);
    return;
  }

  if (target.closest("[data-toggle-logs]")) {
    isLogDrawerOpen = !isLogDrawerOpen;
    renderState(currentState);
    return;
  }

  if (target.closest("[data-toggle-inspector]")) {
    isInspectorOpen = !isInspectorOpen;
    renderState(currentState);
    return;
  }

  const logTabButton = target.closest<HTMLElement>("[data-log-tab]");
  if (logTabButton?.dataset.logTab) {
    activeLogTab = logTabButton.dataset.logTab as LogTab;
    renderState(currentState);
    return;
  }

  const validationTabButton = target.closest<HTMLElement>("[data-validation-tab]");
  if (validationTabButton?.dataset.validationTab) {
    activeValidationTab = validationTabButton.dataset.validationTab as ValidationTab;
    renderState(currentState);
    return;
  }

  if (target.closest("[data-theme-toggle]")) {
    activeTheme = activeTheme === "dark" ? "light" : "dark";
    applyChromePreferences();
    renderState(currentState);
    return;
  }

  const modeButton = target.closest<HTMLElement>("[data-ui-mode]");
  if (modeButton?.dataset.uiMode) {
    activeMode = modeButton.dataset.uiMode as UiMode;
    if (activeMode === "execution") {
      isLogDrawerOpen = false;
      activeLogTab = "history";
    }
    renderState(currentState);
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
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    graphZoom = Math.max(0.65, Math.min(2.4, Number((graphZoom + delta).toFixed(2))));
    renderState(currentState);
  }, { passive: false });

  app.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const node = target.closest<HTMLElement>("[data-graph-node]");
    if (node?.dataset.path) {
      graphInteraction = {
        mode: "drag-node",
        path: node.dataset.path,
        lastClientX: event.clientX,
        lastClientY: event.clientY
      };
      return;
    }
    if (target.closest("[data-graph-surface]")) {
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
    if (graphInteraction.mode === "pan") {
      graphPan = {
        x: graphPan.x + deltaX,
        y: graphPan.y + deltaY
      };
      graphInteraction.lastClientX = event.clientX;
      graphInteraction.lastClientY = event.clientY;
      renderState(currentState);
      return;
    }
    const existing = graphNodePositions.get(graphInteraction.path) ?? { x: 0, y: 0 };
    graphNodePositions.set(graphInteraction.path, {
      x: existing.x + deltaX / graphZoom,
      y: existing.y + deltaY / graphZoom
    });
    graphInteraction.lastClientX = event.clientX;
    graphInteraction.lastClientY = event.clientY;
    renderState(currentState);
  });

  window.addEventListener("pointerup", () => {
    graphInteraction = null;
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
}

async function registerLaunchRequestListener(): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await listen<LaunchRequestPayload>("desktop-launch-request", (event) => {
      void handleLaunchRequest(event.payload);
    });
  } catch {
    // Browser-only contexts do not need live retarget listeners.
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

async function loadAndRenderTarget(targetRoot: string, source: "cli" | "manual", requestId?: string): Promise<void> {
  if (isLoadingRepoState) {
    if (requestId) {
      queuedLaunchRequest = { requestId, targetRoot };
    }
    return;
  }

  isLoadingRepoState = true;
  currentTargetRoot = targetRoot;
  bridgeNoteElement.textContent =
    source === "cli"
      ? `Opening ${targetRoot} from ${requestId ? "kc ui" : "the CLI"}...`
      : `Loading repo-local state for ${targetRoot}...`;

  const state = await loadRepoControlState(targetRoot);
  currentTargetRoot = state.targetRoot || targetRoot;
  currentState = state;
  renderState(state);
  bridgeNoteElement.textContent = buildBridgeNote(state, source);
  await logUiEvent("ui-repo-state-rendered", requestId, state.targetRoot || targetRoot, state.repoState.mode);
  void hydrateMachineAdvisory(true);

  if (requestId) {
    await acknowledgeLaunchRequest(requestId, state);
  }

  isLoadingRepoState = false;

  if (queuedLaunchRequest && queuedLaunchRequest.requestId !== requestId) {
    const nextRequest = queuedLaunchRequest;
    queuedLaunchRequest = null;
    await handleLaunchRequest(nextRequest);
    return;
  }

  queuedLaunchRequest = null;
}

async function acknowledgeLaunchRequest(requestId: string, state: RepoControlState): Promise<void> {
  const targetRoot = state.targetRoot || currentTargetRoot;
  const status = state.repoState.mode === "bridge-unavailable" ? "error" : "ready";
  const detail = status === "ready" ? `Loaded repo-local state for ${targetRoot}.` : BRIDGE_UNAVAILABLE_NEXT_STEP;

  if (!isTauriBridgeAvailable()) {
    return;
  }

  try {
    await logUiEvent("ui-ack-attempt", requestId, targetRoot, status);
    await invoke("ack_launch_request", { requestId, targetRoot, status, detail });
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

async function hydrateMachineAdvisory(refresh: boolean): Promise<void> {
  if (!isTauriBridgeAvailable()) {
    return;
  }

  const round = ++machineHydrationRound;
  const sections: MachineSectionName[] = [
    "inventory",
    "mcpInventory",
    "optimizationLayers",
    "setupPhases",
    "configHealth",
    "usage",
    "guidance"
  ];

  for (const section of sections) {
    void hydrateMachineSection(section, refresh, round);
  }
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
    renderState(currentState);
  } catch (error) {
    if (round !== machineHydrationRound) {
      return;
    }
    currentState.machineAdvisory.sections[section] = {
      status: "partial",
      updatedAt: new Date().toISOString(),
      reason: error instanceof Error ? error.message : String(error)
    };
    renderState(currentState);
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
  }

  mergePlanUiState(state);
  ensureFocusedItem(state);
}

function ensureFocusedItem(state: RepoControlState): void {
  const currentFocus = focusedItem;
  if (currentFocus?.kind === "path" && findContextNodeByPath(state, currentFocus.path)) {
    return;
  }
  if (currentFocus?.kind === "step" && deriveDisplayExecutionPlanSteps(state).some((step) => step.id === currentFocus.id)) {
    return;
  }

  const selectedFiles = deriveInteractiveSelectedFiles(state);
  const firstSelectedFile = selectedFiles[0];
  if (firstSelectedFile) {
    focusedItem = {
      kind: "path",
      id: firstSelectedFile,
      label: basenameForPath(firstSelectedFile),
      path: firstSelectedFile
    };
    return;
  }

  const primaryStep = deriveDisplayExecutionPlanSteps(state)[0];
  if (primaryStep) {
    focusedItem = {
      kind: "step",
      id: primaryStep.id,
      label: primaryStep.displayTitle
    };
  }
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
  const nodes = baseTree.nodes.map((node) => applyOverridesToTreeNode(node));
  const counts = countTreeStatuses(nodes);
  return {
    nodes,
    selectedCount: counts.selected,
    candidateCount: counts.candidate,
    excludedCount: counts.excluded
  };
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
  return flattenContextNodes(deriveInteractiveTree(state).nodes)
    .filter((node) => node.kind === "file" && node.status === "selected")
    .map((node) => node.path);
}

function flattenContextNodes(nodes: KiwiControlContextTreeNode[]): KiwiControlContextTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenContextNodes(node.children)]);
}

function findContextNodeByPath(state: RepoControlState, path: string): KiwiControlContextTreeNode | null {
  return flattenContextNodes(deriveInteractiveTree(state).nodes).find((node) => node.path === path) ?? null;
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
  focusedItem = {
    kind: "path",
    id: path,
    label: basenameForPath(path),
    path
  };
  graphSelectedPath = path;
  renderState(currentState);
}

function resetLocalContextOverrides(): void {
  if (contextOverrides.size === 0) {
    return;
  }
  pushContextOverrideHistory();
  contextOverrides.clear();
  renderState(currentState);
}

function undoLocalContextOverride(): void {
  const previous = contextOverrideHistory.pop();
  if (!previous) {
    return;
  }
  contextOverrides = new Map(previous);
  renderState(currentState);
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
  return currentState.kiwiControl?.contextView.task
    ?? currentState.kiwiControl?.nextActions.actions[0]?.action
    ?? currentState.repoState.detail;
}

function toggleComposer(mode: Exclude<CommandComposerMode, null>): void {
  if (commandState.loading) {
    return;
  }
  if (commandState.composer === mode) {
    commandState.composer = null;
    commandState.draftValue = "";
  } else {
    commandState.composer = mode;
    commandState.draftValue = seedComposerDraft(mode);
  }
  renderState(currentState);
}

async function refreshCurrentRepoState(): Promise<void> {
  if (!currentTargetRoot) {
    return;
  }
  await loadAndRenderTarget(currentTargetRoot, "manual");
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
  renderState(currentState);

  try {
    const result = await invoke<CliCommandResultPayload>("run_cli_command", {
      command,
      args,
      targetRoot: currentTargetRoot,
      expectJson: options.expectJson
    });
    commandState.lastResult = result;
    commandState.lastError = result.ok ? null : result.stderr || result.stdout || `${result.commandLabel} failed`;
    if (result.ok) {
      commandState.composer = null;
      commandState.draftValue = "";
      await refreshCurrentRepoState();
    } else {
      renderState(currentState);
    }
    return result;
  } catch (error) {
    commandState.lastError = error instanceof Error ? error.message : String(error);
    renderState(currentState);
    return null;
  } finally {
    commandState.loading = false;
    commandState.activeCommand = null;
    renderState(currentState);
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
  renderState(currentState);
}

function toggleSkippedPlanStep(stepId: string): void {
  if (localPlanSkipped.has(stepId)) {
    localPlanSkipped.delete(stepId);
  } else {
    localPlanSkipped.add(stepId);
  }
  renderState(currentState);
}

function startEditingPlanStep(stepId: string, currentLabel: string): void {
  editingPlanStepId = stepId;
  editingPlanDraft = currentLabel;
  renderState(currentState);
}

function commitPlanStepEdit(stepId: string): void {
  const existing = localPlanEdits.get(stepId) ?? { label: "", note: "" };
  localPlanEdits.set(stepId, {
    ...existing,
    label: editingPlanDraft.trim() || existing.label
  });
  editingPlanStepId = null;
  editingPlanDraft = "";
  renderState(currentState);
}

function deriveGraphModel(state: RepoControlState): InteractiveGraphModel {
  const tree = deriveInteractiveTree(state);
  const rootPath = state.targetRoot || "repo";
  const focusPath = graphSelectedPath ?? (focusedItem?.kind === "path" ? focusedItem.path : null);
  const highlightedPaths = new Set(deriveHighlightedGraphPaths(state, focusPath));
  const root: InteractiveGraphNode = {
    path: rootPath,
    label: getRepoLabel(rootPath) || "repo",
    kind: "root",
    status: "selected",
    x: 600 + (graphNodePositions.get(rootPath)?.x ?? 0),
    y: 360 + (graphNodePositions.get(rootPath)?.y ?? 0),
    radius: 34,
    tone: "tone-root",
    importance: "high",
    highlighted: highlightedPaths.has(rootPath)
  };

  const nodes: InteractiveGraphNode[] = [root];
  const edges: InteractiveGraphEdge[] = [];
  const summary: InteractiveGraphModel["summary"] = [];
  const visibleTopLevel = tree.nodes.slice(0, 10);

  visibleTopLevel.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(visibleTopLevel.length, 1);
    const baseX = 600 + Math.cos(angle) * 220;
    const baseY = 360 + Math.sin(angle) * 220;
    const offset = graphNodePositions.get(node.path) ?? { x: 0, y: 0 };
    const importance = deriveNodeImportance(node);
    const graphNode: InteractiveGraphNode = {
      path: node.path,
      label: node.name,
      kind: node.kind,
      status: node.status,
      x: baseX + offset.x,
      y: baseY + offset.y,
      radius: importance === "high" ? 26 : importance === "medium" ? 22 : 18,
      tone: `tone-${node.status}`,
      importance,
      highlighted: highlightedPaths.has(node.path)
    };
    nodes.push(graphNode);
    edges.push({
      fromPath: root.path,
      toPath: graphNode.path,
      from: { x: root.x, y: root.y },
      to: { x: graphNode.x, y: graphNode.y },
      highlighted: highlightedPaths.has(root.path) && highlightedPaths.has(graphNode.path)
    });
    summary.push({
      label: node.name,
      kind: node.kind,
      meta: `${node.children.length} child nodes`,
      path: node.path
    });

    if (graphDepth < 2) {
      return;
    }

    node.children.slice(0, graphDepth > 2 ? 6 : 4).forEach((child, childIndex) => {
      const childAngle = angle + ((childIndex - 1.5) * 0.32);
      const childBaseX = graphNode.x + Math.cos(childAngle) * 160;
      const childBaseY = graphNode.y + Math.sin(childAngle) * 160;
      const childOffset = graphNodePositions.get(child.path) ?? { x: 0, y: 0 };
      const childImportance = deriveNodeImportance(child);
      const childNode: InteractiveGraphNode = {
        path: child.path,
        label: child.name,
        kind: child.kind,
        status: child.status,
        x: childBaseX + childOffset.x,
        y: childBaseY + childOffset.y,
        radius: childImportance === "high" ? 18 : childImportance === "medium" ? 16 : 14,
        tone: `tone-${child.status}`,
        importance: childImportance,
        highlighted: highlightedPaths.has(child.path)
      };
      nodes.push(childNode);
      edges.push({
        fromPath: graphNode.path,
        toPath: childNode.path,
        from: { x: graphNode.x, y: graphNode.y },
        to: { x: childNode.x, y: childNode.y },
        highlighted: highlightedPaths.has(graphNode.path) && highlightedPaths.has(childNode.path)
      });
      summary.push({
        label: child.name,
        kind: child.kind,
        meta: child.status,
        path: child.path
      });
    });
  });

  return { nodes, edges, summary };
}

function deriveNodeImportance(node: KiwiControlContextTreeNode): "low" | "medium" | "high" {
  const analysisEntry = currentState.kiwiControl?.fileAnalysis.selected.find((entry) => entry.file === node.path);
  if (node.status === "selected" || (analysisEntry?.score ?? 0) >= 2 || (analysisEntry?.dependencyChain?.length ?? 0) > 1) {
    return "high";
  }
  if (node.status === "candidate" || node.children.some((child) => child.status === "selected")) {
    return "medium";
  }
  return "low";
}

function deriveHighlightedGraphPaths(state: RepoControlState, focusPath: string | null): string[] {
  if (!focusPath) {
    return [];
  }

  const dependencyChain = state.kiwiControl?.fileAnalysis.selected.find((entry) => entry.file === focusPath)?.dependencyChain;
  if (dependencyChain && dependencyChain.length > 1) {
    return dependencyChain;
  }

  const parts = focusPath.split(/[\\/]/).filter(Boolean);
  const segments: string[] = [];
  let accumulator = focusPath.startsWith("/") ? "/" : "";
  for (const part of parts) {
    accumulator = accumulator ? `${accumulator.replace(/\/$/, "")}/${part}` : part;
    segments.push(accumulator);
  }
  return segments;
}

function basenameForPath(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function renderCommandBanner(): string {
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
      <section class="kc-panel kc-command-banner tone-${tone}">
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

  const submitComposer = target.closest<HTMLElement>("[data-composer-submit]");
  if (submitComposer?.dataset.composerSubmit) {
    const mode = submitComposer.dataset.composerSubmit as Exclude<CommandComposerMode, null>;
    const value = commandState.draftValue.trim();
    if (!value) {
      commandState.lastError = `${mode} requires a value before running.`;
      renderState(currentState);
      return true;
    }
    const command = mode === "run-auto" ? "run-auto" : mode === "checkpoint" ? "checkpoint" : "handoff";
    void executeKiwiCommand(command, [value], { expectJson: false });
    return true;
  }

  if (target.closest("[data-composer-cancel]")) {
    commandState.composer = null;
    commandState.draftValue = "";
    renderState(currentState);
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
      renderState(currentState);
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
      renderState(currentState);
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
    renderState(currentState);
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
        renderState(currentState);
        return true;
      } else {
        applyLocalContextOverride(path, action as ContextOverrideMode);
        return true;
      }
    }
    renderState(currentState);
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
        renderState(currentState);
        break;
      case "move-up":
        movePlanStep(stepId, -1);
        break;
      case "move-down":
        movePlanStep(stepId, 1);
        break;
      case "focus":
        focusedItem = { kind: "step", id: step.id, label: step.displayTitle };
        renderState(currentState);
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
      renderState(currentState);
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

function renderState(state: RepoControlState): void {
  currentState = state;
  syncInteractiveSessionState(state);

  railNavElement.innerHTML = renderRailNav();
  topbarElement.innerHTML = renderTopBar(state);
  centerMainElement.innerHTML = `${renderCommandBanner()}${renderCenterView(state)}`;
  inspectorElement.innerHTML = renderInspector(state);
  logDrawerElement.innerHTML = renderLogDrawer(state);

  workspaceSurfaceElement.classList.toggle("is-inspector-open", isInspectorOpen);
  workspaceSurfaceElement.classList.toggle("is-log-open", isLogDrawerOpen);
  inspectorElement.classList.toggle("is-hidden", !isInspectorOpen);
  logDrawerElement.classList.toggle("is-hidden", !isLogDrawerOpen);
}

function renderRailNav(): string {
  return NAV_ITEMS.map((item) => `
    <button class="kc-rail-button ${item.id === activeView ? "is-active" : ""}" data-view="${item.id}" type="button">
      <span class="kc-rail-icon">${item.icon}</span>
      <span class="kc-rail-label">${escapeHtml(item.label)}</span>
    </button>
  `).join("");
}

function renderTopBar(state: RepoControlState): string {
  const decision = buildDecisionSummary(state);
  const repoLabel = getRepoLabel(state.targetRoot);
  const phase = getPanelValue(state.repoOverview, "Current phase");
  const validationState = getPanelValue(state.repoOverview, "Validation state");
  const themeLabel = activeTheme === "dark" ? "Light mode" : "Dark mode";
  const currentTask = state.kiwiControl?.contextView.task ?? state.kiwiControl?.nextActions.actions[0]?.action ?? "";
  const retryEnabled = Boolean(state.kiwiControl?.executionPlan.lastError?.retryCommand) || Boolean(currentTargetRoot);

  return renderTopBarView({
    state,
    decision,
    repoLabel,
    phase,
    validationState,
    themeLabel,
    activeTheme,
    activeMode,
    isLogDrawerOpen,
    isInspectorOpen,
    currentTargetRoot,
    commandState,
    currentTask,
    retryEnabled,
    helpers: buildUiRenderHelpers()
  });
}

function buildDecisionSummary(state: RepoControlState): {
  nextAction: string;
  blockingIssue: string;
  systemHealth: string;
  executionSafety: string;
  lastChangedAt: string;
  recentFailures: number;
  newWarnings: number;
} {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const nextAction = kc.nextActions.actions[0]?.action ?? state.repoState.title;
  const blockingIssue =
    kc.executionPlan.lastError?.reason ??
    (state.validation.errors > 0 ? `${state.validation.errors} validation error${state.validation.errors === 1 ? "" : "s"}` : "none");
  const recentFailures =
    kc.execution.recentExecutions.filter((entry) => !entry.success).length +
    kc.workflow.steps.filter((step) => step.status === "failed").length;
  const newWarnings = state.validation.warnings + state.machineAdvisory.systemHealth.warningCount;
  const systemHealth =
    state.validation.errors > 0 || state.machineAdvisory.systemHealth.criticalCount > 0
      ? "blocked"
      : newWarnings > 0
        ? "attention"
        : "healthy";
  const executionSafety =
    isLoadingRepoState
      ? "loading"
      : systemHealth === "blocked"
        ? "blocked"
        : kc.contextView.confidence === "low" || kc.indexing.partialScan
          ? "guarded"
          : "ready";
  const timestamps = [
    kc.execution.recentExecutions[0]?.timestamp,
    kc.runtimeLifecycle.recentEvents[0]?.timestamp,
    kc.feedback.recentEntries[0]?.timestamp
  ].filter((value): value is string => Boolean(value));
  const lastChangedAt = timestamps.length > 0
    ? formatTimestamp(
        timestamps
          .map((value) => new Date(value))
          .sort((left, right) => right.getTime() - left.getTime())[0]?.toISOString() ?? ""
      )
    : "unknown";

  return {
    nextAction,
    blockingIssue,
    systemHealth,
    executionSafety,
    lastChangedAt,
    recentFailures,
    newWarnings
  };
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
    renderHeaderBadge,
    renderHeaderMeta,
    renderPanelHeader,
    renderInlineBadge,
    renderNoteRow,
    renderEmptyState,
    renderStatCard,
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

function renderOverviewView(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const interactiveTree = deriveInteractiveTree(state);
  const decision = buildDecisionSummary(state);
  const primaryAction = kc.nextActions.actions[0] ?? null;
  const currentFocus = getPanelValue(state.continuity, "Current focus");
  const activeSpecialist = state.specialists.activeProfile?.name ?? state.specialists.activeSpecialist;
  const selectedTask = kc.contextView.task ?? "No prepared task";
  const compatibleMcpCount = state.mcpPacks.compatibleCapabilities.length;
  const learnedFiles = kc.feedback.topBoostedFiles.slice(0, 3).map((entry) => entry.file);

  return `
    <div class="kc-view-shell">
      <section class="kc-panel kc-panel-primary">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${iconLabel(iconSvg("overview"), "Next Action")}
            ${primaryAction ? renderHeaderBadge(primaryAction.priority, primaryAction.priority) : renderHeaderBadge("stable", "neutral")}
          </div>
          <h1>${escapeHtml(primaryAction?.action ?? state.repoState.title)}</h1>
          <p>${escapeHtml(primaryAction?.reason ?? (kc.nextActions.summary || state.repoState.detail))}</p>
        </div>
        <div class="kc-primary-footer">
          ${primaryAction?.command ? `<code class="kc-command-chip">${escapeHtml(primaryAction.command)}</code>` : ""}
          <span>${escapeHtml(currentFocus)}</span>
        </div>
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Repo Health", state.repoState.title, state.validation.ok ? "passing" : `${state.validation.errors + state.validation.warnings} issues`, state.validation.ok ? "success" : "warn")}
        ${renderStatCard("Task", selectedTask, kc.contextView.confidenceDetail ?? "no prepared scope", "neutral")}
        ${renderStatCard("Selected", String(interactiveTree.selectedCount), "files Kiwi chose", "neutral")}
        ${renderStatCard("Ignored", String(interactiveTree.excludedCount), "files Kiwi filtered out", "warn")}
        ${renderStatCard("Lifecycle", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.nextRecommendedAction ?? "runtime stage not recorded yet", "neutral")}
        ${renderStatCard("Skills", String(kc.skills.activeSkills.length), kc.skills.activeSkills.length > 0 ? kc.skills.activeSkills.map((skill) => skill.name).join(", ") : "none active", "neutral")}
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Guided Operation", "What is happening, what is wrong, and what to do next.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${renderNoteRow("Current state", state.repoState.title, state.repoState.detail)}
              ${renderNoteRow("Blocking issue", decision.blockingIssue, decision.systemHealth === "blocked" ? "Resolve this before trusting execution." : "No hard blocker is currently active.")}
              ${renderNoteRow("Recommended next action", decision.nextAction, primaryAction?.command ?? kc.executionPlan.nextCommands[0] ?? "No next command is currently recorded.")}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${renderNoteRow("Execution safety", decision.executionSafety, decision.executionSafety === "ready" ? "Execution is safe to continue." : decision.executionSafety === "guarded" ? "Context or validation signals suggest caution." : "Wait for hydration or clear blockers first.")}
              ${renderNoteRow("Recent change", decision.lastChangedAt, kc.runtimeLifecycle.recentEvents[0]?.summary ?? "No recent lifecycle event is recorded.")}
              ${renderNoteRow("State trust", "repo-local", "Repo state and .agent artifacts remain authoritative. Local UI-only edits do not replace repo truth.")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Repo State", "Current repo truth, routing, and system fit.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Project type", state.projectType)}
            ${renderInfoRow("Execution mode", state.executionMode)}
            ${renderInfoRow("Active specialist", activeSpecialist)}
            ${renderInfoRow("Suggested pack", state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id)}
            ${renderInfoRow("Compatible MCPs", String(compatibleMcpCount))}
            ${renderInfoRow("Feedback", `${kc.feedback.adaptationLevel} (${kc.feedback.totalRuns} runs)`)}
            ${renderInfoRow("Measured usage", kc.measuredUsage.available ? `${formatTokensShort(kc.measuredUsage.totalTokens)} over ${kc.measuredUsage.totalRuns} runs` : "unavailable")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Task Summary", "What Kiwi knows right now about the active working set.")}
          <div class="kc-keyline-value">
            <strong>${escapeHtml(selectedTask)}</strong>
            <span>${escapeHtml((kc.indexing.selectionReason ?? kc.contextView.reason ?? kc.nextActions.summary) || state.repoState.detail)}</span>
          </div>
        </section>
      </div>

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

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("What Kiwi Knows", "Immediate operating context exposed as concrete system signals.")}
          <div class="kc-stack-list">
            ${renderNoteRow("Reasoning", kc.contextView.confidence?.toUpperCase() ?? "unknown", kc.contextView.confidenceDetail ?? "No context confidence has been recorded yet.")}
            ${renderNoteRow("Indexing", `${kc.indexing.discoveredFiles} files`, kc.indexing.coverageNote)}
            ${renderNoteRow("Validation", `${state.validation.errors} errors / ${state.validation.warnings} warnings`, state.repoState.detail)}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("What Kiwi Learned", "Adaptive feedback and recent system memory for this task scope.")}
          ${kc.feedback.basedOnPastRuns
            ? `<div class="kc-stack-list">
                ${renderNoteRow("based on past runs", kc.feedback.reusedPattern ?? "similar work", kc.feedback.note)}
                ${kc.feedback.similarTasks.slice(0, 3).map((entry) => renderNoteRow(entry.task, `similarity ${entry.similarity}`, formatTimestamp(entry.timestamp))).join("")}
              </div>`
            : learnedFiles.length > 0
              ? renderListBadges(learnedFiles)
              : renderEmptyState("No learned file preference is strong enough to surface yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Active Skills", "Repo-local skills currently shaping the task instructions and workflow trace.")}
          ${kc.skills.activeSkills.length > 0
            ? `<div class="kc-stack-list">${kc.skills.activeSkills.map((skill) => renderNoteRow(skill.name, `score ${skill.score}`, skill.executionTemplate[0] ?? skill.description)).join("")}</div>`
            : renderEmptyState("No repo-local skills matched the active task.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Suggested Skills", "Additional repo-local skills that may become relevant as the task expands.")}
          ${kc.skills.suggestedSkills.length > 0
            ? `<div class="kc-stack-list">${kc.skills.suggestedSkills.map((skill) => renderNoteRow(skill.name, `score ${skill.score}`, skill.description || skill.triggerConditions.join(", "))).join("")}</div>`
            : renderEmptyState("No additional skills are currently suggested.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("HOW IT WORKS", "What Kiwi did, how it did it, and what it intentionally left out.")}
          <div class="kc-stack-list">
            ${renderNoteRow("What was done", `${kc.fileAnalysis.selectedFiles} selected`, "Kiwi built a bounded working set from repo-local signals, then trimmed low-relevance files.")}
            ${renderNoteRow("How it was done", `${kc.contextTrace.expansionSteps.length} trace steps`, kc.contextTrace.expansionSteps[0]?.summary ?? "No context trace has been recorded yet.")}
            ${renderNoteRow("Why it was done", kc.decisionLogic.decisionPriority, kc.decisionLogic.summary || "No decision summary is recorded yet.")}
            ${renderNoteRow("What was ignored", `${kc.fileAnalysis.excludedFiles} excluded / ${kc.fileAnalysis.skippedFiles} skipped`, kc.decisionLogic.ignoredSignals[0] ?? kc.fileAnalysis.excluded[0]?.note ?? "No ignored signals are currently surfaced.")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("DECISION LOGIC", "The reasoning chain behind the current primary action.")}
          ${kc.decisionLogic.reasoningChain.length > 0
            ? `<div class="kc-stack-list">${kc.decisionLogic.reasoningChain.slice(0, 4).map((item) => renderBulletRow(item)).join("")}</div>`
            : renderEmptyState("No decision reasoning is available yet.")}
        </section>
      </div>
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

  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">MCP Surface</p>
          <h1>${escapeHtml(state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id)}</h1>
          <p>${escapeHtml(state.mcpPacks.suggestedPack.description)}</p>
        </div>
        ${renderHeaderBadge(state.mcpPacks.capabilityStatus, state.mcpPacks.capabilityStatus === "compatible" ? "success" : "warn")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Compatible MCPs", String(capabilities.length), "active specialist + profile", capabilities.length > 0 ? "success" : "warn")}
        ${renderStatCard("High Trust", String(highTrustCount), "preferred first", highTrustCount > 0 ? "success" : "neutral")}
        ${renderStatCard("Write Capable", String(writeCapableCount), "requires judgment", writeCapableCount > 0 ? "warn" : "neutral")}
        ${renderStatCard("Approval Gates", String(approvalCount), "extra caution", approvalCount > 0 ? "warn" : "neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Suggested Pack", state.mcpPacks.note)}
          <div class="kc-stack-list">
            ${(state.mcpPacks.suggestedPack.guidance ?? []).map((item: string) => renderBulletRow(item)).join("")}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${(state.mcpPacks.suggestedPack.realismNotes ?? []).map((item: string) => renderNoteRow("Reality check", "advisory", item)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Compatible MCP Capabilities", "These are the currently compatible MCP capabilities for the active specialist and repo profile.")}
          ${capabilities.length > 0
            ? `<div class="kc-stack-list">${capabilities.map((capability) => renderCapabilityCard(capability)).join("")}</div>`
            : renderEmptyState("No compatible MCP capabilities are currently exposed for this specialist and profile.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Available Packs", "Pack guidance shapes operator expectations, but does not imply universal runtime parity.")}
        <div class="kc-fold-grid">
          ${state.mcpPacks.available.map((pack) => `
            <details class="kc-fold-card" ${pack.id === state.mcpPacks.suggestedPack.id ? "open" : ""}>
              <summary>
                <div>
                  <strong>${escapeHtml(pack.name ?? pack.id)}</strong>
                  <span>${escapeHtml(pack.description)}</span>
                </div>
                ${renderHeaderBadge(pack.id === state.mcpPacks.suggestedPack.id ? "selected" : "available", pack.id === state.mcpPacks.suggestedPack.id ? "success" : "neutral")}
              </summary>
              <div class="kc-fold-body">
                <div class="kc-stack-list">
                  ${(pack.guidance ?? []).map((item) => renderBulletRow(item)).join("")}
                </div>
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function buildTokenGuidanceItems(state: RepoControlState): Array<{ title: string; metric: string; note: string }> {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const tokens = kc.tokenAnalytics;
  const items: Array<{ title: string; metric: string; note: string }> = [];

  if (!tokens.estimationMethod) {
    items.push({
      title: "Generate a bounded estimate",
      metric: "prepare first",
      note: 'Run kc prepare "your task" so Kiwi can record a selected working set before showing reduction guidance.'
    });
  } else {
    items.push({
      title: "Narrow the working set",
      metric: `${tokens.fileCountSelected}/${tokens.fileCountTotal} files`,
      note: "Use Include, Exclude, and Ignore in Context or Graph to shrink the selected scope before execution."
    });
  }

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
      note: "Run guide, validate, or execution flows to collect measured token usage. Until then, the token view is heuristic."
    });
  }

  return items;
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
        ${renderStatCard("Lifecycle", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.validationStatus ?? "no validation status", "neutral")}
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
          ${renderPanelHeader("Task Lifecycle", "A lightweight runtime trail from prepare to packet generation, checkpoint, and handoff.")}
          <div class="kc-stack-list">
            ${renderNoteRow("Current stage", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.nextRecommendedAction ?? "No next runtime action is recorded yet.")}
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
        ${renderPanelHeader("Next Commands", "Exact CLI commands from the current execution plan.")}
        ${kc.executionPlan.nextCommands.length > 0
          ? renderListBadges(kc.executionPlan.nextCommands)
          : renderEmptyState("No next commands are currently recorded.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Workflow Steps", "Linear workflow state for the active task.")}
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
        ${renderPanelHeader("DECISION LOGIC", "Which signals won, and which signals were intentionally ignored.")}
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
        ${renderPanelHeader("Runtime Events", "Hook-style events emitted by Kiwi’s lightweight runtime integration.")}
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
  const machine = state.machineAdvisory;
  const groupedGuidance = {
    critical: machine.guidance.filter((entry) => entry.group === "critical-issues"),
    recommended: machine.guidance.filter((entry) => entry.group === "improvements"),
    optional: machine.guidance.filter((entry) => entry.group === "optional-optimizations")
  };
  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Machine Advisory</p>
          <h1>System Limitations</h1>
          <p>Read-only machine limitations and repair guidance. This never overrides repo-local Kiwi state. Generated by ${escapeHtml(machine.generatedBy)}.</p>
        </div>
        ${renderHeaderBadge(machine.stale ? "stale" : "fresh", machine.stale ? "warn" : "success")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Critical", String(machine.systemHealth.criticalCount), "fix first", machine.systemHealth.criticalCount > 0 ? "critical" : "neutral")}
        ${renderStatCard("Warnings", String(machine.systemHealth.warningCount), "recommended actions", machine.systemHealth.warningCount > 0 ? "warn" : "neutral")}
        ${renderStatCard("Healthy", String(machine.systemHealth.okCount), "healthy checks", "success")}
        ${renderStatCard("Claude MCPs", String(machine.mcpInventory.claudeTotal), "configured servers", "neutral")}
        ${renderStatCard("Codex MCPs", String(machine.mcpInventory.codexTotal), "configured servers", "neutral")}
        ${renderStatCard("Copilot MCPs", String(machine.mcpInventory.copilotTotal), "configured servers", "neutral")}
        ${renderStatCard("Skills", String(machine.skillsCount), "agent skills in ~/.agents/skills", "neutral")}
        ${renderStatCard("Window", `${machine.windowDays} days`, machine.note, machine.stale ? "warn" : "success")}
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Top Signals", "Machine-level limits that matter first for the current repo and workflow state.")}
        <div class="kc-stack-list">
          ${renderNoteRow("Critical issues", String(machine.systemHealth.criticalCount), machine.systemHealth.criticalCount > 0 ? "Fix these before relying on machine hints." : "No critical machine blockers are currently active.")}
          ${renderNoteRow("Warnings", String(machine.systemHealth.warningCount), machine.systemHealth.warningCount > 0 ? "Recommended improvements are available." : "No active advisory warnings right now.")}
          ${renderNoteRow("Usage window", `${machine.windowDays} days`, machine.usage.codex.available || machine.usage.claude.available ? "Recent machine telemetry is available." : "Token tracking is currently limited.")}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("What AI-setup Added", "Structured provenance of the machine-local AI setup, grouped by phase.")}
        ${renderFreshnessRow(machine.sections.setupPhases)}
        ${machine.setupPhases.length > 0
          ? machine.setupPhases.map((phase) => `
              <div class="kc-stack-block">
                <p class="kc-stack-label">${escapeHtml(phase.phase)}</p>
                <div class="kc-stack-list">
                  ${phase.items.map((item) => renderNoteRow(item.name, item.active ? "active" : "inactive", `${item.description} · ${item.location}`)).join("")}
                </div>
              </div>
            `).join('<div class="kc-divider"></div>')
          : renderEmptyState("No machine-local setup provenance is available.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Config Health", "Machine-level config and hook surfaces.")}
        ${renderFreshnessRow(machine.sections.configHealth)}
        ${machine.configHealth.length > 0
          ? renderMachineTable(
              ["Config", "Status", "Description"],
              machine.configHealth.map((entry) => [
                escapeHtml(entry.path),
                renderMachineStateChip(entry.healthy, "healthy", "issue"),
                escapeHtml(entry.description)
              ])
            )
          : renderEmptyState("No config health data is available.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader(`Token Usage (Last ${machine.windowDays} Days)`, "Measured usage from Claude and Codex local sources.")}
        ${renderFreshnessRow(machine.sections.usage)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${renderPanelHeader("Claude Code (via ccusage)", machine.usage.claude.note)}
            <div class="kc-stack-list">
              ${renderNoteRow("Total", machine.usage.claude.available ? `${formatInteger(machine.usage.claude.totals.totalTokens)} tokens` : "unavailable", machine.usage.claude.totals.totalCost != null ? `cache ${formatPercent(machine.usage.claude.totals.cacheHitRatio)} · cost ${formatCurrency(machine.usage.claude.totals.totalCost)}` : machine.usage.claude.note)}
            </div>
            <div class="kc-divider"></div>
            ${machine.usage.claude.days.length > 0
              ? renderMachineTable(
                  ["Date", "Input", "Output", "Cache Read", "Cost", "Models"],
                  machine.usage.claude.days.map((day) => [
                    escapeHtml(day.date),
                    escapeHtml(formatInteger(day.inputTokens)),
                    escapeHtml(formatInteger(day.outputTokens)),
                    escapeHtml(formatInteger(day.cacheReadTokens)),
                    escapeHtml(formatCurrency(day.totalCost)),
                    escapeHtml(day.modelsUsed.join(", ") || "—")
                  ])
                )
              : renderEmptyState(machine.usage.claude.note)}
          </section>
          <section class="kc-subpanel">
            ${renderPanelHeader("Codex (via session logs)", machine.usage.codex.note)}
            <div class="kc-stack-list">
              ${renderNoteRow("Total", machine.usage.codex.available ? `${formatInteger(machine.usage.codex.totals.totalTokens)} tokens` : "unavailable", machine.usage.codex.available ? `cache ${formatPercent(machine.usage.codex.totals.cacheHitRatio)} · sessions ${formatInteger(machine.usage.codex.totals.sessions)}` : machine.usage.codex.note)}
            </div>
            <div class="kc-divider"></div>
            ${machine.usage.codex.days.length > 0
              ? renderMachineTable(
                  ["Date", "Input", "Output", "Cached", "Sessions"],
                  machine.usage.codex.days.map((day) => [
                    escapeHtml(day.date),
                    escapeHtml(formatInteger(day.inputTokens)),
                    escapeHtml(formatInteger(day.outputTokens)),
                    escapeHtml(formatInteger(day.cachedInputTokens)),
                    escapeHtml(formatInteger(day.sessions))
                  ])
                )
              : renderEmptyState(machine.usage.codex.note)}
          </section>
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${renderNoteRow("Copilot CLI", machine.usage.copilot.available ? "available" : "unavailable", machine.usage.copilot.note)}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Guidance", "Assistive machine-local suggestions and repo hints. These are advisory only and never auto-applied.")}
        ${renderFreshnessRow(machine.sections.guidance)}
        ${machine.guidance.length > 0
          ? `
            ${groupedGuidance.critical.length > 0 ? renderGuidanceGroup("Critical Issues", groupedGuidance.critical) : ""}
            ${groupedGuidance.recommended.length > 0 ? renderGuidanceGroup("Improvements", groupedGuidance.recommended) : ""}
            ${groupedGuidance.optional.length > 0 ? renderGuidanceGroup("Optional Optimizations", groupedGuidance.optional) : ""}
          `
          : renderEmptyState("No machine-local suggestions are currently recorded.")}
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("System Details", "Expanded machine diagnostics for inspection mode.")}
        ${activeMode === "inspection"
          ? `
            <details class="kc-fold-card" open>
              <summary><strong>Toolchain inventory</strong><span>${escapeHtml(formatSectionSummary(machine.sections.inventory))}</span></summary>
              <div class="kc-fold-body">
                ${machine.inventory.length > 0
                  ? renderMachineTable(
                      ["Tool", "Version", "Phase", "Status"],
                      machine.inventory.map((tool) => [
                        escapeHtml(tool.name),
                        escapeHtml(tool.version),
                        escapeHtml(tool.phase),
                        renderMachineStateChip(tool.installed, "installed", "missing")
                      ])
                    )
                  : renderEmptyState("No machine-local tool inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>MCP servers</strong><span>${escapeHtml(formatSectionSummary(machine.sections.mcpInventory))}</span></summary>
              <div class="kc-fold-body">
                <div class="kc-info-grid">
                  ${renderInfoRow("Claude Code", formatInteger(machine.mcpInventory.claudeTotal))}
                  ${renderInfoRow("Codex", formatInteger(machine.mcpInventory.codexTotal))}
                  ${renderInfoRow("Copilot CLI", formatInteger(machine.mcpInventory.copilotTotal))}
                </div>
                <div class="kc-divider"></div>
                ${machine.mcpInventory.tokenServers.length > 0
                  ? renderMachineTable(
                      ["Server", "Claude Code", "Codex", "Copilot"],
                      machine.mcpInventory.tokenServers.map((server) => [
                        escapeHtml(server.name),
                        renderMachineStateChip(server.claude, "active", "—"),
                        renderMachineStateChip(server.codex, "active", "—"),
                        renderMachineStateChip(server.copilot, "active", "—")
                      ])
                    )
                  : renderEmptyState("No token-focused MCP inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Optimization layers</strong><span>${escapeHtml(formatSectionSummary(machine.sections.optimizationLayers))}</span></summary>
              <div class="kc-fold-body">
                ${machine.optimizationLayers.length > 0
                  ? renderMachineTable(
                      ["Layer", "Savings", "Claude Code", "Codex", "Copilot"],
                      machine.optimizationLayers.map((layer) => [
                        escapeHtml(layer.name),
                        escapeHtml(layer.savings),
                        renderMachineStateChip(layer.claude, "yes", "no"),
                        renderMachineStateChip(layer.codex, "yes", "no"),
                        renderMachineStateChip(layer.copilot, "yes", "no")
                      ])
                    )
                  : renderEmptyState("No optimization layer data is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Config health</strong><span>${escapeHtml(formatSectionSummary(machine.sections.configHealth))}</span></summary>
              <div class="kc-fold-body">
                ${machine.configHealth.length > 0
                  ? renderMachineTable(
                      ["Config", "Status", "Description"],
                      machine.configHealth.map((entry) => [
                        escapeHtml(entry.path),
                        renderMachineStateChip(entry.healthy, "healthy", "issue"),
                        escapeHtml(entry.description)
                      ])
                    )
                  : renderEmptyState("No config health data is available.")}
              </div>
            </details>
          `
          : renderEmptyState("Switch to inspection mode to expand raw machine internals.")}
      </section>
    </div>
  `;
}

function renderMachineTable(headers: string[], rows: string[][]): string {
  return `
    <div class="kc-table-shell">
      <table class="kc-data-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMachineStateChip(active: boolean, activeLabel: string, inactiveLabel: string): string {
  return `<span class="kc-machine-state ${active ? "is-active" : "is-inactive"}">${escapeHtml(active ? activeLabel : inactiveLabel)}</span>`;
}

function renderFreshnessRow(meta: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string }): string {
  return `
    <div class="kc-inline-badges kc-machine-freshness">
      ${renderHeaderBadge(meta.status, meta.status === "fresh" ? "success" : meta.status === "cached" ? "neutral" : "warn")}
      ${renderInlineBadge(meta.updatedAt ? formatTimestamp(meta.updatedAt) : "unknown time")}
      ${meta.reason ? renderInlineBadge(meta.reason) : ""}
    </div>
  `;
}

function formatSectionSummary(meta: { status: "fresh" | "cached" | "partial"; updatedAt: string; reason?: string }): string {
  return `${meta.status}${meta.updatedAt ? ` · ${formatTimestamp(meta.updatedAt)}` : ""}${meta.reason ? ` · ${meta.reason}` : ""}`;
}

function renderGuidanceRow(entry: RepoControlState["machineAdvisory"]["guidance"][number]): string {
  const actions = [entry.fixCommand, entry.hintCommand].filter(Boolean).join(" | ");
  return `
    <div class="kc-note-row">
      <div>
        <strong>${escapeHtml(entry.message)}</strong>
        <span>${escapeHtml(entry.reason ?? `section: ${entry.section}`)}</span>
        <span>${escapeHtml(entry.impact)}</span>
      </div>
      <em class="${entry.priority === "critical" ? "tone-warn" : ""}">${escapeHtml(actions || entry.priority)}</em>
    </div>
  `;
}

function renderGuidanceGroup(
  title: string,
  entries: RepoControlState["machineAdvisory"]["guidance"]
): string {
  return `
    <div class="kc-stack-block">
      <p class="kc-stack-label">${escapeHtml(title)}</p>
      <div class="kc-stack-list">
        ${entries.map((entry) => renderGuidanceRow(entry)).join("")}
      </div>
    </div>
  `;
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

      <div class="kc-stat-grid">
        ${renderStatCard("Valid Runs", String(feedback.totalRuns), "successful completions", "neutral")}
        ${renderStatCard("Success Rate", `${feedback.successRate}%`, "repo-local", feedback.successRate >= 80 ? "success" : "neutral")}
        ${renderStatCard("Boosted", String(feedback.topBoostedFiles.length), "task-scope files", "success")}
        ${renderStatCard("Penalized", String(feedback.topPenalizedFiles.length), "task-scope files", "warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${renderPanelHeader("Boosted Files", "Files that improved successful runs in this task scope.")}
          ${feedback.topBoostedFiles.length > 0
            ? `<div class="kc-stack-list">${feedback.topBoostedFiles.map((entry) => renderScoreRow(entry.file, entry.score, "success")).join("")}</div>`
            : renderEmptyState("No boosted files are recorded yet.")}
        </section>
        <section class="kc-panel">
          ${renderPanelHeader("Penalized Files", "Files Kiwi Control is learning to avoid for this task scope.")}
          ${feedback.topPenalizedFiles.length > 0
            ? `<div class="kc-stack-list">${feedback.topPenalizedFiles.map((entry) => renderScoreRow(entry.file, entry.score, "warn")).join("")}</div>`
            : renderEmptyState("No penalized files are recorded yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Recent Completions", "Only valid successful completions train future selection behavior.")}
        ${feedback.recentEntries.length > 0
          ? `<div class="kc-stack-list">${feedback.recentEntries.map((entry) => `
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

      <section class="kc-panel">
        ${renderPanelHeader("Retrieval Reuse", "When Kiwi reuses a successful pattern, it still falls back to fresh selection if similarity is weak.")}
        ${feedback.basedOnPastRuns
          ? `<div class="kc-stack-list">
              ${renderNoteRow("reused pattern", feedback.reusedPattern ?? "similar work", feedback.note)}
              ${feedback.similarTasks.slice(0, 4).map((entry) => renderNoteRow(entry.task, `similarity ${entry.similarity}`, formatTimestamp(entry.timestamp))).join("")}
            </div>`
          : renderEmptyState("Current selection is not based on past runs strongly enough to reuse a prior pattern.")} 
      </section>
    </div>
  `;
}

function renderInspector(state: RepoControlState): string {
  const kc = state.kiwiControl ?? EMPTY_KC;
  const primaryAction = kc.nextActions.actions[0] ?? null;
  const activeSpecialist = state.specialists.activeProfile;
  const topCapability = state.mcpPacks.compatibleCapabilities[0] ?? null;
  const signalItems = kc.decisionLogic.inputSignals.slice(0, activeMode === "execution" ? 3 : 5);
  const currentFocus = focusedItem;
  const focusedStep = currentFocus?.kind === "step"
    ? deriveDisplayExecutionPlanSteps(state).find((step) => step.id === currentFocus.id) ?? null
    : null;
  const focusedNode = currentFocus?.kind === "path" ? findContextNodeByPath(state, currentFocus.path) : null;
  const focusedLabel = focusedStep?.displayTitle ?? focusedNode?.name ?? primaryAction?.action ?? "No blocking action";
  const focusedReason = focusedStep?.displayNote
    ?? focusedNode?.path
    ?? primaryAction?.reason
    ?? kc.nextActions.summary
    ?? state.repoState.detail;
  const marker = currentFocus ? approvalMarkers.get(currentFocus.id) ?? "unmarked" : "unmarked";

  return renderInspectorPanel({
    state,
    primaryAction,
    activeSpecialist,
    topCapability,
    signalItems,
    focusedStep,
    focusedNode,
    focusedItem: currentFocus,
    focusedLabel,
    focusedReason,
    marker,
    activeMode,
    commandState,
    helpers: {
      ...buildUiRenderHelpers(),
      renderGateRow,
      renderBulletRow
    }
  });
}

function renderLogDrawer(state: RepoControlState): string {
  const lines = buildLogLines(state);
  const executions = (state.kiwiControl ?? EMPTY_KC).execution.recentExecutions;

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
          ? executions.length > 0
            ? executions.slice(0, 6).map((execution) => `
                <div class="kc-log-line ${execution.success ? "" : "is-warn"}">
                  <span>${escapeHtml(execution.success ? "run" : "failed")}</span>
                  <strong>${escapeHtml(`${execution.task} · ${execution.filesTouched} files · ~${formatTokensShort(execution.tokensUsed)} tokens · ${formatTimestamp(execution.timestamp)}`)}</strong>
                </div>
              `).join("")
            : renderEmptyState("No execution history is recorded yet.")
          : activeLogTab === "validation"
          ? renderValidationLogBody(state.validation)
          : activeLogTab === "history"
            ? executions.length > 0
              ? executions.map((execution) => `
                  <div class="kc-log-line ${execution.success ? "" : "is-warn"}">
                    <span>${escapeHtml(execution.success ? "run" : "failed")}</span>
                    <strong>${escapeHtml(`${execution.task} · ${execution.filesTouched} files · ~${formatTokensShort(execution.tokensUsed)} tokens · ${formatTimestamp(execution.timestamp)}`)}</strong>
                  </div>
                `).join("")
              : renderEmptyState("No execution history is recorded yet.")
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

function renderExecutionPlanPanel(state: RepoControlState): string {
  const steps = deriveDisplayExecutionPlanSteps(state);
  return renderExecutionPlanPanelView({
    state,
    steps,
    editingPlanStepId,
    editingPlanDraft,
    focusedItem,
    commandState,
    helpers: {
      escapeHtml,
      escapeAttribute,
      renderPanelHeader,
      renderInlineBadge,
      renderNoteRow,
      renderEmptyState,
      renderHeaderBadge
    }
  });
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
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
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
  if (!state.targetRoot) {
    return "Run kc ui inside a repo to load it automatically.";
  }

  switch (state.repoState.mode) {
    case "healthy":
      return "Repo-local state is loaded and ready.";
    case "repo-not-initialized":
      return "This folder is not initialized yet. Run kc init in Terminal to get started.";
    case "initialized-invalid":
      return "This repo needs repair before continuity is fully trustworthy.";
    case "initialized-with-warnings":
      return "Repo is usable with a few warnings worth addressing.";
    case "bridge-unavailable":
    default:
      return BRIDGE_UNAVAILABLE_NEXT_STEP;
  }
}

function buildBridgeNote(state: RepoControlState, source: "cli" | "manual" | "shell"): string {
  const activeHint = buildActiveTargetHint(state);
  if (!state.targetRoot) {
    return activeHint;
  }
  if (state.repoState.mode === "bridge-unavailable") {
    return BRIDGE_UNAVAILABLE_NEXT_STEP;
  }
  if (source === "cli") {
    return `Loaded ${getRepoLabel(state.targetRoot)} from kc ui. ${activeHint}`;
  }
  if (source === "manual") {
    return `Loaded ${getRepoLabel(state.targetRoot)}. ${activeHint}`;
  }
  return activeHint;
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

async function loadRepoControlState(targetRoot: string): Promise<RepoControlState> {
  if (!isTauriBridgeAvailable()) {
    return buildBridgeUnavailableState(targetRoot);
  }

  try {
    return await invoke<RepoControlState>("load_repo_control_state", { targetRoot });
  } catch {
    return buildBridgeUnavailableState(targetRoot);
  }
}

function buildBridgeUnavailableState(targetRoot: string): RepoControlState {
  const hasTargetRoot = targetRoot.trim().length > 0;
  const resolvedTargetRoot = hasTargetRoot ? targetRoot : "";

  return {
    targetRoot: resolvedTargetRoot,
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
      suggestedPack: {
        id: "core-pack",
        description: "Default repo-first pack.",
        guidance: [],
        realismNotes: []
      },
      available: [],
      compatibleCapabilities: [],
      capabilityStatus: "limited",
      note: "No compatible MCP capabilities are available until repo-local state can be loaded."
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
      version: 2,
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
      systemHealth: {
        criticalCount: 0,
        warningCount: 0,
        okCount: 0
      },
      guidance: [],
      note: "Machine-local advisory is unavailable. Optimization score is intentionally omitted."
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
