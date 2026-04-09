import path from "node:path";
import { recordWorkflowProgress } from "./workflow-engine.js";
import { pathExists, readJson } from "../utils/fs.js";
import { persistRuntimeDerivedOutput } from "../runtime/client.js";

export type RuntimeLifecycleStage =
  | "idle"
  | "prepared"
  | "packetized"
  | "validating"
  | "checkpointed"
  | "handed-off"
  | "blocked";

export type RuntimeEventType =
  | "prepare_completed"
  | "packets_generated"
  | "validation_completed"
  | "validation_checkpoint"
  | "checkpoint_recorded"
  | "handoff_recorded";

export interface RuntimeLifecycleEvent {
  timestamp: string;
  type: RuntimeEventType;
  stage: RuntimeLifecycleStage;
  status: "ok" | "warn" | "error";
  summary: string;
  task: string | null;
  command: string | null;
  validation: string | null;
  failureReason: string | null;
  files: string[];
  skillsApplied: string[];
  tokenUsage: {
    measuredTokens: number | null;
    estimatedTokens: number | null;
    source: "measured" | "estimated" | "mixed" | "none";
  };
}

export interface RuntimeLifecycleState {
  artifactType: "kiwi-control/runtime-lifecycle";
  version: 1;
  timestamp: string;
  currentTask: string | null;
  currentStage: RuntimeLifecycleStage;
  validationStatus: "ok" | "warn" | "error" | null;
  nextSuggestedCommand: string | null;
  nextRecommendedAction: string | null;
  recentEvents: RuntimeLifecycleEvent[];
}

export interface RuntimeProgressEntry {
  type: RuntimeEventType;
  stage: RuntimeLifecycleStage;
  status: "ok" | "warn" | "error";
  summary: string;
  task?: string | null;
  command?: string | null;
  files?: string[];
  skillsApplied?: string[];
  measuredTokens?: number | null;
  estimatedTokens?: number | null;
  failureReason?: string | null;
  validation?: string | null;
  validationStatus?: "ok" | "warn" | "error" | null;
  nextSuggestedCommand?: string | null;
  nextRecommendedAction?: string | null;
}

const MAX_RECENT_EVENTS = 40;

function lifecyclePath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "runtime-lifecycle.json");
}

function emptyLifecycle(): RuntimeLifecycleState {
  return {
    artifactType: "kiwi-control/runtime-lifecycle",
    version: 1,
    timestamp: new Date().toISOString(),
    currentTask: null,
    currentStage: "idle",
    validationStatus: null,
    nextSuggestedCommand: null,
    nextRecommendedAction: null,
    recentEvents: []
  };
}

export async function loadRuntimeLifecycle(targetRoot: string): Promise<RuntimeLifecycleState> {
  const outputPath = lifecyclePath(targetRoot);
  if (!(await pathExists(outputPath))) {
    return emptyLifecycle();
  }

  try {
    const state = await readJson<RuntimeLifecycleState>(outputPath);
    if (state.artifactType !== "kiwi-control/runtime-lifecycle" || state.version !== 1) {
      return emptyLifecycle();
    }
    return state;
  } catch {
    return emptyLifecycle();
  }
}

export async function recordRuntimeProgress(
  targetRoot: string,
  entry: RuntimeProgressEntry
): Promise<RuntimeLifecycleState> {
  const current = await loadRuntimeLifecycle(targetRoot);
  const event: RuntimeLifecycleEvent = {
    timestamp: new Date().toISOString(),
    type: entry.type,
    stage: entry.stage,
    status: entry.status,
    summary: entry.summary,
    task: entry.task ?? current.currentTask,
    command: entry.command ?? null,
    validation: entry.validation ?? null,
    failureReason: entry.failureReason ?? null,
    files: [...new Set(entry.files ?? [])],
    skillsApplied: [...new Set(entry.skillsApplied ?? [])],
    tokenUsage: {
      measuredTokens: entry.measuredTokens ?? null,
      estimatedTokens: entry.estimatedTokens ?? null,
      source:
        entry.measuredTokens != null && entry.estimatedTokens != null
          ? "mixed"
          : entry.measuredTokens != null
            ? "measured"
            : entry.estimatedTokens != null
              ? "estimated"
              : "none"
    }
  };

  const nextState: RuntimeLifecycleState = {
    artifactType: "kiwi-control/runtime-lifecycle",
    version: 1,
    timestamp: event.timestamp,
    currentTask: event.task,
    currentStage: entry.stage,
    validationStatus: entry.validationStatus ?? current.validationStatus,
    nextSuggestedCommand:
      entry.nextSuggestedCommand === undefined ? current.nextSuggestedCommand : entry.nextSuggestedCommand,
    nextRecommendedAction:
      entry.nextRecommendedAction === undefined ? current.nextRecommendedAction : entry.nextRecommendedAction,
    recentEvents: [event, ...current.recentEvents].slice(0, MAX_RECENT_EVENTS)
  };

  await persistRuntimeLifecycle(targetRoot, nextState);
  const workflowEntry = {
    task: event.task,
    eventType: event.type,
    status: event.status,
    summary: event.summary,
    validation: entry.validation ?? (entry.validationStatus ?? null),
    ...(entry.failureReason !== undefined ? { failureReason: entry.failureReason } : {}),
    files: event.files,
    skillsApplied: event.skillsApplied,
    ...(entry.measuredTokens !== undefined ? { measuredTokens: entry.measuredTokens } : {}),
    ...(entry.estimatedTokens !== undefined ? { estimatedTokens: entry.estimatedTokens } : {})
  };
  await recordWorkflowProgress(targetRoot, workflowEntry).catch(() => null);
  return nextState;
}

export async function persistRuntimeLifecycle(
  targetRoot: string,
  state: RuntimeLifecycleState
): Promise<string> {
  const outputPath = lifecyclePath(targetRoot);
  await persistRuntimeDerivedOutput({
    targetRoot,
    outputName: "runtime-lifecycle",
    payload: state
  });
  return outputPath;
}
