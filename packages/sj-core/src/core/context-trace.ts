import path from "node:path";
import { writeText } from "../utils/fs.js";

export type ExplainabilityReason =
  | "changed file"
  | "keyword match"
  | "import dependency"
  | "proximity"
  | "recent file"
  | "repo context"
  | "adaptive boost"
  | "adaptive penalty"
  | "task fit"
  | "low relevance"
  | "selection filter"
  | "file-type mismatch"
  | "passive authority"
  | "out-of-directory";

export interface FileAnalysisEntry {
  file: string;
  reasons: ExplainabilityReason[];
  score?: number;
  note?: string;
}

export interface SkippedPathEntry {
  path: string;
  reason: string;
  estimated?: boolean;
}

export interface ContextTraceStep {
  step: string;
  summary: string;
  filesAdded: string[];
  filesRemoved?: string[];
}

export interface ContextTraceState {
  artifactType: "kiwi-control/context-trace";
  version: 1;
  timestamp: string;
  task: string;
  fileAnalysis: {
    totalFiles: number;
    scannedFiles: number;
    skippedFiles: number;
    selectedFiles: number;
    excludedFiles: number;
    selected: FileAnalysisEntry[];
    excluded: FileAnalysisEntry[];
    skipped: SkippedPathEntry[];
  };
  initialSignals: {
    changedFiles: string[];
    recentFiles: string[];
    importNeighbors: string[];
    proximityFiles: string[];
    keywordMatches: string[];
    repoContextFiles: string[];
  };
  expansionSteps: ContextTraceStep[];
  finalSelection: {
    include: string[];
    excludePatterns: string[];
    reason: string;
    confidence: string;
  };
  honesty: {
    heuristic: boolean;
    lowConfidence: boolean;
    partialScan: boolean;
  };
}

export interface IndexingState {
  artifactType: "kiwi-control/indexing";
  version: 1;
  timestamp: string;
  task: string;
  totalFiles: number;
  discoveredFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  visitedDirectories: number;
  skippedDirectories: number;
  maxDepthExplored: number;
  fileBudgetReached: boolean;
  directoryBudgetReached: boolean;
  partialScan: boolean;
  ignoreRulesApplied: string[];
  skipped: SkippedPathEntry[];
  indexedFiles?: number;
  indexUpdatedFiles?: number;
  indexReusedFiles?: number;
  impactFiles?: number;
}

function contextTracePath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "context-trace.json");
}

function indexingPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "indexing.json");
}

export async function persistContextTrace(
  targetRoot: string,
  trace: ContextTraceState
): Promise<string> {
  const outputPath = contextTracePath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(trace, null, 2)}\n`);
  return outputPath;
}

export async function persistIndexingState(
  targetRoot: string,
  indexing: IndexingState
): Promise<string> {
  const outputPath = indexingPath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(indexing, null, 2)}\n`);
  return outputPath;
}
