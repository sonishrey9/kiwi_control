import path from "node:path";
import { loadCcusageCompatibleSessionUsage } from "../integrations/ccusage.js";
import { pathExists, readJson, writeText } from "../utils/fs.js";

export interface MeasuredUsageRun {
  runId: string;
  source: "ccusage-session" | "execution-log";
  workflow: string;
  task: string | null;
  timestamp: string;
  totalTokens: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
  files: string[];
}

export interface MeasuredUsageWorkflow {
  workflow: string;
  tokens: number;
  runs: number;
}

export interface MeasuredUsageFile {
  file: string;
  tokens: number;
  runs: number;
  attribution: "allocated";
}

export interface MeasuredUsageState {
  artifactType: "kiwi-control/measured-usage";
  version: 1;
  timestamp: string;
  available: boolean;
  source: "ccusage-session" | "execution-log" | "mixed" | "none";
  totalTokens: number;
  totalRuns: number;
  runs: MeasuredUsageRun[];
  workflows: MeasuredUsageWorkflow[];
  files: MeasuredUsageFile[];
  note: string;
}

interface ExecutionLogFileEntry {
  task: string;
  timestamp: string;
  tokensUsed: number;
  filesTouched: string[];
  completionSource?: string | null;
}

function measuredUsagePath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "measured-usage.json");
}

export async function buildMeasuredUsage(targetRoot: string): Promise<MeasuredUsageState> {
  const ccusageRuns = await loadCcusageCompatibleSessionUsage(targetRoot);
  const executionRuns = await loadMeasuredExecutionRuns(targetRoot);

  const runs: MeasuredUsageRun[] = [
    ...ccusageRuns.map((run) => ({
      runId: run.sessionId,
      source: "ccusage-session" as const,
      workflow: "codex-session",
      task: null,
      timestamp: run.lastActivity,
      totalTokens: run.totalTokens,
      inputTokens: run.inputTokens,
      cachedInputTokens: run.cachedInputTokens,
      outputTokens: run.outputTokens,
      reasoningOutputTokens: run.reasoningOutputTokens,
      files: []
    })),
    ...executionRuns
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  const totalTokens = runs.reduce((sum, run) => sum + run.totalTokens, 0);
  const workflows = aggregateWorkflowUsage(runs);
  const files = aggregateFileUsage(executionRuns);
  const source = resolveUsageSource(ccusageRuns.length > 0, executionRuns.length > 0);

  return {
    artifactType: "kiwi-control/measured-usage",
    version: 1,
    timestamp: new Date().toISOString(),
    available: runs.length > 0,
    source,
    totalTokens,
    totalRuns: runs.length,
    runs,
    workflows,
    files,
    note: runs.length > 0
      ? buildMeasuredUsageNote(ccusageRuns.length > 0, executionRuns.length > 0, files.length > 0)
      : "No measured token usage was found for this repo. Falling back to heuristic estimates is expected."
  };
}

export async function persistMeasuredUsage(targetRoot: string, state: MeasuredUsageState): Promise<string> {
  const outputPath = measuredUsagePath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(state, null, 2)}\n`);
  return outputPath;
}

export async function loadMeasuredUsage(targetRoot: string): Promise<MeasuredUsageState> {
  const outputPath = measuredUsagePath(targetRoot);
  if (!(await pathExists(outputPath))) {
    return buildMeasuredUsage(targetRoot);
  }

  try {
    const state = await readJson<MeasuredUsageState>(outputPath);
    if (state.artifactType !== "kiwi-control/measured-usage" || state.version !== 1) {
      return buildMeasuredUsage(targetRoot);
    }
    return state;
  } catch {
    return buildMeasuredUsage(targetRoot);
  }
}

async function loadMeasuredExecutionRuns(targetRoot: string): Promise<MeasuredUsageRun[]> {
  const executionLogPath = path.join(targetRoot, ".agent", "state", "execution-log.json");
  if (!(await pathExists(executionLogPath))) {
    return [];
  }

  try {
    const payload = await readJson<{ entries?: ExecutionLogFileEntry[] }>(executionLogPath);
    return (payload.entries ?? [])
      .filter((entry) => entry.tokensUsed > 0)
      .map((entry, index) => ({
        runId: `${entry.timestamp}-${index}`,
        source: "execution-log" as const,
        workflow: entry.completionSource ?? "execution-log",
        task: entry.task ?? null,
        timestamp: entry.timestamp,
        totalTokens: entry.tokensUsed,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: null,
        files: entry.filesTouched ?? []
      }));
  } catch {
    return [];
  }
}

function aggregateWorkflowUsage(runs: MeasuredUsageRun[]): MeasuredUsageWorkflow[] {
  const map = new Map<string, { tokens: number; runs: number }>();
  for (const run of runs) {
    const current = map.get(run.workflow) ?? { tokens: 0, runs: 0 };
    current.tokens += run.totalTokens;
    current.runs += 1;
    map.set(run.workflow, current);
  }

  return [...map.entries()]
    .map(([workflow, value]) => ({ workflow, tokens: value.tokens, runs: value.runs }))
    .sort((left, right) => right.tokens - left.tokens);
}

function aggregateFileUsage(runs: MeasuredUsageRun[]): MeasuredUsageFile[] {
  const map = new Map<string, { tokens: number; runs: number }>();
  for (const run of runs) {
    if (run.files.length === 0 || run.totalTokens <= 0) {
      continue;
    }
    const perFileTokens = Math.round(run.totalTokens / run.files.length);
    for (const file of run.files) {
      const current = map.get(file) ?? { tokens: 0, runs: 0 };
      current.tokens += perFileTokens;
      current.runs += 1;
      map.set(file, current);
    }
  }

  return [...map.entries()]
    .map(([file, value]) => ({
      file,
      tokens: value.tokens,
      runs: value.runs,
      attribution: "allocated" as const
    }))
    .sort((left, right) => right.tokens - left.tokens);
}

function resolveUsageSource(hasCcusage: boolean, hasExecutionLog: boolean): MeasuredUsageState["source"] {
  if (hasCcusage && hasExecutionLog) {
    return "mixed";
  }
  if (hasCcusage) {
    return "ccusage-session";
  }
  if (hasExecutionLog) {
    return "execution-log";
  }
  return "none";
}

function buildMeasuredUsageNote(
  hasCcusage: boolean,
  hasExecutionLog: boolean,
  hasFileUsage: boolean
): string {
  const parts: string[] = [];
  if (hasCcusage) {
    parts.push("Measured run usage came from Codex session logs using a ccusage-compatible parser.");
  }
  if (hasExecutionLog) {
    parts.push("Measured workflow and per-file views were enriched from repo-local execution-log entries with token totals.");
  }
  if (!hasFileUsage) {
    parts.push("Per-file measured attribution is only available when execution-log entries include non-zero token totals.");
  }
  return parts.join(" ");
}
