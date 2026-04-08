import type { CommandComposerMode, RecoveryGuidance, RepoControlMode } from "./contracts.js";

type LoadStateSource = "fresh" | "warm-snapshot" | "stale-snapshot" | "bridge-fallback";

type RepoGuidanceState = {
  targetRoot: string;
  loadState: {
    source: LoadStateSource;
  };
  repoState: {
    mode: RepoControlMode;
    detail: string;
  };
  validation: {
    errors: number;
  };
  executionState: {
    lifecycle: "idle" | "packet-created" | "queued" | "running" | "blocked" | "failed" | "completed";
    reason: string | null;
    nextCommand: string | null;
  };
  readiness: {
    label: string;
    detail: string;
    nextCommand: string | null;
  };
  kiwiControl?: {
    executionPlan?: {
      blocked?: boolean;
      lastError?: {
        reason: string;
        fixCommand: string;
        retryCommand: string;
      } | null;
      nextCommands?: string[];
    };
  };
};

export function deriveRepoRecoveryGuidance(
  state: RepoGuidanceState,
  env: { lastRepoLoadFailure: string | null }
): RecoveryGuidance | null {
  if (env.lastRepoLoadFailure && isSnapshotLoadSource(state.loadState.source)) {
    return {
      tone: "degraded",
      title: state.loadState.source === "stale-snapshot" ? "Using older snapshot" : "Using cached snapshot",
      detail: `Kiwi kept the last usable snapshot because fresh repo-local state failed to load. It is safe for inspection, but not trusted for workflow execution: ${env.lastRepoLoadFailure}`,
      nextCommand: null,
      actionLabel: "Reload state"
    };
  }

  if (state.repoState.mode === "bridge-unavailable" || state.loadState.source === "bridge-fallback") {
    return {
      tone: "failed",
      title: "Desktop bridge unavailable",
      detail: env.lastRepoLoadFailure ?? "Kiwi could not load repo-local state into the desktop shell.",
      nextCommand: null,
      actionLabel: "Reload state"
    };
  }

  if (state.repoState.mode === "repo-not-initialized") {
    return {
      tone: "blocked",
      title: "Repo not initialized",
      detail: "Kiwi opened the repo, but the repo-local continuity files are not set up yet.",
      nextCommand: "kc init"
    };
  }

  if (state.repoState.mode === "initialized-invalid" || state.validation.errors > 0 || Boolean(state.kiwiControl?.executionPlan?.blocked)) {
    return {
      tone: "blocked",
      title: state.readiness.label,
      detail: state.readiness.detail,
      nextCommand: selectRecoveryCommand(state)
    };
  }

  if (state.executionState.lifecycle === "blocked" || state.executionState.lifecycle === "failed") {
    return {
      tone: state.executionState.lifecycle === "failed" ? "failed" : "blocked",
      title: state.readiness.label,
      detail: state.readiness.detail,
      nextCommand: selectRecoveryCommand(state)
    };
  }

  return null;
}

export function buildBlockedActionGuidance(
  mode: Exclude<CommandComposerMode, null>,
  reason: string,
  nextCommand: string | null
): RecoveryGuidance {
  if (mode === "checkpoint") {
    return {
      tone: "blocked",
      title: "Checkpoint unavailable",
      detail: reason,
      nextCommand
    };
  }

  if (mode === "handoff") {
    return {
      tone: "blocked",
      title: "Handoff unavailable",
      detail: reason,
      nextCommand
    };
  }

  return {
    tone: "blocked",
    title: "Run Auto needs a real goal",
    detail: reason,
    nextCommand
  };
}

export function deriveExecutionPlanFailureGuidance(
  lastError: {
    reason: string;
    fixCommand: string;
    retryCommand: string;
  } | null | undefined
): RecoveryGuidance | null {
  if (!lastError) {
    return null;
  }

  return {
    tone: "blocked",
    title: "Why it stopped",
    detail: lastError.reason,
    nextCommand: lastError.fixCommand,
    followUpCommand: lastError.retryCommand
  };
}

export function buildBootRecoveryGuidance(detail: string): {
  title: string;
  intro: string;
  steps: string[];
  detail: string;
} {
  return {
    title: "Kiwi Control failed to start",
    intro: "The renderer hit an error before it could mount the UI.",
    steps: [
      "Relaunch Kiwi Control once to confirm the failure is repeatable.",
      "Run `kc ui` from Terminal to check whether the desktop bridge starts cleanly there.",
      "If it still fails, capture the error details below before reporting it."
    ],
    detail
  };
}

function selectRecoveryCommand(state: RepoGuidanceState): string {
  return state.executionState.nextCommand
    ?? state.readiness.nextCommand
    ?? state.kiwiControl?.executionPlan?.lastError?.fixCommand
    ?? state.kiwiControl?.executionPlan?.lastError?.retryCommand
    ?? state.kiwiControl?.executionPlan?.nextCommands?.[0]
    ?? `kiwi-control validate --target "${state.targetRoot}"`
}

function isSnapshotLoadSource(source: LoadStateSource): boolean {
  return source === "warm-snapshot" || source === "stale-snapshot";
}
