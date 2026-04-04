import path from "node:path";
import { inspectGitState } from "./git.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles, type ScopeValidationResult } from "./prepared-scope.js";
import { pathExists, readJson, writeText } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionEntry {
  task: string;
  timestamp: string;
  tokensUsed: number;
  filesTouched: string[];
  success: boolean;
  duration: number | null;
  tool: string | null;
  confidence: string;
  runKey?: string;
  completionSource?: string | null;
  outOfScopeFiles?: string[];
}

export interface ExecutionLogState {
  artifactType: "kiwi-control/execution-log";
  version: 2;
  entries: ExecutionEntry[];
  totalExecutions: number;
  totalTokensUsed: number;
  averageTokensPerRun: number;
  successRate: number;
}

export interface ExecutionCompletionOptions {
  completionSource: string;
  confidence?: string | null;
  tokensUsed?: number | null;
  tool?: string | null;
}

export interface ExecutionCompletionResult {
  evaluated: boolean;
  recorded: boolean;
  validation: ScopeValidationResult | null;
  entry: ExecutionEntry | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 100;

// ---------------------------------------------------------------------------
// Load / persist
// ---------------------------------------------------------------------------

function logPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "execution-log.json");
}

export async function loadExecutionLog(targetRoot: string): Promise<ExecutionLogState> {
  const fp = logPath(targetRoot);
  if (!(await pathExists(fp))) {
      return {
        artifactType: "kiwi-control/execution-log",
        version: 2,
        entries: [],
        totalExecutions: 0,
        totalTokensUsed: 0,
        averageTokensPerRun: 0,
      successRate: 0
    };
  }
  return readJson<ExecutionLogState>(fp);
}

export async function persistExecutionLog(
  targetRoot: string,
  state: ExecutionLogState
): Promise<string> {
  const fp = logPath(targetRoot);
  await writeText(fp, `${JSON.stringify(state, null, 2)}\n`);
  return fp;
}

// ---------------------------------------------------------------------------
// Record execution
// ---------------------------------------------------------------------------

export async function recordExecution(
  targetRoot: string,
  entry: Omit<ExecutionEntry, "timestamp">
): Promise<ExecutionLogState> {
  const state = await loadExecutionLog(targetRoot);
  if (entry.runKey && state.entries.some((existing) => existing.runKey === entry.runKey)) {
    return state;
  }

  const fullEntry: ExecutionEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };

  const entries = [fullEntry, ...state.entries].slice(0, MAX_ENTRIES);

  const totalExecutions = state.totalExecutions + 1;
  const totalTokensUsed = state.totalTokensUsed + entry.tokensUsed;
  const averageTokensPerRun = totalExecutions > 0
    ? Math.round(totalTokensUsed / totalExecutions)
    : 0;
  const successCount = entries.filter((e) => e.success).length;
  const successRate = entries.length > 0
    ? Math.round((successCount / entries.length) * 100)
    : 0;

  const updated: ExecutionLogState = {
    artifactType: "kiwi-control/execution-log",
    version: 2,
    entries,
    totalExecutions,
    totalTokensUsed,
    averageTokensPerRun,
    successRate
  };

  await persistExecutionLog(targetRoot, updated);
  return updated;
}

export async function recordPreparedScopeCompletion(
  targetRoot: string,
  options: ExecutionCompletionOptions
): Promise<ExecutionCompletionResult> {
  const preparedScope = await loadPreparedScope(targetRoot);
  if (!preparedScope) {
    return {
      evaluated: false,
      recorded: false,
      validation: null,
      entry: null
    };
  }

  const gitState = await inspectGitState(targetRoot);
  if (!gitState.isGitRepo || gitState.changedFiles.length === 0) {
    return {
      evaluated: false,
      recorded: false,
      validation: null,
      entry: null
    };
  }

  const validation = validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, gitState.changedFiles);
  if (validation.touchedFiles.length === 0) {
    return {
      evaluated: false,
      recorded: false,
      validation,
      entry: null
    };
  }

  const runKey = buildPreparedScopeRunKey(preparedScope.timestamp, validation.touchedFiles);
  const state = await loadExecutionLog(targetRoot);
  if (state.entries.some((entry) => entry.runKey === runKey)) {
    return {
      evaluated: true,
      recorded: false,
      validation,
      entry: state.entries.find((entry) => entry.runKey === runKey) ?? null
    };
  }

  const entry: Omit<ExecutionEntry, "timestamp"> = {
    task: preparedScope.task,
    tokensUsed: Math.max(0, options.tokensUsed ?? 0),
    filesTouched: validation.touchedFiles,
    success: validation.ok,
    duration: null,
    tool: options.tool ?? null,
    confidence: options.confidence ?? "unknown",
    runKey,
    completionSource: options.completionSource,
    ...(validation.ok ? {} : { outOfScopeFiles: validation.outOfScopeFiles })
  };

  await recordExecution(targetRoot, entry);
  return {
    evaluated: true,
    recorded: true,
    validation,
    entry: {
      ...entry,
      timestamp: new Date().toISOString()
    }
  };
}

// ---------------------------------------------------------------------------
// Execution summary for UI/CLI
// ---------------------------------------------------------------------------

export interface ExecutionSummary {
  totalExecutions: number;
  totalTokensUsed: number;
  averageTokensPerRun: number;
  successRate: number;
  recentExecutions: Array<{
    task: string;
    success: boolean;
    tokensUsed: number;
    filesTouched: number;
    tool: string | null;
    timestamp: string;
  }>;
  tokenTrend: "improving" | "stable" | "worsening" | "insufficient-data";
}

export async function buildExecutionSummary(targetRoot: string): Promise<ExecutionSummary> {
  const state = await loadExecutionLog(targetRoot);

  const recentExecutions = state.entries.slice(0, 5).map((e) => ({
    task: e.task,
    success: e.success,
    tokensUsed: e.tokensUsed,
    filesTouched: e.filesTouched.length,
    tool: e.tool,
    timestamp: e.timestamp
  }));

  // Compute token trend from last 5 vs previous 5
  let tokenTrend: ExecutionSummary["tokenTrend"] = "insufficient-data";
  if (state.entries.length >= 6) {
    const recent5 = state.entries.slice(0, 5);
    const prev5 = state.entries.slice(5, 10);
    if (prev5.length >= 3) {
      const recentAvg = recent5.reduce((s, e) => s + e.tokensUsed, 0) / recent5.length;
      const prevAvg = prev5.reduce((s, e) => s + e.tokensUsed, 0) / prev5.length;
      if (recentAvg < prevAvg * 0.85) tokenTrend = "improving";
      else if (recentAvg > prevAvg * 1.15) tokenTrend = "worsening";
      else tokenTrend = "stable";
    }
  }

  return {
    totalExecutions: state.totalExecutions,
    totalTokensUsed: state.totalTokensUsed,
    averageTokensPerRun: state.averageTokensPerRun,
    successRate: state.successRate,
    recentExecutions,
    tokenTrend
  };
}

function buildPreparedScopeRunKey(scopeTimestamp: string, touchedFiles: string[]): string {
  const sortedTouchedFiles = [...touchedFiles].sort();
  return `${scopeTimestamp}::${sortedTouchedFiles.join("|")}`;
}
