import type {
  CommandState,
  DecisionSummary,
  DisplayExecutionPlanStep,
  ExecutionPlanPanelRenderContext,
  FocusedItem,
  InspectorRenderContext,
  MachineHeroSummary,
  RecoveryGuidance,
  UiMode
} from "./contracts.js";

type DecisionSummaryState = {
  validation: { errors: number; warnings: number };
  machineAdvisory: { systemHealth: { criticalCount: number; warningCount: number } };
  repoState: { title: string };
  kiwiControl?: {
    nextActions: { actions: Array<{ action: string }> };
    executionPlan: { lastError: { reason: string } | null };
    execution: { recentExecutions: Array<{ success: boolean; timestamp: string }> };
    workflow: { steps: Array<{ status: "pending" | "running" | "success" | "failed" }> };
    contextView: { confidence: string | null };
    indexing: { partialScan: boolean };
    runtimeLifecycle: { recentEvents: Array<{ timestamp: string }> };
    feedback: { recentEntries: Array<{ timestamp: string }> };
  };
};

type MachineHeroState = {
  systemHealth: { criticalCount: number; warningCount: number };
  optimizationScore: {
    planning: { score: number; missingSignals: string[] };
    execution: { score: number; missingSignals: string[] };
    assistant: { score: number; missingSignals: string[] };
  };
  guidance: Array<{ priority: "critical" | "recommended" | "optional"; message: string; fixCommand?: string; hintCommand?: string }>;
};

export function buildDecisionSummary(
  state: DecisionSummaryState,
  options: {
    isLoadingRepoState: boolean;
    isRefreshingFreshRepoState: boolean;
    hasWarmSnapshot: boolean;
    formatTimestamp: (value: string) => string;
  }
): DecisionSummary {
  const kc = state.kiwiControl;
  const nextAction = kc?.nextActions.actions[0]?.action ?? state.repoState.title;
  const blockingIssue =
    kc?.executionPlan.lastError?.reason ??
    (state.validation.errors > 0 ? `${state.validation.errors} validation error${state.validation.errors === 1 ? "" : "s"}` : "none");
  const recentFailures =
    (kc?.execution.recentExecutions.filter((entry) => !entry.success).length ?? 0) +
    (kc?.workflow.steps.filter((step) => step.status === "failed").length ?? 0);
  const newWarnings = state.validation.warnings + state.machineAdvisory.systemHealth.warningCount;
  const systemHealth =
    state.validation.errors > 0 || state.machineAdvisory.systemHealth.criticalCount > 0
      ? "blocked"
      : newWarnings > 0
        ? "attention"
        : "healthy";
  const executionSafety =
    options.isLoadingRepoState
      ? "loading"
      : options.isRefreshingFreshRepoState || options.hasWarmSnapshot
        ? "guarded"
        : systemHealth === "blocked"
          ? "blocked"
          : kc?.contextView.confidence === "low" || kc?.indexing.partialScan
            ? "guarded"
            : "ready";

  const timestamps = [
    kc?.execution.recentExecutions[0]?.timestamp,
    kc?.runtimeLifecycle.recentEvents[0]?.timestamp,
    kc?.feedback.recentEntries[0]?.timestamp
  ].filter((value): value is string => Boolean(value));

  const lastChangedAt = timestamps.length > 0
    ? options.formatTimestamp(
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

export function buildMachineHeroSummary(machine: MachineHeroState): MachineHeroSummary {
  const scoreEntries = [
    { label: "Planning", score: machine.optimizationScore.planning.score, missingSignals: machine.optimizationScore.planning.missingSignals },
    { label: "Execution", score: machine.optimizationScore.execution.score, missingSignals: machine.optimizationScore.execution.missingSignals },
    { label: "Assistant", score: machine.optimizationScore.assistant.score, missingSignals: machine.optimizationScore.assistant.missingSignals }
  ];
  const bestScore = [...scoreEntries].sort((left, right) => right.score - left.score)[0]!;
  const weakestScore = [...scoreEntries].sort((left, right) => left.score - right.score)[0]!;
  const strongestGap = machine.guidance.find((entry) => entry.priority === "critical")
    ?? machine.guidance.find((entry) => entry.priority === "recommended")
    ?? null;
  const nextFix = strongestGap?.fixCommand ?? strongestGap?.hintCommand ?? "Run kiwi-control usage";
  const strongestGapDetail = strongestGap?.message
    ?? weakestScore.missingSignals[0]
    ?? "No major machine gaps detected.";
  const overallStatus = machine.systemHealth.criticalCount === 0
    && machine.optimizationScore.planning.score >= 70
    && machine.optimizationScore.execution.score >= 70
      ? "ready"
      : "needs work";

  return {
    overallStatus,
    overallTone: overallStatus === "ready" ? "success" : "warn",
    title: overallStatus === "ready" ? "Setup looks ready" : "Setup needs work",
    detail: overallStatus === "ready"
      ? "Heuristic completeness looks strong across the primary runtimes."
      : "Heuristic completeness still shows at least one meaningful machine gap.",
    bestHeuristicLabel: `${bestScore.label} heuristic`,
    bestHeuristicValue: `${bestScore.score}%`,
    strongestGapLabel: strongestGap ? "Strongest gap" : `${weakestScore.label} gap`,
    strongestGapDetail,
    nextFixLabel: "Next recommended fix",
    nextFixCommand: nextFix
  };
}

export function buildInspectorContextModel(
  params: {
    state: InspectorRenderContext["state"];
    activeMode: UiMode;
    commandState: CommandState;
    focusedItem: FocusedItem | null;
    marker: string;
    resolveFocusedStep: (focusedItem: FocusedItem | null) => DisplayExecutionPlanStep | null;
    resolveFocusedNode: (focusedItem: FocusedItem | null) => InspectorRenderContext["focusedNode"];
  }
): Omit<InspectorRenderContext, "helpers"> {
  const kc = params.state.kiwiControl!;
  const primaryAction = kc.nextActions.actions[0] ?? null;
  const activeSpecialist = params.state.specialists.activeProfile;
  const topCapability = params.state.mcpPacks.compatibleCapabilities[0] ?? null;
  const signalItems = kc.decisionLogic.inputSignals.slice(0, params.activeMode === "execution" ? 3 : 5);
  const focusedStep = params.resolveFocusedStep(params.focusedItem);
  const focusedNode = params.resolveFocusedNode(params.focusedItem);
  const focusedLabel = focusedStep?.displayTitle ?? focusedNode?.name ?? primaryAction?.action ?? "No blocking action";
  const focusedReason = focusedStep?.displayNote
    ?? focusedNode?.path
    ?? primaryAction?.reason
    ?? kc.nextActions.summary
    ?? params.state.repoState.detail;

  return {
    state: params.state,
    primaryAction,
    activeSpecialist,
    topCapability,
    signalItems,
    focusedStep,
    focusedNode,
    focusedItem: params.focusedItem,
    focusedLabel,
    focusedReason,
    marker: params.marker,
    activeMode: params.activeMode,
    commandState: params.commandState
  };
}

export function buildExecutionPlanPanelContextModel(
  params: Omit<ExecutionPlanPanelRenderContext, "helpers">
): Omit<ExecutionPlanPanelRenderContext, "helpers"> {
  return params;
}
