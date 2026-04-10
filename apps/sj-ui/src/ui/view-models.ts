import type {
  ActionClusterState,
  CommandState,
  DecisionSummary,
  DesktopReadinessState,
  DisplayExecutionPlanStep,
  ExecutionPlanPanelRenderContext,
  FocusedItem,
  InspectorRenderContext,
  MachineHeroSummary,
  OverviewHeroState,
  PackPanelState,
  PrimaryBannerState,
  TopMetadataGroups,
  UiMode
} from "./contracts.js";

type DecisionSummaryState = {
  validation: { errors: number; warnings: number };
  machineAdvisory: { systemHealth: { criticalCount: number; warningCount: number } };
  repoState: { title: string };
  runtimeDecision?: { recovery: { reason: string } | null };
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
  stale: boolean;
  systemHealth: { criticalCount: number; warningCount: number };
  setupSummary: {
    installedTools: { readyCount: number; totalCount: number };
    healthyConfigs: { readyCount: number; totalCount: number };
    readyRuntimes: { planning: boolean; execution: boolean; assistant: boolean };
  };
  optimizationScore: {
    planning: { score: number; missingSignals: string[] };
    execution: { score: number; missingSignals: string[] };
    assistant: { score: number; missingSignals: string[] };
  };
  guidance: Array<{ priority: "critical" | "recommended" | "optional"; message: string; fixCommand?: string; hintCommand?: string }>;
};

type OverviewHeroInput = {
  repoTitle: string;
  repoDetail: string;
  nextActionSummary: string;
  primaryAction: {
    action: string;
    reason: string;
    priority?: "critical" | "high" | "normal" | "low" | "neutral";
  } | null;
};

type TopMetadataGroupsInput = {
  projectType: string;
  executionMode: string;
  validationState: string;
  decision: DecisionSummary;
};

type PackCatalogEntry = {
  id: string;
  name?: string;
  description: string;
  executable: boolean;
  unavailablePackReason: string | null;
  allowedCapabilityIds: string[];
  preferredCapabilityIds: string[];
  guidance?: string[];
};

type PackPanelInput = {
  selectedPack: {
    id: string;
    name?: string;
    description: string;
    guidance?: string[];
  };
  selectedPackSource: string;
  explicitSelection: string | null;
  available: PackCatalogEntry[];
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
    state.runtimeDecision?.recovery?.reason ??
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

export function buildPrimaryBannerState(params: {
  loadStatus: DesktopReadinessState;
  activeView: string;
}): PrimaryBannerState {
  if (!params.loadStatus.visible) {
    return {
      visible: false,
      phaseLabel: "",
      label: "",
      detail: "",
      tone: "ready",
      progress: 100,
      nextCommand: null
    };
  }

  let detail = params.loadStatus.detail;
  if (params.loadStatus.tone === "blocked") {
    detail = params.activeView === "overview"
      ? "Use the primary recovery action below."
      : "Use the repo-scoped recovery command for this repo.";
  } else if (params.loadStatus.tone === "degraded") {
    detail = "Using cached or degraded repo state. Use the repair command if this does not recover on its own.";
  }

  return {
    visible: true,
    phaseLabel: params.loadStatus.phase.replaceAll("_", " "),
    label: params.loadStatus.label,
    detail,
    tone: params.loadStatus.tone,
    progress: params.loadStatus.progress,
    nextCommand: params.loadStatus.nextCommand
  };
}

export function buildOverviewHeroState(params: {
  state: OverviewHeroInput;
  currentFocus: string;
  primaryActionCommand: string | null;
}): OverviewHeroState {
  const primaryAction = params.state.primaryAction;
  return {
    title: primaryAction?.action ?? params.state.repoTitle,
    detail: primaryAction?.reason ?? params.state.nextActionSummary ?? params.state.repoDetail,
    badgeLabel: primaryAction?.priority ?? "neutral",
    badgeTone: primaryAction?.priority ?? "neutral",
    command: params.primaryActionCommand,
    supportingText: params.currentFocus
  };
}

export function buildTopMetadataGroups(params: {
  state: TopMetadataGroupsInput;
}): TopMetadataGroups {
  return {
    centerItems: [
      { label: "Next", value: params.state.decision.nextAction },
      { label: "Repo", value: params.state.projectType },
      { label: "Status", value: `${params.state.decision.systemHealth} · ${params.state.decision.executionSafety}` },
      { label: "Changed", value: params.state.decision.lastChangedAt }
    ],
    statusDetail: `${params.state.executionMode} · ${params.state.validationState}`
  };
}

export function isInspectorDefaultOpen(view: string, mode: UiMode): boolean {
  switch (view) {
    case "overview":
    case "context":
    case "graph":
    case "tokens":
    case "feedback":
    case "mcps":
    case "system":
    case "validation":
    case "machine":
      break;
    default:
      break;
  }
  return mode === "inspection";
}

export function buildPackPanelState(input: PackPanelInput): PackPanelState {
  const selectedPackLabel = input.selectedPackSource === "runtime-explicit"
    ? "Pinned for this repo"
    : "Default for this repo";
  const selectedPackSourceLabel = input.selectedPackSource === "runtime-explicit"
    ? "Runtime explicit"
    : "Heuristic default";
  const selectedEntry = input.available.find((pack) => pack.id === input.selectedPack.id) ?? null;

  const toCard = (
    pack: PackPanelInput["available"][number],
    overrides: Partial<PackPanelState["selectedPackCard"]> = {}
  ) => ({
    id: pack.id,
    name: pack.name ?? pack.id,
    description: pack.description,
    stateLabel: pack.executable ? "Executable" : "Blocked",
    stateTone: pack.executable ? "neutral" as const : "warn" as const,
    sourceLabel: null,
    blockedReason: pack.unavailablePackReason,
    allowedCapabilityIds: pack.allowedCapabilityIds,
    preferredCapabilityIds: pack.preferredCapabilityIds,
    guidance: (pack.guidance ?? []).slice(0, 2),
    ...overrides
  });

  return {
    selectedPackCard: {
      id: input.selectedPack.id,
      name: input.selectedPack.name ?? input.selectedPack.id,
      description: input.selectedPack.description,
      stateLabel: selectedPackLabel,
      stateTone: input.selectedPackSource === "runtime-explicit" ? "success" : "neutral",
      sourceLabel: selectedPackSourceLabel,
      blockedReason: selectedEntry?.unavailablePackReason ?? null,
      allowedCapabilityIds: selectedEntry?.allowedCapabilityIds ?? [],
      preferredCapabilityIds: selectedEntry?.preferredCapabilityIds ?? [],
      guidance: (input.selectedPack.guidance ?? []).slice(0, 2)
    },
    executablePackCards: input.available
      .filter((pack) => pack.executable && pack.id !== input.selectedPack.id)
      .map((pack) => toCard(pack)),
    blockedPackCards: input.available
      .filter((pack) => !pack.executable)
      .map((pack) => toCard(pack, { stateTone: "warn" })),
    showClearAction: input.explicitSelection !== null,
    selectedPackLabel,
    selectedPackSourceLabel
  };
}

function inferPrimaryActionCommand(commandText: string | null): ActionClusterState["primary"] | null {
  const raw = commandText?.trim() ?? "";
  if (!raw) {
    return null;
  }

  if (/\bguide\b/.test(raw)) {
    return { label: "Guide", command: "guide", directCommand: null, composerMode: null };
  }
  if (/\bnext\b/.test(raw)) {
    return { label: "Next", command: "next", directCommand: null, composerMode: null };
  }
  if (/\breview\b/.test(raw)) {
    return { label: "Review", command: "review", directCommand: null, composerMode: null };
  }
  if (/\bvalidate\b/.test(raw)) {
    return { label: "Validate", command: "validate", directCommand: null, composerMode: null };
  }
  if (/\bretry\b/.test(raw)) {
    return { label: "Retry", command: "retry", directCommand: null, composerMode: null };
  }
  if (/\brun\b.*\b--auto\b/.test(raw)) {
    return { label: "Run Auto", command: null, directCommand: null, composerMode: "run-auto" };
  }
  if (/\bcheckpoint\b/.test(raw)) {
    return { label: "Checkpoint", command: null, directCommand: null, composerMode: "checkpoint" };
  }
  if (/\bhandoff\b/.test(raw)) {
    return { label: "Handoff", command: null, directCommand: null, composerMode: "handoff" };
  }

  return {
    label: "Run next step",
    command: null,
    directCommand: raw,
    composerMode: null
  };
}

export function buildExecutionActionCluster(params: {
  nextActionLabel: string;
  nextCommand: string | null;
  retryEnabled: boolean;
  hasTask: boolean;
  handoffAvailable: boolean;
}): ActionClusterState {
  const inferredPrimary = inferPrimaryActionCommand(params.nextCommand);
  const primary = inferredPrimary ?? { label: params.nextActionLabel || "Guide", command: "guide", directCommand: null, composerMode: null };

  const allSecondary: ActionClusterState["secondary"] = [
    { label: "Guide", command: "guide", directCommand: null, composerMode: null },
    { label: "Next", command: "next", directCommand: null, composerMode: null },
    { label: "Review", command: "review", directCommand: null, composerMode: null },
    { label: "Validate", command: "validate", directCommand: null, composerMode: null },
    ...(params.retryEnabled ? [{ label: "Retry", command: "retry" as const, directCommand: null, composerMode: null }] : []),
    ...(params.hasTask ? [{ label: "Run Auto", command: null, directCommand: null, composerMode: "run-auto" as const }] : []),
    { label: "Checkpoint", command: null, directCommand: null, composerMode: "checkpoint" as const },
    ...(params.handoffAvailable ? [{ label: "Handoff", command: null, directCommand: null, composerMode: "handoff" as const }] : [])
  ];

  return {
    primary,
    secondary: allSecondary.filter((entry) =>
      entry.label !== primary.label
      || entry.command !== primary.command
      || entry.composerMode !== primary.composerMode
      || entry.directCommand !== primary.directCommand
    )
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
  const hasSetupGap =
    machine.setupSummary.installedTools.readyCount < machine.setupSummary.installedTools.totalCount
    || machine.setupSummary.healthyConfigs.readyCount < machine.setupSummary.healthyConfigs.totalCount
    || !machine.setupSummary.readyRuntimes.planning
    || !machine.setupSummary.readyRuntimes.execution
    || !machine.setupSummary.readyRuntimes.assistant;
  const weakHeuristic = weakestScore.score < 70;
  const overallStatus = machine.stale
    ? "stale"
    : machine.systemHealth.criticalCount > 0 || hasSetupGap || weakHeuristic || machine.systemHealth.warningCount > 0
      ? "partial"
      : "ready";

  return {
    overallStatus,
    overallTone: overallStatus === "ready" ? "success" : "warn",
    title: overallStatus === "ready"
      ? "Machine setup is ready"
      : overallStatus === "stale"
        ? "Machine advisory is stale"
        : "Machine setup needs attention",
    detail: overallStatus === "ready"
      ? "Fresh machine signals show the primary runtimes and configs in good shape."
      : overallStatus === "stale"
        ? "Refresh the machine advisory before trusting setup guidance or suggested fixes."
        : "At least one install, config, or runtime gap is still active for this machine.",
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
