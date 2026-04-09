import path from "node:path";
import { pathExists, readJson } from "../utils/fs.js";
import {
  getRuntimeSnapshot,
  persistRuntimeDerivedOutput,
  materializeRuntimeDerivedOutputs,
  openRuntimeTarget,
  transitionRuntimeExecutionState,
  type RuntimeDecision,
  type RuntimeSnapshot
} from "../runtime/client.js";

export type ExecutionLifecycle =
  | "idle"
  | "packet-created"
  | "queued"
  | "running"
  | "blocked"
  | "failed"
  | "completed";

export interface ExecutionArtifacts {
  [key: string]: string[];
}

export interface ExecutionStateEvent {
  revision: number;
  operationId: string | null;
  type: string;
  lifecycle: ExecutionLifecycle;
  task: string | null;
  sourceCommand: string | null;
  reason: string | null;
  nextCommand: string | null;
  blockedBy: string[];
  artifacts: ExecutionArtifacts;
  recordedAt: string;
}

export interface ExecutionStateRecord {
  artifactType: "kiwi-control/execution-state";
  version: 1;
  revision: number;
  operationId: string | null;
  task: string | null;
  sourceCommand: string | null;
  lifecycle: ExecutionLifecycle;
  reason: string | null;
  nextCommand: string | null;
  blockedBy: string[];
  lastUpdatedAt: string | null;
  artifacts: ExecutionArtifacts;
  lastEvent: ExecutionStateEvent | null;
}

export interface RecordExecutionStateOptions {
  type: string;
  lifecycle: ExecutionLifecycle;
  task?: string | null;
  sourceCommand?: string | null;
  reason?: string | null;
  nextCommand?: string | null;
  blockedBy?: string[];
  artifacts?: ExecutionArtifacts;
  operationId?: string | null;
  reuseOperation?: boolean;
  clearTask?: boolean;
  decision?: RuntimeDecision | null;
}

interface LegacyExecutionPlanRecord {
  task?: string | null;
  state?: string | null;
  summary?: string | null;
  nextCommands?: string[];
  lastError?: {
    reason?: string | null;
    fixCommand?: string | null;
  } | null;
  updatedAt?: string | null;
}

interface LegacyRuntimeLifecycleRecord {
  currentTask?: string | null;
  currentStage?: string | null;
  nextSuggestedCommand?: string | null;
  nextRecommendedAction?: string | null;
  timestamp?: string | null;
}

interface LegacyWorkflowRecord {
  task?: string | null;
  status?: string | null;
  currentStepId?: string | null;
  timestamp?: string | null;
}

const EXECUTION_STATE_VERSION = 1;

export function executionStatePath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "execution-state.json");
}

export function executionEventsPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "execution-events.ndjson");
}

export function emptyExecutionState(): ExecutionStateRecord {
  return {
    artifactType: "kiwi-control/execution-state",
    version: EXECUTION_STATE_VERSION,
    revision: 0,
    operationId: null,
    task: null,
    sourceCommand: null,
    lifecycle: "idle",
    reason: null,
    nextCommand: null,
    blockedBy: [],
    lastUpdatedAt: null,
    artifacts: {},
    lastEvent: null
  };
}

export async function loadExecutionState(
  targetRoot: string,
  options: { allowLegacyFallback?: boolean } = {}
): Promise<ExecutionStateRecord> {
  try {
    const snapshot = await openRuntimeTarget({ targetRoot });
    return runtimeSnapshotToExecutionState(snapshot);
  } catch {
    if (options.allowLegacyFallback === false) {
      return emptyExecutionState();
    }
  }

  return deriveLegacyExecutionState(targetRoot);
}

export async function recordExecutionState(
  targetRoot: string,
  options: RecordExecutionStateOptions
): Promise<ExecutionStateRecord> {
  const snapshot = await transitionRuntimeExecutionState({
    targetRoot,
    actor: "sj-core",
    ...(options.sourceCommand ? { triggerCommand: options.sourceCommand } : {}),
    eventType: options.type,
    lifecycle: toRuntimeLifecycle(options.lifecycle),
    ...(options.task !== undefined ? { task: options.task } : {}),
    ...(options.sourceCommand !== undefined ? { sourceCommand: options.sourceCommand } : {}),
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
    ...(options.nextCommand !== undefined ? { nextCommand: options.nextCommand } : {}),
    ...(options.blockedBy !== undefined ? { blockedBy: options.blockedBy } : {}),
    ...(options.artifacts !== undefined ? { artifacts: options.artifacts } : {}),
    ...(options.operationId !== undefined ? { operationId: options.operationId } : {}),
    ...(options.reuseOperation !== undefined ? { reuseOperation: options.reuseOperation } : {}),
    ...(options.clearTask !== undefined ? { clearTask: options.clearTask } : {}),
    ...(options.decision !== undefined ? { decision: options.decision } : {}),
    invalidateOutputs: [
      "execution-state",
      "execution-events",
      "repo-control-snapshot",
      "runtime-lifecycle",
      "workflow",
      "execution-plan",
      "decision-logic"
    ],
    materializeOutputs: ["execution-state", "execution-events"]
  });
  await persistBaselineDerivedOutputs(targetRoot, snapshot).catch(() => null);
  return runtimeSnapshotToExecutionState(snapshot);
}

export async function persistExecutionState(
  targetRoot: string,
  state: ExecutionStateRecord
): Promise<string> {
  await transitionRuntimeExecutionState({
    targetRoot,
    actor: "sj-core",
    ...(state.sourceCommand ? { triggerCommand: state.sourceCommand } : {}),
    eventType: state.lastEvent?.type ?? "compatibility-sync",
    lifecycle: toRuntimeLifecycle(state.lifecycle),
    ...(state.task !== undefined ? { task: state.task } : {}),
    ...(state.sourceCommand !== undefined ? { sourceCommand: state.sourceCommand } : {}),
    ...(state.reason !== undefined ? { reason: state.reason } : {}),
    ...(state.nextCommand !== undefined ? { nextCommand: state.nextCommand } : {}),
    ...(state.blockedBy !== undefined ? { blockedBy: state.blockedBy } : {}),
    ...(state.artifacts !== undefined ? { artifacts: state.artifacts } : {}),
    ...(state.operationId !== undefined ? { operationId: state.operationId } : {}),
    reuseOperation: state.operationId != null,
    clearTask: state.task == null,
    invalidateOutputs: ["execution-state", "execution-events"],
    materializeOutputs: ["execution-state", "execution-events"]
  });
  return executionStatePath(targetRoot);
}

export async function readExecutionStateRevision(targetRoot: string): Promise<number> {
  const state = await loadExecutionState(targetRoot, { allowLegacyFallback: false });
  return state.revision;
}

async function appendExecutionEvent(targetRoot: string, event: ExecutionStateEvent): Promise<void> {
  await materializeRuntimeDerivedOutputs({
    targetRoot,
    outputs: ["execution-events"]
  });
}

async function persistBaselineDerivedOutputs(
  targetRoot: string,
  snapshot: RuntimeSnapshot
): Promise<void> {
  const timestamp = snapshot.lastUpdatedAt ?? new Date().toISOString();
  const decision = snapshot.decision ?? buildFallbackDecision(snapshot);
  const runtimeLifecycle = buildRuntimeLifecycleArtifact(snapshot, decision, timestamp);
  const workflow = buildWorkflowArtifact(snapshot, decision, timestamp);
  const executionPlan = buildExecutionPlanArtifact(snapshot, decision, timestamp);
  const decisionLogic = buildDecisionLogicArtifact(snapshot, decision, timestamp);
  const runtimeLifecyclePath = path.join(targetRoot, ".agent", "state", "runtime-lifecycle.json");
  const workflowPath = path.join(targetRoot, ".agent", "state", "workflow.json");

  if (!(await pathExists(runtimeLifecyclePath))) {
    await persistRuntimeDerivedOutput({
      targetRoot,
      outputName: "runtime-lifecycle",
      payload: runtimeLifecycle,
      sourceRevision: snapshot.revision
    });
  }
  if (!(await pathExists(workflowPath))) {
    await persistRuntimeDerivedOutput({
      targetRoot,
      outputName: "workflow",
      payload: workflow,
      sourceRevision: snapshot.revision
    });
  }
  await persistRuntimeDerivedOutput({
    targetRoot,
    outputName: "execution-plan",
    payload: executionPlan,
    sourceRevision: snapshot.revision
  });
  await persistRuntimeDerivedOutput({
    targetRoot,
    outputName: "decision-logic",
    payload: decisionLogic,
    sourceRevision: snapshot.revision
  });
}

function buildFallbackDecision(snapshot: RuntimeSnapshot): RuntimeDecision {
  const detail = snapshot.reason ?? snapshot.nextCommand ?? "Runtime state changed.";
  return {
    currentStepId: snapshot.lifecycle === "packet_created"
      ? "generate_packets"
      : snapshot.lifecycle === "queued"
        ? "execute_packet"
        : snapshot.lifecycle === "running"
          ? "validate"
          : snapshot.lifecycle === "completed"
            ? "checkpoint"
            : "idle",
    currentStepLabel: "Runtime step",
    currentStepStatus: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? "failed" : "pending",
    nextCommand: snapshot.nextCommand,
    readinessLabel: snapshot.readiness.label,
    readinessTone: snapshot.readiness.tone === "blocked" || snapshot.readiness.tone === "failed"
      ? snapshot.readiness.tone
      : "ready",
    readinessDetail: snapshot.readiness.detail,
    nextAction: snapshot.nextCommand
      ? {
          action: snapshot.nextCommand,
          command: snapshot.nextCommand,
          reason: detail,
          priority: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? "critical" : "normal"
        }
      : null,
    recovery: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
      ? {
          kind: snapshot.lifecycle === "failed" ? "failed" : "blocked",
          reason: detail,
          fixCommand: snapshot.nextCommand,
          retryCommand: snapshot.nextCommand
        }
      : null,
    decisionSource: "runtime-baseline",
    updatedAt: snapshot.lastUpdatedAt ?? new Date().toISOString()
  };
}

function buildRuntimeLifecycleArtifact(
  snapshot: RuntimeSnapshot,
  decision: RuntimeDecision,
  timestamp: string
) {
  const stage = snapshot.lifecycle === "packet_created"
    ? "prepared"
    : snapshot.lifecycle === "queued"
      ? "packetized"
      : snapshot.lifecycle === "running"
        ? "validating"
        : snapshot.lifecycle === "completed"
          ? decision.currentStepId === "handoff" ? "handed-off" : "checkpointed"
          : snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
            ? "blocked"
            : "idle";
  const eventType = snapshot.lastEvent?.eventType ?? "runtime-state-transition";

  return {
    artifactType: "kiwi-control/runtime-lifecycle",
    version: 1,
    timestamp,
    currentTask: snapshot.task,
    currentStage: stage,
    validationStatus: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
      ? "error"
      : snapshot.lifecycle === "completed"
        ? "ok"
        : null,
    nextSuggestedCommand: decision.nextCommand,
    nextRecommendedAction: decision.nextAction?.action ?? decision.readinessDetail,
    recentEvents: [
      {
        timestamp,
        type: eventType,
        stage,
        status: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? "error" : "ok",
        summary: snapshot.reason ?? decision.readinessDetail,
        task: snapshot.task,
        command: decision.nextCommand,
        validation: snapshot.reason ?? null,
        failureReason: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? (snapshot.reason ?? decision.readinessDetail) : null,
        files: [],
        skillsApplied: [],
        tokenUsage: {
          measuredTokens: null,
          estimatedTokens: null,
          source: "none"
        }
      }
    ]
  };
}

function buildWorkflowArtifact(
  snapshot: RuntimeSnapshot,
  decision: RuntimeDecision,
  timestamp: string
) {
  const steps = [
    { stepId: "prepare-context", action: "Prepare context" },
    { stepId: "generate-run-packets", action: "Generate run packets" },
    { stepId: "validate-outcome", action: "Validate outcome" },
    { stepId: "checkpoint-progress", action: "Checkpoint progress" },
    { stepId: "handoff-work", action: "Handoff work" }
  ].map((step) => ({
    stepId: step.stepId,
    action: step.action,
    status: workflowStepStatus(step.stepId, snapshot, decision),
    input: snapshot.task,
    expectedOutput: null,
    output: null,
    validation: null,
    failureReason: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? snapshot.reason : null,
    attemptCount: 0,
    retryCount: 0,
    files: [],
    skillsApplied: [],
    tokenUsage: {
      source: "none",
      measuredTokens: null,
      estimatedTokens: null,
      note: "No token usage has been recorded for this step yet."
    },
    result: {
      ok: workflowStepStatus(step.stepId, snapshot, decision) === "success"
        ? true
        : workflowStepStatus(step.stepId, snapshot, decision) === "failed"
          ? false
          : null,
      summary: null,
      validation: null,
      failureReason: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? snapshot.reason : null,
      suggestedFix: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed" ? snapshot.nextCommand : null,
      retryCommand: snapshot.nextCommand
    },
    updatedAt: timestamp
  }));
  const currentStep = steps.find((step) => step.status === "running" || step.status === "failed") ?? null;

  return {
    artifactType: "kiwi-control/workflow",
    version: 3,
    timestamp,
    task: snapshot.task,
    status: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed"
      ? "failed"
      : snapshot.lifecycle === "completed"
        ? "success"
        : snapshot.lifecycle === "running" || snapshot.lifecycle === "queued" || snapshot.lifecycle === "packet_created"
          ? "running"
          : "pending",
    currentStepId: currentStep?.stepId ?? null,
    steps
  };
}

function buildExecutionPlanArtifact(
  snapshot: RuntimeSnapshot,
  decision: RuntimeDecision,
  timestamp: string
) {
  const steps = buildExecutionPlanSteps(snapshot, decision);
  const currentStepIndex = Math.max(steps.findIndex((step) => step.status === "running" || step.status === "failed"), 0);
  const lastError = buildExecutionPlanError(snapshot, decision);
  return {
    artifactType: "kiwi-control/execution-plan",
    version: 2,
    task: snapshot.task,
    intent: null,
    hierarchy: {
      goal: snapshot.task,
      subtasks: snapshot.task
        ? [{ id: "primary", title: snapshot.task, stepIds: steps.map((step) => step.id) }]
        : []
    },
    state: executionPlanStateFromRuntime(snapshot, decision),
    currentStepIndex,
    confidence: null,
    risk: "low",
    blocked: snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed",
    summary: decision.recovery?.reason ?? decision.readinessDetail,
    steps,
    nextCommands: decision.nextCommand ? [decision.nextCommand] : [],
    lastError,
    contextSnapshot: {
      selectedFiles: [],
      selectedModuleGroups: [],
      confidence: null,
      contextTreePath: null,
      dependencyChains: {},
      forwardDependencies: [],
      reverseDependencies: []
    },
    impactPreview: {
      likelyFiles: [],
      moduleGroups: []
    },
    verificationLayers: [
      { id: "syntax", description: "Confirm syntax and formatting are intact." },
      { id: "behavioral", description: "Confirm the requested behavior works." },
      { id: "regression", description: "Confirm adjacent flows still behave correctly." }
    ],
    partialResults: steps
      .filter((step) => step.status === "success")
      .map((step) => ({ stepId: step.id, summary: `${step.description} completed.` })),
    evalSummary: null,
    updatedAt: timestamp
  };
}

function buildDecisionLogicArtifact(
  snapshot: RuntimeSnapshot,
  decision: RuntimeDecision,
  timestamp: string
) {
  return {
    artifactType: "kiwi-control/decision-logic",
    version: 1,
    timestamp,
    summary: decision.nextAction
      ? `${decision.nextAction.action}: ${decision.nextAction.reason}`
      : decision.recovery?.reason ?? decision.readinessDetail,
    decisionPriority: (decision.nextAction?.priority ?? "low"),
    inputSignals: [
      `execution lifecycle: ${snapshot.lifecycle}`,
      `current step: ${decision.currentStepId}`,
      `decision source: ${decision.decisionSource}`
    ],
    reasoningChain: [
      "Runtime decision state is the canonical source of truth for next-step decisions.",
      `The active runtime step is ${decision.currentStepId}.`
    ],
    ignoredSignals: [
      "Compatibility artifacts are derived and do not override canonical runtime decision state."
    ]
  };
}

function workflowStepStatus(
  stepId: string,
  snapshot: RuntimeSnapshot,
  decision: RuntimeDecision
): "pending" | "running" | "success" | "failed" {
  if (snapshot.lifecycle === "idle") {
    return "pending";
  }
  if (stepId === "prepare-context") {
    if (snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed") {
      return decision.currentStepId === "prepare" ? "failed" : "success";
    }
    return "success";
  }
  if (stepId === "generate-run-packets") {
    if (snapshot.lifecycle === "packet_created") {
      return "running";
    }
    if (snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed") {
      return decision.currentStepId === "generate_packets" ? "failed" : "success";
    }
    if (snapshot.lifecycle === "queued" || snapshot.lifecycle === "running" || snapshot.lifecycle === "completed") {
      return "success";
    }
  }
  if (stepId === "validate-outcome") {
    if (snapshot.lifecycle === "running") {
      return "running";
    }
    if (snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed") {
      return decision.currentStepId === "validate" ? "failed" : "pending";
    }
    if (snapshot.lifecycle === "completed") {
      return "success";
    }
  }
  if (stepId === "checkpoint-progress") {
    if (snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed") {
      return decision.currentStepId === "checkpoint" ? "failed" : "pending";
    }
    if (snapshot.lifecycle === "completed") {
      return decision.currentStepId === "checkpoint" ? "running" : "success";
    }
  }
  if (stepId === "handoff-work") {
    if (snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed") {
      return decision.currentStepId === "handoff" ? "failed" : "pending";
    }
    if (snapshot.lifecycle === "completed" && decision.currentStepId === "handoff") {
      return "running";
    }
  }
  return "pending";
}

function buildExecutionPlanSteps(snapshot: RuntimeSnapshot, decision: RuntimeDecision) {
  const task = snapshot.task ?? "describe your task";
  const stepStatus = (stepId: string): "pending" | "running" | "success" | "failed" => {
    if (snapshot.lifecycle === "blocked" || snapshot.lifecycle === "failed") {
      if (decision.currentStepId === "prepare" && stepId === "prepare") return "failed";
      if (decision.currentStepId === "generate_packets" && stepId === "execute") return "failed";
      if (decision.currentStepId === "validate" && stepId === "validate") return "failed";
      if (decision.currentStepId === "checkpoint" && stepId === "checkpoint") return "failed";
      if (decision.currentStepId === "handoff" && stepId === "handoff") return "failed";
    }
    if (snapshot.lifecycle === "packet_created") {
      return stepId === "prepare" ? "success" : stepId === "execute" ? "running" : "pending";
    }
    if (snapshot.lifecycle === "queued") {
      return stepId === "prepare" || stepId === "execute" ? "success" : stepId === "validate" ? "running" : "pending";
    }
    if (snapshot.lifecycle === "running") {
      return stepId === "prepare" || stepId === "execute" ? "success" : stepId === "validate" ? "running" : "pending";
    }
    if (snapshot.lifecycle === "completed") {
      return stepId === "prepare" || stepId === "execute" || stepId === "validate"
        ? "success"
        : stepId === "checkpoint" && decision.currentStepId === "checkpoint"
          ? "running"
          : "pending";
    }
    return "pending";
  };

  return [
    {
      id: "prepare",
      description: "Prepare context",
      command: `kiwi-control prepare "${task}"`,
      expectedOutput: "Prepared scope and generated instructions are ready.",
      expectedOutcome: { expectedFiles: [], expectedChanges: [] },
      validation: "Prepared scope exists and selected files are bounded.",
      status: stepStatus("prepare"),
      workflowStepId: "prepare-context",
      result: { ok: null, summary: null, validation: null, failureReason: null, suggestedFix: null },
      fixCommand: null,
      retryCommand: `kiwi-control prepare "${task}"`
    },
    {
      id: "execute",
      description: "Generate and execute run packets",
      command: `kiwi-control run "${task}"`,
      expectedOutput: "Task packets are available for execution.",
      expectedOutcome: { expectedFiles: [], expectedChanges: [] },
      validation: "Packet output exists and execution can proceed.",
      status: stepStatus("execute"),
      workflowStepId: "generate-run-packets",
      result: { ok: null, summary: null, validation: null, failureReason: null, suggestedFix: null },
      fixCommand: null,
      retryCommand: `kiwi-control run "${task}"`
    },
    {
      id: "validate",
      description: "Validate outcome",
      command: `kiwi-control validate "${task}"`,
      expectedOutput: "The prepared scope and task outcome are validated.",
      expectedOutcome: { expectedFiles: [], expectedChanges: [] },
      validation: "Validation confirms scope and intent stayed aligned.",
      status: stepStatus("validate"),
      workflowStepId: "validate-outcome",
      result: { ok: null, summary: null, validation: null, failureReason: null, suggestedFix: null },
      fixCommand: decision.recovery?.fixCommand ?? null,
      retryCommand: decision.recovery?.retryCommand ?? `kiwi-control validate "${task}"`
    },
    {
      id: "checkpoint",
      description: "Checkpoint progress",
      command: 'kiwi-control checkpoint "validated-progress"',
      expectedOutput: "Checkpoint artifacts are written.",
      expectedOutcome: { expectedFiles: [], expectedChanges: [] },
      validation: "Checkpoint JSON exists and continuity is updated.",
      status: stepStatus("checkpoint"),
      workflowStepId: "checkpoint-progress",
      result: { ok: null, summary: null, validation: null, failureReason: null, suggestedFix: null },
      fixCommand: null,
      retryCommand: 'kiwi-control checkpoint "validated-progress"'
    },
    {
      id: "handoff",
      description: "Handoff work",
      command: "kiwi-control handoff",
      expectedOutput: "Handoff artifacts are written.",
      expectedOutcome: { expectedFiles: [], expectedChanges: [] },
      validation: "Handoff JSON exists and next tool/specialist is recorded.",
      status: stepStatus("handoff"),
      workflowStepId: "handoff-work",
      result: { ok: null, summary: null, validation: null, failureReason: null, suggestedFix: null },
      fixCommand: null,
      retryCommand: "kiwi-control handoff"
    }
  ];
}

function executionPlanStateFromRuntime(snapshot: RuntimeSnapshot, decision: RuntimeDecision) {
  if (snapshot.lifecycle === "idle") return "idle";
  if (snapshot.lifecycle === "blocked") return "blocked";
  if (snapshot.lifecycle === "failed") return "failed";
  if (snapshot.lifecycle === "completed") return "completed";
  if (snapshot.lifecycle === "running" && decision.currentStepId === "validate") return "validating";
  if (snapshot.lifecycle === "running" || snapshot.lifecycle === "queued") return "executing";
  return "ready";
}

function buildExecutionPlanError(
  snapshot: RuntimeSnapshot,
  decision: RuntimeDecision
): {
  errorType: "context_error" | "logic_error" | "environment_error";
  retryStrategy: "expand" | "narrow" | "re-plan";
  reason: string;
  fixCommand: string;
  retryCommand: string;
} | null {
  if (!decision.recovery) {
    return null;
  }
  const errorType = decision.currentStepId === "generate_packets" || decision.currentStepId === "prepare"
    ? "context_error"
    : "logic_error";
  const retryStrategy = errorType === "context_error" ? "expand" : "re-plan";
  return {
    errorType,
    retryStrategy,
    reason: decision.recovery.reason,
    fixCommand: decision.recovery.fixCommand ?? snapshot.nextCommand ?? "kiwi-control next",
    retryCommand: decision.recovery.retryCommand ?? snapshot.nextCommand ?? "kiwi-control next"
  };
}

async function deriveLegacyExecutionState(targetRoot: string): Promise<ExecutionStateRecord> {
  const [plan, lifecycle, workflow] = await Promise.all([
    readLegacyJson<LegacyExecutionPlanRecord>(path.join(targetRoot, ".agent", "state", "execution-plan.json")),
    readLegacyJson<LegacyRuntimeLifecycleRecord>(path.join(targetRoot, ".agent", "state", "runtime-lifecycle.json")),
    readLegacyJson<LegacyWorkflowRecord>(path.join(targetRoot, ".agent", "state", "workflow.json"))
  ]);

  const base = emptyExecutionState();
  const task = plan?.task ?? lifecycle?.currentTask ?? workflow?.task ?? null;
  const reason = plan?.lastError?.reason ?? lifecycle?.nextRecommendedAction ?? plan?.summary ?? null;
  const nextCommand = plan?.lastError?.fixCommand ?? plan?.nextCommands?.[0] ?? lifecycle?.nextSuggestedCommand ?? null;
  const lastUpdatedAt = plan?.updatedAt ?? lifecycle?.timestamp ?? workflow?.timestamp ?? null;

  if (plan?.state === "blocked" || lifecycle?.currentStage === "blocked") {
    return {
      ...base,
      task,
      lifecycle: "blocked",
      reason,
      nextCommand,
      blockedBy: reason ? [reason] : [],
      lastUpdatedAt
    };
  }

  if (plan?.state === "failed") {
    return {
      ...base,
      task,
      lifecycle: "failed",
      reason,
      nextCommand,
      blockedBy: reason ? [reason] : [],
      lastUpdatedAt
    };
  }

  if (plan?.state === "completed" || lifecycle?.currentStage === "checkpointed" || lifecycle?.currentStage === "handed-off") {
    return {
      ...base,
      task,
      lifecycle: "completed",
      reason,
      nextCommand,
      lastUpdatedAt
    };
  }

  if (workflow?.status === "failed") {
    return {
      ...base,
      task,
      lifecycle: "blocked",
      reason,
      nextCommand,
      blockedBy: reason ? [reason] : [],
      lastUpdatedAt
    };
  }

  if (lifecycle?.currentStage === "packetized") {
    return {
      ...base,
      task,
      lifecycle: "queued",
      reason,
      nextCommand,
      lastUpdatedAt
    };
  }

  if (lifecycle?.currentStage === "prepared" || plan?.state === "ready" || plan?.state === "planning") {
    return {
      ...base,
      task,
      lifecycle: "packet-created",
      reason,
      nextCommand,
      lastUpdatedAt
    };
  }

  if (plan?.state === "executing" || plan?.state === "validating" || plan?.state === "retrying" || workflow?.status === "running" || lifecycle?.currentStage === "validating") {
    return {
      ...base,
      task,
      lifecycle: "running",
      reason,
      nextCommand,
      lastUpdatedAt
    };
  }

  return {
    ...base,
    task,
    reason,
    nextCommand,
    lastUpdatedAt
  };
}

async function readLegacyJson<T>(filePath: string): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  try {
    return await readJson<T>(filePath);
  } catch {
    return null;
  }
}

function mergeArtifacts(current: ExecutionArtifacts, patch?: ExecutionArtifacts): ExecutionArtifacts {
  const next: ExecutionArtifacts = {};
  for (const [key, value] of Object.entries(current)) {
    const normalized = normalizeArtifactEntries(value);
    if (normalized.length > 0) {
      next[key] = normalized;
    }
  }
  if (!patch) {
    return next;
  }
  for (const [key, value] of Object.entries(patch)) {
    const normalized = normalizeArtifactEntries(value);
    if (normalized.length > 0) {
      next[key] = normalized;
    }
  }
  return next;
}

function normalizeExecutionStateRecord(state: ExecutionStateRecord): ExecutionStateRecord {
  return {
    ...state,
    revision: Number.isFinite(state.revision) ? state.revision : 0,
    blockedBy: [...new Set(state.blockedBy ?? [])],
    artifacts: mergeArtifacts({}, state.artifacts),
    lastEvent: state.lastEvent
      ? {
          ...state.lastEvent,
          blockedBy: [...new Set(state.lastEvent.blockedBy ?? [])],
          artifacts: mergeArtifacts({}, state.lastEvent.artifacts)
        }
      : null
  };
}

function normalizeArtifactEntries(value: string[]): string[] {
  return [...new Set(value.filter((entry) => entry.trim().length > 0))];
}

function runtimeSnapshotToExecutionState(snapshot: RuntimeSnapshot): ExecutionStateRecord {
  return normalizeExecutionStateRecord({
    artifactType: "kiwi-control/execution-state",
    version: EXECUTION_STATE_VERSION,
    revision: snapshot.revision,
    operationId: snapshot.operationId,
    task: snapshot.task,
    sourceCommand: snapshot.sourceCommand,
    lifecycle: fromRuntimeLifecycle(snapshot.lifecycle),
    reason: snapshot.reason,
    nextCommand: snapshot.nextCommand,
    blockedBy: snapshot.blockedBy,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    artifacts: snapshot.artifacts,
    lastEvent: snapshot.lastEvent
      ? {
          revision: snapshot.lastEvent.revision,
          operationId: snapshot.lastEvent.operationId,
          type: snapshot.lastEvent.eventType,
          lifecycle: fromRuntimeLifecycle(snapshot.lastEvent.lifecycle),
          task: snapshot.lastEvent.task,
          sourceCommand: snapshot.lastEvent.sourceCommand,
          reason: snapshot.lastEvent.reason,
          nextCommand: snapshot.lastEvent.nextCommand,
          blockedBy: snapshot.lastEvent.blockedBy,
          artifacts: snapshot.lastEvent.artifacts,
          recordedAt: snapshot.lastEvent.recordedAt
        }
      : null
  });
}

function toRuntimeLifecycle(lifecycle: ExecutionLifecycle): RuntimeSnapshot["lifecycle"] {
  switch (lifecycle) {
    case "packet-created":
      return "packet_created";
    default:
      return lifecycle;
  }
}

function fromRuntimeLifecycle(lifecycle: RuntimeSnapshot["lifecycle"]): ExecutionLifecycle {
  switch (lifecycle) {
    case "packet_created":
      return "packet-created";
    default:
      return lifecycle;
  }
}
