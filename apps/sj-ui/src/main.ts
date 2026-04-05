import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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
    note: string;
  };
  kiwiControl?: KiwiControlState;
};

type LaunchRequestPayload = {
  requestId: string;
  targetRoot: string;
};

type NavView = "overview" | "context" | "tokens" | "feedback" | "mcps" | "specialists" | "system" | "validation" | "machine";
type LogTab = "validation" | "history" | "logs";
type ValidationTab = "all" | "issues" | "pending";
type HandoffTab = "handoffs" | "checkpoints";
type ThemeMode = "dark" | "light";
type PlatformMode = "macos" | "windows" | "linux";

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: iconSvg("overview") },
  { id: "context", label: "Context", icon: iconSvg("context") },
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

  if (target.closest("[data-reload-state]")) {
    if (currentTargetRoot) {
      void loadAndRenderTarget(currentTargetRoot, "manual");
    }
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

function renderState(state: RepoControlState): void {
  currentState = state;

  railNavElement.innerHTML = renderRailNav();
  topbarElement.innerHTML = renderTopBar(state);
  centerMainElement.innerHTML = renderCenterView(state);
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
  const repoLabel = getRepoLabel(state.targetRoot);
  const phase = getPanelValue(state.repoOverview, "Current phase");
  const activeRole = getPanelValue(state.repoOverview, "Active role");
  const validationState = getPanelValue(state.repoOverview, "Validation state");
  const packLabel = state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id;
  const capabilityCount = state.mcpPacks.compatibleCapabilities.length;
  const themeLabel = activeTheme === "dark" ? "Light mode" : "Dark mode";

  return `
    <div class="kc-topbar-left">
      <button class="kc-repo-pill" type="button">
        <span class="kc-repo-name">${escapeHtml(repoLabel)}</span>
        <span class="kc-repo-path">${escapeHtml(state.targetRoot || "No repo loaded yet")}</span>
      </button>
      ${renderHeaderBadge(state.repoState.title, state.repoState.mode)}
      ${renderHeaderBadge(state.projectType, "neutral")}
      ${phase !== "none recorded" ? renderHeaderBadge(phase, "neutral") : ""}
    </div>
    <div class="kc-topbar-center">
      ${renderHeaderMeta("Role", activeRole)}
      ${renderHeaderMeta("Pack", packLabel)}
      ${renderHeaderMeta("MCPs", `${capabilityCount} compatible`)}
    </div>
    <div class="kc-topbar-right">
      <div class="kc-status-chip">
        <strong>repo-local state only</strong>
        <span>${escapeHtml(validationState)}</span>
      </div>
      <button class="kc-theme-toggle" type="button" data-theme-toggle>
        ${iconSvg(activeTheme === "dark" ? "sun" : "moon")}
        <span>${escapeHtml(themeLabel)}</span>
      </button>
      <button class="kc-icon-button" type="button" data-toggle-logs>
        ${isLogDrawerOpen ? iconSvg("logs-open") : iconSvg("logs-closed")}
      </button>
      <button class="kc-icon-button" type="button" data-toggle-inspector>
        ${isInspectorOpen ? iconSvg("panel-open") : iconSvg("panel-closed")}
      </button>
    </div>
  `;
}

function renderHeaderMeta(label: string, value: string): string {
  return `
    <div class="kc-inline-meta">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCenterView(state: RepoControlState): string {
  switch (activeView) {
    case "context":
      return renderContextView(state);
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
        ${renderStatCard("Selected", String(kc.contextView.tree.selectedCount), "files Kiwi chose", "neutral")}
        ${renderStatCard("Ignored", String(kc.contextView.tree.excludedCount), "files Kiwi filtered out", "warn")}
        ${renderStatCard("Lifecycle", kc.runtimeLifecycle.currentStage, kc.runtimeLifecycle.nextRecommendedAction ?? "runtime stage not recorded yet", "neutral")}
        ${renderStatCard("Skills", String(kc.skills.activeSkills.length), kc.skills.activeSkills.length > 0 ? kc.skills.activeSkills.map((skill) => skill.name).join(", ") : "none active", "neutral")}
      </div>

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

      <section class="kc-panel">
        ${renderPanelHeader("Execution Plan", kc.executionPlan.summary || "No execution plan is recorded yet.")}
        <div class="kc-inline-badges">
          ${renderInlineBadge(`state: ${kc.executionPlan.state}`)}
          ${renderInlineBadge(`current: ${kc.executionPlan.steps[kc.executionPlan.currentStepIndex]?.id ?? "none"}`)}
          ${renderInlineBadge(`risk: ${kc.executionPlan.risk}`)}
          ${kc.executionPlan.confidence ? renderInlineBadge(`confidence: ${kc.executionPlan.confidence}`) : ""}
        </div>
        ${kc.executionPlan.lastError
          ? `<div class="kc-divider"></div><div class="kc-stack-list">
              ${renderNoteRow("Failure", kc.executionPlan.lastError.errorType, kc.executionPlan.lastError.reason)}
              ${renderNoteRow("Fix command", kc.executionPlan.lastError.fixCommand, "Run this before continuing.")}
              ${renderNoteRow("Retry command", kc.executionPlan.lastError.retryCommand, "Use this to retry the failed step.")}
            </div>`
          : ""}
        ${kc.executionPlan.steps.length > 0
          ? `<div class="kc-stack-list">${kc.executionPlan.steps.map((step) => renderNoteRow(
              `${step.description}`,
              step.status,
              `${step.command} | verify: ${step.validation}${step.fixCommand ? ` | fix: ${step.fixCommand}` : ""}${step.retryCommand ? ` | retry: ${step.retryCommand}` : ""}`
            )).join("")}</div>`
          : renderEmptyState("No execution plan is available yet.")}
      </section>

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${renderPanelHeader("Context Tree", "What Kiwi selected, considered, and ignored from the live selector state.")}
          ${renderHeaderBadge(kc.contextView.confidence?.toUpperCase() ?? "UNKNOWN", kc.contextView.confidence === "high" ? "success" : kc.contextView.confidence === "low" ? "warn" : "neutral")}
        </div>
        ${kc.contextView.tree.nodes.length > 0
          ? renderContextTree(kc.contextView.tree)
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
            <button class="kc-secondary-button" type="button" data-reload-state>${iconSvg("refresh")}Refresh</button>
          </div>
          ${ctx.tree.nodes.length > 0
            ? renderContextTree(ctx.tree)
            : renderEmptyState('Run kc prepare "your task" to build the repo tree from live selection signals.')}
        </section>

        <section class="kc-panel">
          ${renderPanelHeader("Selection State", ctx.reason ?? "No selection reason recorded.")}
          <div class="kc-info-grid">
            ${renderInfoRow("Confidence", ctx.confidence?.toUpperCase() ?? "UNKNOWN")}
            ${renderInfoRow("Scope area", indexing.scopeArea ?? "unknown")}
            ${renderInfoRow("Selected files", String(ctx.selectedFiles.length))}
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
            ${ctx.selectedFiles.length > 0 ? renderListBadges(ctx.selectedFiles) : renderEmptyState("No active files are selected yet.")}
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
  return `
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Machine Advisory</p>
          <h1>Machine-local AI toolchain</h1>
          <p>Read-only machine inventory, optimization layers, config health, and usage. This does not override repo-local Kiwi state. Generated by ${escapeHtml(machine.generatedBy)}.</p>
        </div>
        ${renderHeaderBadge(machine.stale ? "stale" : "fresh", machine.stale ? "warn" : "success")}
      </section>

      <div class="kc-stat-grid">
        ${renderStatCard("Claude MCPs", String(machine.mcpInventory.claudeTotal), "configured servers", "neutral")}
        ${renderStatCard("Codex MCPs", String(machine.mcpInventory.codexTotal), "configured servers", "neutral")}
        ${renderStatCard("Copilot MCPs", String(machine.mcpInventory.copilotTotal), "configured servers", "neutral")}
        ${renderStatCard("Skills", String(machine.skillsCount), "agent skills in ~/.agents/skills", "neutral")}
        ${renderStatCard("Copilot Plugins", String(machine.copilotPlugins.length), "installed plugins", "neutral")}
        ${renderStatCard("Window", `${machine.windowDays} days`, machine.note, machine.stale ? "warn" : "success")}
      </div>

      <section class="kc-panel">
        ${renderPanelHeader("Toolchain Inventory", "Detected binaries and versions on this machine.")}
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
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("MCP Servers", "Configured MCP counts by harness plus token-focused server coverage.")}
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
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Token Optimization Layers", "Machine-local optimization layers and whether they are active per harness.")}
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
        <p class="kc-table-note">Optimization score is intentionally omitted. Kiwi surfaces factual-only machine advisory.</p>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("Skills & Plugins", "Machine-local capability expansion surfaces.")}
        <div class="kc-stack-list">
          ${renderNoteRow("Claude Code", `${formatInteger(machine.skillsCount)} agent skills`, "~/.agents/skills/")}
          ${renderNoteRow("Codex", `${formatInteger(machine.mcpInventory.codexTotal)} MCP servers`, machine.inventory.some((tool) => tool.name === "omx" && tool.installed) ? "OMX orchestration detected" : "No OMX orchestration detected")}
          ${renderNoteRow("Copilot CLI", `${formatInteger(machine.copilotPlugins.length)} plugins`, machine.copilotPlugins.join(", ") || "none")}
        </div>
      </section>

      <section class="kc-panel">
        ${renderPanelHeader("What AI-setup Added", "Structured provenance of the machine-local AI setup, grouped by phase.")}
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

  return `
    <div class="kc-inspector-shell">
      <div class="kc-inspector-header">
        <div>
          <span>Inspector</span>
          <h2>${escapeHtml(primaryAction?.action ?? "No blocking action")}</h2>
        </div>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ${iconSvg("close")}
        </button>
      </div>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Reasoning</p>
        <p>${escapeHtml(primaryAction?.reason ?? (kc.nextActions.summary || state.repoState.detail))}</p>
        <div class="kc-inline-badges">
          ${renderInlineBadge(kc.contextView.confidence?.toUpperCase() ?? "UNKNOWN")}
          ${renderInlineBadge(kc.contextView.confidenceDetail ?? "No confidence detail")}
          ${renderExplainabilityBadge("heuristic", kc.contextTrace.honesty.heuristic)}
          ${renderExplainabilityBadge("low confidence", kc.contextTrace.honesty.lowConfidence)}
          ${renderExplainabilityBadge("partial scan", kc.contextTrace.honesty.partialScan || kc.tokenBreakdown.partialScan || kc.indexing.partialScan)}
        </div>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Decision inputs</p>
        ${kc.decisionLogic.inputSignals.length > 0
          ? `<div class="kc-stack-list">${kc.decisionLogic.inputSignals.slice(0, 5).map((item) => renderBulletRow(item)).join("")}</div>`
          : "<p>No decision inputs are currently surfaced.</p>"}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Lifecycle</p>
        <div class="kc-gate-list">
          ${renderGateRow("Stage", kc.runtimeLifecycle.currentStage, "default")}
          ${renderGateRow("Validation", kc.runtimeLifecycle.validationStatus ?? "unknown", kc.runtimeLifecycle.validationStatus === "error" ? "warn" : "default")}
        </div>
        <p>${escapeHtml(kc.runtimeLifecycle.nextRecommendedAction ?? "No runtime lifecycle recommendation is recorded yet.")}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Token estimate</p>
        <div class="kc-gate-list">
          ${renderGateRow("Measured", kc.measuredUsage.available ? formatTokensShort(kc.measuredUsage.totalTokens) : "none", kc.measuredUsage.available ? "success" : "default")}
          ${renderGateRow("Selected", `~${formatTokensShort(kc.tokenAnalytics.selectedTokens)}`, "default")}
          ${renderGateRow("Full repo", `~${formatTokensShort(kc.tokenAnalytics.fullRepoTokens)}`, "default")}
          ${renderGateRow("Saved", `~${kc.tokenAnalytics.savingsPercent}%`, "success")}
        </div>
        <p>${escapeHtml(kc.measuredUsage.available ? kc.measuredUsage.note : (kc.tokenAnalytics.estimateNote ?? "No repo-local token estimate is available yet."))}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Feedback</p>
        <div class="kc-gate-list">
          ${renderGateRow("Adaptation", kc.feedback.adaptationLevel, kc.feedback.adaptationLevel === "active" ? "success" : "default")}
          ${renderGateRow("Runs", String(kc.feedback.totalRuns), "default")}
          ${renderGateRow("Success", `${kc.feedback.successRate}%`, kc.feedback.successRate >= 80 ? "success" : "default")}
        </div>
        <p>${escapeHtml(kc.feedback.note)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">MCP usage</p>
        <div class="kc-gate-list">
          ${renderGateRow("Pack", state.mcpPacks.suggestedPack.name ?? state.mcpPacks.suggestedPack.id, "default")}
          ${renderGateRow("Compatible", String(state.mcpPacks.compatibleCapabilities.length), state.mcpPacks.compatibleCapabilities.length > 0 ? "success" : "warn")}
          ${renderGateRow("Top capability", topCapability?.id ?? "none", topCapability ? "success" : "warn")}
        </div>
        <p>${escapeHtml(state.mcpPacks.note)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Specialist usage</p>
        <div class="kc-gate-list">
          ${renderGateRow("Active", activeSpecialist?.name ?? state.specialists.activeSpecialist, "default")}
          ${renderGateRow("Risk", activeSpecialist?.riskPosture ?? "unknown", activeSpecialist?.riskPosture === "conservative" ? "success" : "default")}
          ${renderGateRow("Tool fit", (activeSpecialist?.preferredTools ?? []).join(", ") || "none", "default")}
        </div>
        <p>${escapeHtml(activeSpecialist?.purpose ?? state.specialists.safeParallelHint)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Skills & trace</p>
        ${kc.skills.activeSkills.length > 0
          ? `<div class="kc-stack-list">${kc.skills.activeSkills.slice(0, 3).map((skill) => renderBulletRow(`${skill.name} — ${skill.executionTemplate[0] ?? skill.description}`)).join("")}</div>`
          : `<p>No active skills are currently matched.</p>`}
        <div class="kc-divider"></div>
        <p>${escapeHtml(kc.executionTrace.whyThisHappened || "No execution trace explanation is recorded yet.")}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Command</p>
        ${primaryAction?.command
          ? `<code class="kc-command-block">${escapeHtml(primaryAction.command)}</code>`
          : `<p>No command recorded for the current state.</p>`}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Next Commands</p>
        ${kc.executionPlan.nextCommands.length > 0
          ? `<div class="kc-stack-list">${kc.executionPlan.nextCommands.map((command) => renderBulletRow(command)).join("")}</div>`
          : `<p>No execution plan commands are currently recorded.</p>`}
      </section>
    </div>
  `;
}

function renderLogDrawer(state: RepoControlState): string {
  const lines = buildLogLines(state);
  const executions = (state.kiwiControl ?? EMPTY_KC).execution.recentExecutions;

  return `
    <div class="kc-log-shell">
      <div class="kc-log-header">
        <div class="kc-tab-row">
          ${renderTabButton("history", activeLogTab, "Execution History", "data-log-tab")}
          ${renderTabButton("validation", activeLogTab, "Validation Output", "data-log-tab")}
          ${renderTabButton("logs", activeLogTab, "System Logs", "data-log-tab")}
        </div>
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${iconSvg("close")}
        </button>
      </div>
      <div class="kc-log-body">
        ${activeLogTab === "validation"
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
  return `
    <div class="kc-tree-shell">
      <div class="kc-tree-legend">
        <span><strong>✓</strong> selected</span>
        <span><strong>•</strong> candidate</span>
        <span><strong>×</strong> excluded</span>
      </div>
      <div class="kc-tree-root">
        ${tree.nodes.map((node) => renderContextTreeNode(node)).join("")}
      </div>
    </div>
  `;
}

function renderContextTreeNode(node: KiwiControlContextTreeNode): string {
  if (node.kind === "file") {
    return `
      <div class="kc-tree-node tree-${escapeHtml(node.status)}">
        <span class="kc-tree-row">
          <span class="kc-tree-status">${contextTreeStatusIcon(node.status)}</span>
          <span class="kc-tree-name">${escapeHtml(node.name)}</span>
        </span>
      </div>
    `;
  }

  return `
    <details class="kc-tree-node tree-dir tree-${escapeHtml(node.status)}" ${node.expanded ? "open" : ""}>
      <summary class="kc-tree-row">
        <span class="kc-tree-caret"></span>
        <span class="kc-tree-status">${contextTreeStatusIcon(node.status)}</span>
        <span class="kc-tree-name">${escapeHtml(node.name)}/</span>
      </summary>
      <div class="kc-tree-children">
        ${node.children.map((child) => renderContextTreeNode(child)).join("")}
      </div>
    </details>
  `;
}

function contextTreeStatusIcon(status: KiwiControlContextTreeStatus): string {
  switch (status) {
    case "selected":
      return "✓";
    case "excluded":
      return "×";
    default:
      return "•";
  }
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

function isTauriBridgeAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
