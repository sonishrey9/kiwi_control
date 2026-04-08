import type {
  RuntimeDecision,
  RuntimeDecisionAction,
  RuntimeDecisionRecovery,
  RuntimeSnapshot
} from "../runtime/client.js";

export type RuntimeDecisionStepId = RuntimeDecision["currentStepId"];

export function buildRuntimeDecision(params: {
  currentStepId: RuntimeDecisionStepId;
  currentStepStatus?: RuntimeDecision["currentStepStatus"];
  nextCommand?: string | null;
  readinessLabel: RuntimeDecision["readinessLabel"];
  readinessTone: RuntimeDecision["readinessTone"];
  readinessDetail: string;
  nextAction?: RuntimeDecisionAction | null;
  recovery?: RuntimeDecisionRecovery | null;
  decisionSource: string;
  updatedAt?: string;
}): RuntimeDecision {
  return {
    currentStepId: params.currentStepId,
    currentStepLabel: runtimeDecisionStepLabel(params.currentStepId),
    currentStepStatus: params.currentStepStatus ?? "pending",
    nextCommand: params.nextCommand ?? null,
    readinessLabel: params.readinessLabel,
    readinessTone: params.readinessTone,
    readinessDetail: params.readinessDetail,
    nextAction: params.nextAction ?? null,
    recovery: params.recovery ?? null,
    decisionSource: params.decisionSource,
    updatedAt: params.updatedAt ?? new Date().toISOString()
  };
}

export function buildRuntimeDecisionAction(
  action: string,
  command: string | null,
  reason: string,
  priority: RuntimeDecisionAction["priority"] = "normal"
): RuntimeDecisionAction {
  return {
    action,
    command,
    reason,
    priority
  };
}

export function buildRuntimeDecisionRecovery(
  kind: RuntimeDecisionRecovery["kind"],
  reason: string,
  fixCommand: string | null,
  retryCommand: string | null
): RuntimeDecisionRecovery {
  return {
    kind,
    reason,
    fixCommand,
    retryCommand
  };
}

export function runtimeDecisionStepLabel(stepId: RuntimeDecisionStepId): string {
  switch (stepId) {
    case "prepare":
      return "Prepare bounded context";
    case "generate_packets":
      return "Generate run packets";
    case "execute_packet":
      return "Execute packet";
    case "validate":
      return "Validate outcome";
    case "checkpoint":
      return "Checkpoint progress";
    case "handoff":
      return "Handoff work";
    case "idle":
    default:
      return "Idle";
  }
}

export function runtimeDecisionStepIdFromExecutionPlanStep(
  stepId: string | null | undefined
): RuntimeDecisionStepId {
  switch (stepId) {
    case "prepare":
    case "expand-context":
      return "prepare";
    case "execute":
      return "execute_packet";
    case "validate":
      return "validate";
    case "checkpoint":
      return "checkpoint";
    case "handoff":
      return "handoff";
    default:
      return "generate_packets";
  }
}

export function runtimeDecisionFromSnapshot(snapshot: Pick<
  RuntimeSnapshot,
  "decision" | "lifecycle" | "reason" | "nextCommand" | "sourceCommand"
>): RuntimeDecision {
  if (snapshot.decision) {
    return {
      ...snapshot.decision,
      updatedAt: snapshot.decision.updatedAt ?? new Date().toISOString()
    };
  }

  const readinessLabel = snapshot.lifecycle === "blocked"
    ? "Workflow blocked"
    : snapshot.lifecycle === "failed"
      ? "Workflow failed"
      : snapshot.lifecycle === "packet_created"
        ? "Packet created"
        : snapshot.lifecycle === "queued"
          ? "Queued"
          : snapshot.lifecycle === "running"
            ? "Running"
            : snapshot.lifecycle === "completed"
              ? "Completed"
              : "Ready";
  const readinessTone = snapshot.lifecycle === "blocked"
    ? "blocked"
    : snapshot.lifecycle === "failed"
      ? "failed"
      : "ready";
  const readinessDetail = snapshot.reason
    ?? (snapshot.lifecycle === "packet_created"
      ? "Prepared scope is ready."
      : snapshot.lifecycle === "queued"
        ? "Execution is queued."
        : snapshot.lifecycle === "running"
          ? "Execution is running."
          : snapshot.lifecycle === "completed"
            ? "Execution completed."
            : "Repo-local state is loaded and no active execution is in flight.");
  const currentStepId = snapshot.lifecycle === "packet_created"
    ? "generate_packets"
    : snapshot.lifecycle === "queued"
      ? "execute_packet"
      : snapshot.lifecycle === "completed"
        ? "checkpoint"
        : snapshot.lifecycle === "idle"
          ? "idle"
          : "validate";

  return buildRuntimeDecision({
    currentStepId,
    currentStepStatus: snapshot.lifecycle === "running"
      ? "running"
      : snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
        ? "failed"
        : snapshot.lifecycle === "completed"
          ? "success"
          : "pending",
    nextCommand: snapshot.nextCommand,
    readinessLabel,
    readinessTone,
    readinessDetail,
    nextAction: snapshot.nextCommand
      ? buildRuntimeDecisionAction(
          snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
            ? "Fix the blocking execution issue"
            : currentStepId === "generate_packets"
              ? "Generate run packets"
              : currentStepId === "execute_packet"
                ? "Open latest task packet and execute it"
                : currentStepId === "checkpoint"
                  ? "Checkpoint progress"
                  : "Continue",
          currentStepId === "execute_packet" ? null : snapshot.nextCommand,
          readinessDetail,
          snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? "critical" : "high"
        )
      : null,
    recovery: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
      ? buildRuntimeDecisionRecovery(
          snapshot.lifecycle === "failed" ? "failed" : "blocked",
          readinessDetail,
          snapshot.nextCommand,
          snapshot.sourceCommand
        )
      : null,
    decisionSource: "runtime-snapshot-fallback"
  });
}
