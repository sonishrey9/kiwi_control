import path from "node:path";
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
}

export interface ExecutionLogState {
  artifactType: "kiwi-control/execution-log";
  version: 1;
  entries: ExecutionEntry[];
  totalExecutions: number;
  totalTokensUsed: number;
  averageTokensPerRun: number;
  successRate: number;
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
      version: 1,
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
    version: 1,
    entries,
    totalExecutions,
    totalTokensUsed,
    averageTokensPerRun,
    successRate
  };

  await persistExecutionLog(targetRoot, updated);
  return updated;
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
