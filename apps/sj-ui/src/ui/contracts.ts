export type RepoControlMode =
  | "bridge-unavailable"
  | "repo-not-initialized"
  | "initialized-invalid"
  | "initialized-with-warnings"
  | "healthy";

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
  | "guide"
  | "next"
  | "validate"
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
  decision: {
    nextAction: string;
    blockingIssue: string;
    systemHealth: string;
    executionSafety: string;
    lastChangedAt: string;
    recentFailures: number;
    newWarnings: number;
  };
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
  loadStatus: {
    visible: boolean;
    label: string;
    detail: string;
    progress: number;
    tone: "loading" | "running" | "ready" | "warm" | "degraded";
  };
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
  helpers: Pick<
    RenderHelperSet,
    "escapeHtml" | "escapeAttribute" | "renderPanelHeader" | "renderInlineBadge" | "renderNoteRow" | "renderEmptyState" | "renderHeaderBadge"
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
