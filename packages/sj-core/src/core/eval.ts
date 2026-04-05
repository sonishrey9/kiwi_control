import path from "node:path";
import { ensureDir, pathExists, readJson, writeText } from "../utils/fs.js";
import { deriveModuleGroup } from "./context-index.js";

export interface EvalEntry {
  task: string;
  timestamp: string;
  selectedFiles: string[];
  modifiedFiles: string[];
  selectedFileCount: number;
  modifiedFileCount: number;
  matchedSelectedFiles: string[];
  matchedModuleGroups: string[];
  success: boolean;
  tokenSource: "measured" | "estimated" | "mixed" | "none";
  tokenCount: number;
  contextPrecision: number;
  notes: string[];
}

export interface EvalState {
  artifactType: "kiwi-control/eval-log";
  version: 1;
  entries: EvalEntry[];
  totalRuns: number;
  successRate: number;
  averageContextPrecision: number;
  averageTokenCount: number;
}

export interface EvalSummary {
  totalRuns: number;
  successRate: number;
  averageContextPrecision: number;
  averageTokenCount: number;
  recentEntries: EvalEntry[];
}

const MAX_EVAL_ENTRIES = 100;

function evalPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "eval", "eval-log.json");
}

export async function loadEvalState(targetRoot: string): Promise<EvalState> {
  const filePath = evalPath(targetRoot);
  if (!(await pathExists(filePath))) {
    return {
      artifactType: "kiwi-control/eval-log",
      version: 1,
      entries: [],
      totalRuns: 0,
      successRate: 0,
      averageContextPrecision: 0,
      averageTokenCount: 0
    };
  }
  try {
    const state = await readJson<EvalState>(filePath);
    if (state.artifactType !== "kiwi-control/eval-log" || state.version !== 1) {
      return {
        artifactType: "kiwi-control/eval-log",
        version: 1,
        entries: [],
        totalRuns: 0,
        successRate: 0,
        averageContextPrecision: 0,
        averageTokenCount: 0
      };
    }
    return state;
  } catch {
    return {
      artifactType: "kiwi-control/eval-log",
      version: 1,
      entries: [],
      totalRuns: 0,
      successRate: 0,
      averageContextPrecision: 0,
      averageTokenCount: 0
    };
  }
}

export async function recordEvalEntry(targetRoot: string, entry: Omit<EvalEntry, "timestamp" | "selectedFileCount" | "modifiedFileCount" | "matchedSelectedFiles" | "matchedModuleGroups" | "contextPrecision">): Promise<EvalState> {
  const state = await loadEvalState(targetRoot);
  const selectedSet = new Set(entry.selectedFiles);
  const modifiedSet = new Set(entry.modifiedFiles);
  const matchedSelectedFiles = entry.modifiedFiles.filter((file) => selectedSet.has(file));
  const selectedGroups = new Set(entry.selectedFiles.map((file) => deriveModuleGroup(file)));
  const matchedModuleGroups = [...modifiedSet].filter((file) => selectedGroups.has(deriveModuleGroup(file)));
  const contextPrecision = entry.modifiedFiles.length > 0
    ? round3((matchedSelectedFiles.length + matchedModuleGroups.length) / Math.max(entry.modifiedFiles.length + entry.selectedFiles.length, 1) * 2)
    : 0;

  const fullEntry: EvalEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    selectedFileCount: entry.selectedFiles.length,
    modifiedFileCount: entry.modifiedFiles.length,
    matchedSelectedFiles,
    matchedModuleGroups,
    contextPrecision
  };

  const entries = [fullEntry, ...state.entries].slice(0, MAX_EVAL_ENTRIES);
  const totalRuns = entries.length;
  const successRate = totalRuns > 0 ? Math.round((entries.filter((item) => item.success).length / totalRuns) * 100) : 0;
  const averageContextPrecision = totalRuns > 0 ? round3(entries.reduce((sum, item) => sum + item.contextPrecision, 0) / totalRuns) : 0;
  const averageTokenCount = totalRuns > 0 ? Math.round(entries.reduce((sum, item) => sum + item.tokenCount, 0) / totalRuns) : 0;
  const nextState: EvalState = {
    artifactType: "kiwi-control/eval-log",
    version: 1,
    entries,
    totalRuns,
    successRate,
    averageContextPrecision,
    averageTokenCount
  };
  await persistEvalState(targetRoot, nextState);
  return nextState;
}

export async function persistEvalState(targetRoot: string, state: EvalState): Promise<string> {
  const filePath = evalPath(targetRoot);
  await ensureDir(path.dirname(filePath));
  await writeText(filePath, `${JSON.stringify(state, null, 2)}\n`);
  return filePath;
}

export async function summarizeEval(targetRoot: string): Promise<EvalSummary> {
  const state = await loadEvalState(targetRoot);
  return {
    totalRuns: state.totalRuns,
    successRate: state.successRate,
    averageContextPrecision: state.averageContextPrecision,
    averageTokenCount: state.averageTokenCount,
    recentEntries: state.entries.slice(0, 10)
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
