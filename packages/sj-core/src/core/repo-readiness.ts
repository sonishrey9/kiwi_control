import { PRODUCT_METADATA } from "./product.js";
import type { ExecutionLifecycle, ExecutionStateRecord } from "./execution-state.js";

export interface RepoReadiness {
  label: string;
  tone: "ready" | "blocked" | "failed";
  detail: string;
  nextCommand: string | null;
}

export function deriveRepoReadiness(input: {
  repoState: {
    mode: "bridge-unavailable" | "repo-not-initialized" | "initialized-invalid" | "initialized-with-warnings" | "healthy";
    title: string;
    detail: string;
  };
  validation: {
    errors: number;
    warnings: number;
  };
  executionState: ExecutionStateRecord;
}): RepoReadiness {
  if (input.repoState.mode === "bridge-unavailable") {
    return {
      label: "Desktop bridge unavailable",
      tone: "failed",
      detail: input.repoState.detail,
      nextCommand: `${PRODUCT_METADATA.cli.primaryCommand} ui`
    };
  }

  if (input.repoState.mode === "repo-not-initialized") {
    return {
      label: "Repo not initialized",
      tone: "blocked",
      detail: input.repoState.detail,
      nextCommand: `${PRODUCT_METADATA.cli.primaryCommand} init`
    };
  }

  if (input.repoState.mode === "initialized-invalid" || input.validation.errors > 0) {
    return {
      label: "Repo contract blocked",
      tone: "blocked",
      detail: input.executionState.reason ?? input.repoState.detail,
      nextCommand: input.executionState.nextCommand ?? `${PRODUCT_METADATA.cli.primaryCommand} doctor`
    };
  }

  if (input.executionState.lifecycle === "blocked") {
    return {
      label: "Workflow blocked",
      tone: "blocked",
      detail: input.executionState.reason ?? "Kiwi recorded a blocking execution issue.",
      nextCommand: input.executionState.nextCommand ?? `${PRODUCT_METADATA.cli.primaryCommand} doctor`
    };
  }

  if (input.executionState.lifecycle === "failed") {
    return {
      label: "Workflow failed",
      tone: "failed",
      detail: input.executionState.reason ?? "Kiwi recorded a failed execution state.",
      nextCommand: input.executionState.nextCommand ?? `${PRODUCT_METADATA.cli.primaryCommand} trace`
    };
  }

  const label = lifecycleLabel(input.executionState.lifecycle, input.validation.warnings);
  const detail = input.executionState.reason
    ?? (input.validation.warnings > 0
      ? input.repoState.detail
      : input.executionState.lifecycle === "idle"
        ? "Repo-local state is loaded and no active execution is in flight."
        : input.repoState.detail);

  return {
    label,
    tone: "ready",
    detail,
    nextCommand: input.executionState.nextCommand
  };
}

export function lifecycleLabel(lifecycle: ExecutionLifecycle, warningCount = 0): string {
  switch (lifecycle) {
    case "packet-created":
      return "Packet created";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "idle":
      return warningCount > 0 ? "Ready with warnings" : "Ready";
    case "blocked":
      return "Workflow blocked";
    case "failed":
      return "Workflow failed";
    default:
      return "Ready";
  }
}
