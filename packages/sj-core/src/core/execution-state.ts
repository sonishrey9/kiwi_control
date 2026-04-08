import path from "node:path";
import { pathExists, readJson, writeText } from "../utils/fs.js";
import {
  getRuntimeSnapshot,
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
