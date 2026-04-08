import type {
  CommandState,
  DesktopReadinessState,
  RecoveryGuidance,
  RepoControlMode
} from "./contracts.js";

type LoadStateSource = "fresh" | "warm-snapshot" | "stale-snapshot" | "bridge-fallback";

type LoadStateLike = {
  source: LoadStateSource;
  detail: string;
};

type RepoControlReadinessState = {
  targetRoot: string;
  loadState: LoadStateLike;
  repoState: {
    mode: RepoControlMode;
    title: string;
    detail: string;
  };
  executionState: {
    revision: number;
    lifecycle: "idle" | "packet-created" | "queued" | "running" | "blocked" | "failed" | "completed";
    reason: string | null;
    nextCommand: string | null;
  };
  readiness: {
    label: string;
    tone: "ready" | "blocked" | "failed";
    detail: string;
    nextCommand: string | null;
  };
};

export interface ReadinessEnv {
  commandState: Pick<CommandState, "loading" | "activeCommand">;
  currentLoadSource: "cli" | "manual" | "auto" | null;
  currentTargetRoot: string;
  isLoadingRepoState: boolean;
  isRefreshingFreshRepoState: boolean;
  lastRepoLoadFailure: string | null;
  lastReadyStateSignal: { at: number; detail: string } | null;
  readyStatePulseMs: number;
  machineHydrationInFlight: boolean;
  machineHydrationDetail: string;
  activeTargetHint: string;
  recoveryGuidance: RecoveryGuidance | null;
  isMachineHeavyViewActive: boolean;
  machineAdvisoryStale: boolean;
}

export function buildLoadStatus(
  state: RepoControlReadinessState,
  env: ReadinessEnv
): DesktopReadinessState {
  if (env.commandState.loading) {
    return {
      phase: "refreshing",
      visible: true,
      label: "Running command",
      detail: env.commandState.activeCommand ? `Executing ${env.commandState.activeCommand}...` : "Executing command...",
      progress: 68,
      tone: "running",
      nextCommand: null
    };
  }

  if (env.isLoadingRepoState && state.loadState.source !== "warm-snapshot" && state.loadState.source !== "stale-snapshot") {
    return {
      phase: "opening",
      visible: true,
      label: env.currentLoadSource === "auto" ? "Refreshing repo" : "Opening repo",
      detail:
        env.currentLoadSource === "cli"
          ? "Desktop launched. Kiwi is loading repo-local state now."
          : env.currentLoadSource === "auto"
            ? "Refreshing repo-local state in the background."
            : "Building the repo-local control surface.",
      progress: env.currentLoadSource === "auto" ? 55 : 42,
      tone: "loading",
      nextCommand: null
    };
  }

  if (env.isRefreshingFreshRepoState && isSnapshotLoadSource(state.loadState.source)) {
    if (env.lastRepoLoadFailure) {
      return {
        phase: "degraded",
        visible: true,
        label: env.recoveryGuidance?.title ?? "Using cached snapshot",
        detail: env.recoveryGuidance?.detail ?? `Fresh repo-local state could not be loaded: ${env.lastRepoLoadFailure}`,
        progress: 74,
        tone: env.recoveryGuidance?.tone === "blocked" ? "blocked" : "degraded",
        nextCommand: env.recoveryGuidance?.nextCommand ?? null
      };
    }

    return {
      phase: "warm_loaded",
      visible: true,
      label: state.loadState.source === "stale-snapshot" ? "Older snapshot loaded" : "Warm state loaded",
      detail: state.loadState.detail,
      progress: state.loadState.source === "stale-snapshot" ? 58 : 64,
      tone: "warm",
      nextCommand: env.recoveryGuidance?.nextCommand ?? null
    };
  }

  if (env.recoveryGuidance && (env.recoveryGuidance.tone === "blocked" || env.recoveryGuidance.tone === "failed")) {
    return {
      phase: env.recoveryGuidance.tone === "failed" ? "failed" : "ready",
      visible: true,
      label: env.recoveryGuidance.title,
      detail: env.recoveryGuidance.detail,
      progress: env.recoveryGuidance.tone === "failed" ? 100 : 96,
      tone: env.recoveryGuidance.tone === "failed" ? "degraded" : "blocked",
      nextCommand: env.recoveryGuidance.nextCommand
    };
  }

  if (state.loadState.source === "bridge-fallback") {
    return {
      phase: "failed",
      visible: true,
      label: state.readiness.label,
      detail: env.lastRepoLoadFailure ?? state.readiness.detail,
      progress: 18,
      tone: state.readiness.tone === "failed" ? "degraded" : "blocked",
      nextCommand: state.readiness.nextCommand
    };
  }

  if (env.lastReadyStateSignal && Date.now() - env.lastReadyStateSignal.at < env.readyStatePulseMs) {
    return {
      phase: "ready",
      visible: true,
      label: state.readiness.label,
      detail: env.machineHydrationInFlight
        ? `${env.lastReadyStateSignal.detail} ${env.machineHydrationDetail}`
        : state.readiness.detail,
      progress: 100,
      tone: state.readiness.tone === "blocked" ? "blocked" : state.readiness.tone === "failed" ? "degraded" : "ready",
      nextCommand: state.readiness.nextCommand
    };
  }

  if (env.currentTargetRoot && env.machineHydrationInFlight) {
    return {
      phase: "refreshing",
      visible: true,
      label: state.readiness.label,
      detail: state.readiness.tone === "blocked"
        ? state.readiness.detail
        : `${state.readiness.detail} ${env.machineHydrationDetail}`,
      progress: 88,
      tone: state.readiness.tone === "blocked" ? "blocked" : state.readiness.tone === "failed" ? "degraded" : "ready",
      nextCommand: state.readiness.nextCommand
    };
  }

  if (env.currentTargetRoot && env.isMachineHeavyViewActive && env.machineAdvisoryStale) {
    return {
      phase: "warm_loaded",
      visible: true,
      label: "System data deferred",
      detail: "Kiwi keeps heavy machine diagnostics off the startup path and hydrates them when this view is active.",
      progress: 66,
      tone: "warm",
      nextCommand: null
    };
  }

  return {
    phase: env.currentTargetRoot ? "ready" : "opening",
    visible: false,
    label: "",
    detail: "",
    progress: 100,
    tone: "ready",
    nextCommand: env.recoveryGuidance?.nextCommand ?? null
  };
}

export function deriveReadinessSummary(
  state: RepoControlReadinessState,
  env: ReadinessEnv
): { label: string; detail: string } {
  const loadStatus = buildLoadStatus(state, env);
  if (loadStatus.visible) {
    return {
      label: loadStatus.label,
      detail: loadStatus.detail
    };
  }

  if (state.targetRoot) {
    return {
      label: state.readiness.label,
      detail: state.readiness.detail
    };
  }

  return {
    label: "opening",
    detail: "Run kc ui inside a repo to load it automatically."
  };
}

export function buildActiveTargetHint(state: RepoControlReadinessState): string {
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
      return "Confirm kiwi-control works in Terminal, then run kc ui again.";
  }
}

export function buildFinalReadyDetail(
  state: RepoControlReadinessState,
  currentTargetRoot: string
): string {
  if (state.readiness.detail) {
    return state.readiness.detail;
  }
  const repoLabel = getRepoLabel(state.targetRoot || currentTargetRoot);
  const prefix = `Fresh repo-local state is ready for ${repoLabel}.`;

  switch (state.repoState.mode) {
    case "healthy":
      return prefix;
    case "initialized-invalid":
      return `${prefix} The repo is loaded, but workflow execution is still blocked until the repo contract is repaired.`;
    case "repo-not-initialized":
      return `${prefix} This repo still needs kc init before the normal workflow can continue.`;
    case "initialized-with-warnings":
      return `${prefix} The repo is usable, but Kiwi still sees warning-level issues worth addressing.`;
    case "bridge-unavailable":
    default:
      return prefix;
  }
}

export function buildBridgeNote(
  state: RepoControlReadinessState,
  source: "cli" | "manual" | "auto" | "shell",
  env: ReadinessEnv
): string {
  if (!state.targetRoot) {
    return env.activeTargetHint;
  }
  if (state.repoState.mode === "bridge-unavailable") {
    return "Confirm kiwi-control works in Terminal, then run kc ui again.";
  }
  if (env.recoveryGuidance) {
    const suffix = env.recoveryGuidance.nextCommand ? ` Do this now: ${env.recoveryGuidance.nextCommand}.` : "";
    return `${env.recoveryGuidance.detail}${suffix} ${env.activeTargetHint}`;
  }
  if (state.readiness.detail) {
    const suffix = state.readiness.nextCommand ? ` Do this now: ${state.readiness.nextCommand}.` : "";
    return `${state.readiness.detail}${suffix} ${env.activeTargetHint}`;
  }
  if (env.lastReadyStateSignal && Date.now() - env.lastReadyStateSignal.at < env.readyStatePulseMs) {
    return env.machineHydrationInFlight
      ? `${env.lastReadyStateSignal.detail} ${env.machineHydrationDetail} ${env.activeTargetHint}`
      : `${env.lastReadyStateSignal.detail} ${env.activeTargetHint}`;
  }
  if (state.loadState.source === "stale-snapshot") {
    return `Showing ${getRepoLabel(state.targetRoot)} from an older snapshot while Kiwi refreshes current repo-local state. ${env.activeTargetHint}`;
  }
  if (state.loadState.source === "warm-snapshot") {
    return `Showing ${getRepoLabel(state.targetRoot)} from a recent warm snapshot while fresh repo-local state refreshes. ${env.activeTargetHint}`;
  }
  if (env.machineHydrationInFlight) {
    return `Fresh repo-local state is ready for ${getRepoLabel(state.targetRoot)}. ${env.machineHydrationDetail} ${env.activeTargetHint}`;
  }
  if (source === "cli") {
    return `Loaded ${getRepoLabel(state.targetRoot)} from kc ui. ${env.activeTargetHint}`;
  }
  if (source === "manual") {
    return `Loaded ${getRepoLabel(state.targetRoot)}. ${env.activeTargetHint}`;
  }
  if (source === "auto") {
    return `Refreshed ${getRepoLabel(state.targetRoot)}. ${env.activeTargetHint}`;
  }
  return env.activeTargetHint;
}

function isSnapshotLoadSource(source: LoadStateSource): boolean {
  return source === "warm-snapshot" || source === "stale-snapshot";
}

function getRepoLabel(targetRoot: string): string {
  const trimmed = targetRoot.trim();
  if (!trimmed) {
    return "repo";
  }
  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}
