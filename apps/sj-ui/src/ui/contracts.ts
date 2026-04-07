export type RepoControlMode =
  | "bridge-unavailable"
  | "repo-not-initialized"
  | "initialized-invalid"
  | "initialized-with-warnings"
  | "healthy";

export type DesktopReadinessPhase =
  | "opening"
  | "warm_loaded"
  | "refreshing"
  | "ready"
  | "degraded"
  | "failed";

export type DesktopReadinessTone =
  | "loading"
  | "running"
  | "ready"
  | "warm"
  | "degraded"
  | "blocked";

export interface DesktopReadinessState {
  phase: DesktopReadinessPhase;
  visible: boolean;
  label: string;
  detail: string;
  progress: number;
  tone: DesktopReadinessTone;
  nextCommand: string | null;
}

export interface RecoveryGuidance {
  tone: "blocked" | "degraded" | "failed";
  title: string;
  detail: string;
  nextCommand: string | null;
  followUpCommand?: string | null;
  actionLabel?: string | null;
}

export interface DecisionSummary {
  nextAction: string;
  blockingIssue: string;
  systemHealth: string;
  executionSafety: string;
  lastChangedAt: string;
  recentFailures: number;
  newWarnings: number;
}

export interface MachineHeroSummary {
  overallStatus: "ready" | "needs work";
  overallTone: "success" | "warn";
  title: string;
  detail: string;
  bestHeuristicLabel: string;
  bestHeuristicValue: string;
  strongestGapLabel: string;
  strongestGapDetail: string;
  nextFixLabel: string;
  nextFixCommand: string;
}

export interface TerminalHelpEntry {
  command: string;
  label: string;
  detail: string;
}

export interface ExplainSelectionEntry {
  title: string;
  metric: string;
  note: string;
}

export interface ExplainCommandEntry {
  command: string;
  label: string;
  detail: string;
}

export interface BlockedWorkflowEntry {
  title: string;
  command: string;
  detail: string;
}

export type MachineAdvisorySectionName =
  | "inventory"
  | "mcpInventory"
  | "optimizationLayers"
  | "setupPhases"
  | "configHealth"
  | "usage"
  | "guidance";

export interface MachineAdvisorySectionState {
  status: "fresh" | "cached" | "partial";
  updatedAt: string;
  reason?: string;
}

export interface MachineAdvisoryViewState {
  artifactType: string;
  version: number;
  generatedBy: string;
  windowDays: number;
  updatedAt: string;
  stale: boolean;
  sections: Record<MachineAdvisorySectionName, MachineAdvisorySectionState>;
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
      totals: {
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        totalTokens: number;
        totalCost: number | null;
        cacheHitRatio: number | null;
      };
      note: string;
    };
    codex: {
      available: boolean;
      days: Array<{ date: string; inputTokens: number; outputTokens: number; cachedInputTokens: number; reasoningOutputTokens: number; sessions: number }>;
      totals: {
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        reasoningOutputTokens: number;
        sessions: number;
        totalTokens: number;
        cacheHitRatio: number | null;
      };
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
    section: MachineAdvisorySectionName;
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
}

export interface KiwiControlContextTreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  status: "selected" | "candidate" | "excluded";
  expanded: boolean;
  children: KiwiControlContextTreeNode[];
}

export interface KiwiControlContextTree {
  nodes: KiwiControlContextTreeNode[];
  selectedCount: number;
  candidateCount: number;
  excludedCount: number;
}

export interface RepoControlState {
  targetRoot: string;
  loadState: {
    source: "fresh" | "warm-snapshot" | "stale-snapshot" | "bridge-fallback";
    freshness: "fresh" | "warm" | "stale" | "failed";
    generatedAt: string;
    snapshotSavedAt: string | null;
    snapshotAgeMs: number | null;
    detail: string;
  };
  projectType: string;
  repoState: {
    mode: RepoControlMode;
    title: string;
    detail: string;
  };
  validation: {
    errors: number;
    warnings: number;
  };
  specialists: {
    activeSpecialist: string;
    handoffTargets: string[];
    safeParallelHint: string;
    activeProfile?: {
      name?: string;
      purpose?: string;
      preferredTools?: string[];
      riskPosture?: string;
    } | null;
  };
  mcpPacks: {
    note: string;
    suggestedPack: {
      id: string;
      name?: string;
    };
    compatibleCapabilities: Array<{
      id: string;
    }>;
  };
  machineAdvisory: MachineAdvisoryViewState;
  kiwiControl?: {
    contextView: {
      confidence: string | null;
      confidenceDetail: string | null;
      tree: KiwiControlContextTree;
    };
    nextActions: {
      actions: Array<{
        action: string;
        command: string | null;
        reason: string;
      }>;
      summary: string;
    };
    decisionLogic: {
      inputSignals: string[];
    };
    contextTrace: {
      honesty: {
        heuristic: boolean;
        lowConfidence: boolean;
        partialScan: boolean;
      };
    };
    tokenBreakdown: {
      partialScan: boolean;
    };
    indexing: {
      partialScan: boolean;
    };
    runtimeLifecycle: {
      currentStage: string;
      validationStatus: "ok" | "warn" | "error" | null;
      nextRecommendedAction: string | null;
    };
    measuredUsage: {
      available: boolean;
      totalTokens: number;
      note: string;
    };
    tokenAnalytics: {
      selectedTokens: number;
      fullRepoTokens: number;
      savingsPercent: number;
      estimateNote: string | null;
    };
    feedback: {
      adaptationLevel: "limited" | "active";
      totalRuns: number;
      successRate: number;
      note: string;
    };
    skills: {
      activeSkills: Array<{
        name: string;
        description: string;
        executionTemplate: string[];
      }>;
    };
    executionTrace: {
      whyThisHappened: string;
    };
    executionPlan: {
      state: string;
      currentStepIndex: number;
      risk: string;
      confidence: string | null;
      lastError: {
        errorType: string;
        reason: string;
        fixCommand: string;
        retryCommand: string;
      } | null;
      steps: Array<{
        id: string;
      }>;
      nextCommands: string[];
      summary: string;
    };
  };
}

export type ThemeMode = "dark" | "light";
export type UiMode = "execution" | "inspection";
export type UiCommandName =
  | "init"
  | "guide"
  | "next"
  | "validate"
  | "sync"
  | "retry"
  | "resume"
  | "status"
  | "trace"
  | "run-auto"
  | "checkpoint"
  | "handoff";
export type CommandComposerMode = "run-auto" | "checkpoint" | "handoff" | null;
export type ContextOverrideMode = "include" | "exclude" | "ignore";

export interface CliCommandResultPayload {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  jsonPayload?: unknown;
  commandLabel: string;
}

export interface CommandState {
  activeCommand: UiCommandName | null;
  loading: boolean;
  composer: CommandComposerMode;
  draftValue: string;
  lastResult: CliCommandResultPayload | null;
  lastError: string | null;
}

export type FocusedItem =
  | { kind: "path"; id: string; label: string; path: string }
  | { kind: "step"; id: string; label: string };

export interface InteractiveGraphNode {
  path: string;
  label: string;
  kind: "root" | "directory" | "file";
  status: "selected" | "candidate" | "excluded";
  x: number;
  y: number;
  radius: number;
  tone: string;
  importance: "low" | "medium" | "high";
  highlighted: boolean;
}

export interface InteractiveGraphEdge {
  fromPath: string;
  toPath: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  highlighted: boolean;
}

export interface InteractiveGraphModel {
  nodes: InteractiveGraphNode[];
  edges: InteractiveGraphEdge[];
  summary: Array<{ label: string; kind: string; meta: string; path: string }>;
}

export interface DisplayExecutionPlanStep {
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
  displayTitle: string;
  displayNote: string | null;
  skipped: boolean;
}

export interface RenderHelperSet {
  escapeHtml(value: string): string;
  escapeAttribute(value: string): string;
  iconSvg(name: string): string;
  iconLabel(icon: string, label: string): string;
  formatCliCommand(command: string | null | undefined, targetRoot?: string | null): string;
  renderHeaderBadge(
    label: string,
    tone: RepoControlMode | "critical" | "high" | "normal" | "low" | "neutral" | "success" | "warn" | "medium"
  ): string;
  renderHeaderMeta(label: string, value: string): string;
  renderPanelHeader(title: string, description: string): string;
  renderInlineBadge(value: string): string;
  renderNoteRow(title: string, metric: string, note: string): string;
  renderEmptyState(message: string): string;
  renderStatCard(label: string, value: string, meta: string, tone: "neutral" | "success" | "warn" | "critical"): string;
  renderInfoRow(label: string, value: string, tone?: "default" | "warn"): string;
  renderListBadges(values: string[]): string;
  renderExplainabilityBadge(label: string, active: boolean): string;
  renderGateRow(label: string, value: string, tone: "default" | "success" | "warn"): string;
  renderBulletRow(copy: string): string;
  deriveSignalImpact(signal: string): string;
  formatInteger(value: number): string;
  formatPercent(value: number | null): string;
  formatCurrency(value: number | null): string;
  formatTimestamp(value: string): string;
  formatTokensShort(value: number): string;
}

export interface TopBarRenderContext {
  state: RepoControlState;
  decision: DecisionSummary;
  repoLabel: string;
  phase: string;
  validationState: string;
  themeLabel: string;
  activeTheme: ThemeMode;
  activeMode: UiMode;
  isLogDrawerOpen: boolean;
  isInspectorOpen: boolean;
  currentTargetRoot: string;
  commandState: CommandState;
  currentTask: string;
  retryEnabled: boolean;
  composerConstraint: {
    blocked: boolean;
    reason: string;
    nextCommand: string | null;
  } | null;
  runtimeInfo: {
    label: string;
    detail: string;
  } | null;
  loadStatus: DesktopReadinessState;
  helpers: RenderHelperSet;
}

export interface GraphPanelRenderContext {
  state: RepoControlState;
  graph: InteractiveGraphModel;
  focusedNode: InteractiveGraphNode | null;
  graphDepth: number;
  graphPan: { x: number; y: number };
  graphZoom: number;
  graphMechanics: Array<{ title: string; metric: string; note: string }>;
  treeMechanics: Array<{ title: string; metric: string; note: string }>;
  helpers: RenderHelperSet;
}

export interface MachinePanelRenderContext {
  state: RepoControlState;
  activeMode: UiMode;
  helpers: Pick<
    RenderHelperSet,
    | "escapeHtml"
    | "escapeAttribute"
    | "iconSvg"
    | "iconLabel"
    | "renderHeaderBadge"
    | "renderPanelHeader"
    | "renderInlineBadge"
    | "renderNoteRow"
    | "renderEmptyState"
    | "renderStatCard"
    | "renderInfoRow"
    | "formatInteger"
    | "formatPercent"
    | "formatCurrency"
    | "formatTimestamp"
  >;
}

export interface ContextTreePanelRenderContext {
  tree: KiwiControlContextTree;
  focusedItem: FocusedItem | null;
  contextOverrides: Map<string, ContextOverrideMode>;
  helpers: Pick<RenderHelperSet, "escapeHtml" | "escapeAttribute" | "renderEmptyState">;
}

export interface ExecutionPlanPanelRenderContext {
  state: RepoControlState;
  steps: DisplayExecutionPlanStep[];
  editingPlanStepId: string | null;
  editingPlanDraft: string;
  focusedItem: FocusedItem | null;
  commandState: CommandState;
  failureGuidance: RecoveryGuidance | null;
  helpers: Pick<
    RenderHelperSet,
    "escapeHtml" | "escapeAttribute" | "formatCliCommand" | "renderPanelHeader" | "renderInlineBadge" | "renderNoteRow" | "renderEmptyState" | "renderHeaderBadge"
  >;
}

export interface InspectorRenderContext {
  state: RepoControlState;
  primaryAction: { action: string; command: string | null; reason: string } | null;
  activeSpecialist: RepoControlState["specialists"]["activeProfile"];
  topCapability: RepoControlState["mcpPacks"]["compatibleCapabilities"][number] | null;
  signalItems: string[];
  focusedStep: DisplayExecutionPlanStep | null;
  focusedNode: KiwiControlContextTreeNode | null;
  focusedItem: FocusedItem | null;
  focusedLabel: string;
  focusedReason: string;
  marker: string;
  activeMode: UiMode;
  commandState: CommandState;
  helpers: Pick<
    RenderHelperSet,
    | "escapeHtml"
    | "renderInlineBadge"
    | "renderExplainabilityBadge"
    | "renderGateRow"
    | "renderBulletRow"
    | "renderNoteRow"
    | "deriveSignalImpact"
  > & {
    renderGateRow(label: string, value: string, tone: "default" | "success" | "warn"): string;
    renderBulletRow(copy: string): string;
  };
}

export interface InspectorRenderHelpers extends RenderHelperSet {
  renderGateRow(label: string, value: string, tone: "default" | "success" | "warn"): string;
  renderBulletRow(copy: string): string;
}
