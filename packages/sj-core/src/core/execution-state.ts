import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists, readJson, writeText } from "../utils/fs.js";

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
  const stateFilePath = executionStatePath(targetRoot);
  if (await pathExists(stateFilePath)) {
    try {
      const state = await readJson<ExecutionStateRecord>(stateFilePath);
      if (state.artifactType === "kiwi-control/execution-state" && state.version === EXECUTION_STATE_VERSION) {
        return normalizeExecutionStateRecord(state);
      }
    } catch {
      return emptyExecutionState();
    }
  }

  if (options.allowLegacyFallback === false) {
    return emptyExecutionState();
  }

  return deriveLegacyExecutionState(targetRoot);
}

export async function recordExecutionState(
  targetRoot: string,
  options: RecordExecutionStateOptions
): Promise<ExecutionStateRecord> {
  const current = await loadExecutionState(targetRoot, { allowLegacyFallback: false });
  const recordedAt = new Date().toISOString();
  const nextRevision = current.revision + 1;
  const reuseOperation = options.reuseOperation ?? options.lifecycle !== "idle";
  const nextOperationId =
    options.lifecycle === "idle"
      ? null
      : options.operationId !== undefined
        ? options.operationId
        : reuseOperation
          ? current.operationId ?? randomUUID()
          : randomUUID();
  const nextArtifacts = mergeArtifacts(
    reuseOperation && nextOperationId != null && current.operationId === nextOperationId
      ? current.artifacts
      : {},
    options.artifacts
  );
  const nextBlockedBy = [...new Set(options.blockedBy ?? [])];
  const nextTask = options.clearTask === true
    ? null
    : options.task !== undefined
      ? options.task
      : reuseOperation
        ? current.task
        : null;
  const nextSourceCommand = options.sourceCommand !== undefined
    ? options.sourceCommand
    : reuseOperation
      ? current.sourceCommand
      : null;
  const event: ExecutionStateEvent = {
    revision: nextRevision,
    operationId: nextOperationId,
    type: options.type,
    lifecycle: options.lifecycle,
    task: nextTask ?? null,
    sourceCommand: nextSourceCommand ?? null,
    reason: options.reason ?? null,
    nextCommand: options.nextCommand ?? null,
    blockedBy: nextBlockedBy,
    artifacts: nextArtifacts,
    recordedAt
  };
  const nextState: ExecutionStateRecord = {
    artifactType: "kiwi-control/execution-state",
    version: EXECUTION_STATE_VERSION,
    revision: nextRevision,
    operationId: nextOperationId,
    task: nextTask ?? null,
    sourceCommand: nextSourceCommand ?? null,
    lifecycle: options.lifecycle,
    reason: options.reason ?? null,
    nextCommand: options.nextCommand ?? null,
    blockedBy: nextBlockedBy,
    lastUpdatedAt: recordedAt,
    artifacts: nextArtifacts,
    lastEvent: event
  };

  await persistExecutionState(targetRoot, nextState);
  await appendExecutionEvent(targetRoot, event);
  return nextState;
}

export async function persistExecutionState(
  targetRoot: string,
  state: ExecutionStateRecord
): Promise<string> {
  const outputPath = executionStatePath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(normalizeExecutionStateRecord(state), null, 2)}\n`);
  return outputPath;
}

export async function readExecutionStateRevision(targetRoot: string): Promise<number> {
  const state = await loadExecutionState(targetRoot, { allowLegacyFallback: false });
  return state.revision;
}

async function appendExecutionEvent(targetRoot: string, event: ExecutionStateEvent): Promise<void> {
  const eventsFilePath = executionEventsPath(targetRoot);
  await fs.mkdir(path.dirname(eventsFilePath), { recursive: true });
  await fs.appendFile(eventsFilePath, `${JSON.stringify(event)}\n`, "utf8");
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
