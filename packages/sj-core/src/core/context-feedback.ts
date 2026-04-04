import path from "node:path";
import type { FileArea } from "./config.js";
import type { TaskCategory } from "./task-intent.js";
import {
  buildTaskScopeKey,
  deriveTaskArea,
  deriveTaskCategory,
  deriveTaskScope,
  inferFileAreaFromPaths
} from "./task-intent.js";
import { pathExists, readJson, writeText } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextFeedbackEntry {
  task: string;
  taskTokens?: string[];
  taskScope: string;
  taskCategory: TaskCategory;
  fileArea: FileArea;
  timestamp: string;
  selectedFiles: string[];
  usedFiles: string[];
  unusedFiles: string[];
  success: boolean;
  confidence: string;
  tokensSaved: number;
  runKey?: string;
  completionSource?: string | null;
}

export interface ContextFeedbackState {
  artifactType: "kiwi-control/context-feedback";
  version: 4;
  entries: ContextFeedbackEntry[];
  fileScores: Record<string, number>;
  scopeScores: Record<string, Record<string, number>>;
  totalRuns: number;
  successRate: number;
}

export interface AdaptiveWeights {
  boosted: Map<string, number>;
  penalized: Map<string, number>;
  basedOnPastRuns: boolean;
  reusedPattern: string | null;
  similarRuns: Array<{
    task: string;
    similarity: number;
    usedFiles: string[];
    timestamp: string;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 50;
const BOOST_PER_USE = 2;
const PENALTY_PER_WASTE = -1;
const DECAY_FACTOR = 0.9;
const SIMILARITY_THRESHOLD = 0.34;
const STRONG_SIMILARITY_THRESHOLD = 0.6;
const RETRIEVAL_BOOST_PER_USE = 1;
const RETRIEVAL_BOOST_CAP = 2;

// ---------------------------------------------------------------------------
// Load / persist
// ---------------------------------------------------------------------------

function feedbackPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "context-feedback.json");
}

export async function loadContextFeedback(targetRoot: string): Promise<ContextFeedbackState> {
  const fp = feedbackPath(targetRoot);
  if (!(await pathExists(fp))) {
    return {
      artifactType: "kiwi-control/context-feedback",
      version: 4,
      entries: [],
      fileScores: {},
      scopeScores: {},
      totalRuns: 0,
      successRate: 0
    };
  }
  const rawState = await readJson<Partial<ContextFeedbackState>>(fp);
  return normalizeContextFeedbackState(rawState);
}

export async function persistContextFeedback(
  targetRoot: string,
  state: ContextFeedbackState
): Promise<string> {
  const fp = feedbackPath(targetRoot);
  await writeText(fp, `${JSON.stringify(state, null, 2)}\n`);
  return fp;
}

// ---------------------------------------------------------------------------
// Record feedback from a completed run
// ---------------------------------------------------------------------------

export async function recordContextFeedback(
  targetRoot: string,
  entry: Omit<ContextFeedbackEntry, "timestamp" | "taskScope" | "taskCategory" | "fileArea">
): Promise<ContextFeedbackState> {
  const state = await loadContextFeedback(targetRoot);
  const taskCategory = deriveTaskCategory(entry.task);
  const inferredFileArea = inferFileAreaFromPaths([
    ...entry.usedFiles,
    ...entry.selectedFiles
  ]);
  const fileArea = inferredFileArea === "unknown"
    ? deriveTaskArea(entry.task)
    : inferredFileArea;
  const taskScope = buildTaskScopeKey(taskCategory, fileArea);

  if (entry.runKey && state.entries.some((existing) => existing.runKey === entry.runKey)) {
    return state;
  }

  const fullEntry: ContextFeedbackEntry = {
    ...entry,
    taskTokens: tokenizeTaskPattern(entry.task),
    taskCategory,
    fileArea,
    taskScope,
    timestamp: new Date().toISOString()
  };

  // Add entry, trim to max
  const entries = [fullEntry, ...state.entries].slice(0, MAX_ENTRIES);

  // Recompute file scores: decay existing, then apply new feedback
  const currentScopeScores = getScopedScores(state, taskScope, taskCategory);
  const fileScores: Record<string, number> = {};

  // Decay all existing scores
  for (const [file, score] of Object.entries(currentScopeScores)) {
    const decayed = score * DECAY_FACTOR;
    if (Math.abs(decayed) >= 0.1) {
      fileScores[file] = Math.round(decayed * 10) / 10;
    }
  }

  // Boost used files
  for (const file of entry.usedFiles) {
    fileScores[file] = (fileScores[file] ?? 0) + BOOST_PER_USE;
  }

  // Penalize unused files (selected but not used)
  for (const file of entry.unusedFiles) {
    fileScores[file] = (fileScores[file] ?? 0) + PENALTY_PER_WASTE;
  }

  const totalRuns = state.totalRuns + 1;
  const successCount = entries.filter((e) => e.success).length;
  const successRate = entries.length > 0
    ? Math.round((successCount / entries.length) * 100)
    : 0;

  const updated: ContextFeedbackState = {
    artifactType: "kiwi-control/context-feedback",
    version: 4,
    entries,
    fileScores: {},
    scopeScores: {
      ...(state.scopeScores ?? {}),
      [taskScope]: fileScores
    },
    totalRuns,
    successRate
  };

  await persistContextFeedback(targetRoot, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Compute adaptive weights from historical feedback
// ---------------------------------------------------------------------------

export async function computeAdaptiveWeights(
  targetRoot: string,
  task: string
): Promise<AdaptiveWeights> {
  const state = await loadContextFeedback(targetRoot);
  const scopedScores = resolveScopedScores(state, task);
  const similarRuns = retrieveSimilarRuns(state.entries, task);
  const boosted = new Map<string, number>();
  const penalized = new Map<string, number>();

  for (const [file, score] of Object.entries(scopedScores)) {
    if (score > 0) {
      boosted.set(file, score);
    } else if (score < 0) {
      penalized.set(file, Math.abs(score));
    }
  }

  const shouldApplyRetrieval =
    similarRuns.length >= 2 ||
    (similarRuns.length === 1 && (similarRuns[0]?.similarity ?? 0) >= STRONG_SIMILARITY_THRESHOLD);
  let reusedPattern: string | null = null;

  if (shouldApplyRetrieval) {
    const retrievalBoosts = new Map<string, number>();
    for (const run of similarRuns.slice(0, 3)) {
      reusedPattern ??= run.task;
      for (const file of run.usedFiles) {
        retrievalBoosts.set(
          file,
          Math.min(RETRIEVAL_BOOST_CAP, (retrievalBoosts.get(file) ?? 0) + RETRIEVAL_BOOST_PER_USE)
        );
      }
    }

    for (const [file, score] of retrievalBoosts) {
      boosted.set(file, Math.max(boosted.get(file) ?? 0, score));
    }
  }

  return {
    boosted,
    penalized,
    basedOnPastRuns: shouldApplyRetrieval,
    reusedPattern,
    similarRuns
  };
}

// ---------------------------------------------------------------------------
// Feedback summary for UI/CLI
// ---------------------------------------------------------------------------

export interface FeedbackSummary {
  totalRuns: number;
  successRate: number;
  adaptationLevel: "limited" | "active";
  note: string;
  basedOnPastRuns: boolean;
  reusedPattern: string | null;
  similarTasks: Array<{
    task: string;
    similarity: number;
    timestamp: string;
  }>;
  recentEntries: Array<{
    task: string;
    success: boolean;
    filesSelected: number;
    filesUsed: number;
    filesWasted: number;
    timestamp: string;
  }>;
  topBoostedFiles: Array<{ file: string; score: number }>;
  topPenalizedFiles: Array<{ file: string; score: number }>;
}

export async function buildFeedbackSummary(targetRoot: string, task?: string): Promise<FeedbackSummary> {
  const state = await loadContextFeedback(targetRoot);
  const scopedScores = task ? resolveScopedScores(state, task) : {};
  const similarRuns = task ? retrieveSimilarRuns(state.entries, task) : [];

  const recentEntries = state.entries.slice(0, 5).map((e) => ({
    task: e.task,
    success: e.success,
    filesSelected: e.selectedFiles.length,
    filesUsed: e.usedFiles.length,
    filesWasted: e.unusedFiles.length,
    timestamp: e.timestamp
  }));

  const scored = Object.entries(scopedScores)
    .map(([file, score]) => ({ file, score }))
    .sort((a, b) => b.score - a.score);

  const topBoostedFiles = scored.filter((s) => s.score > 0).slice(0, 5);
  const topPenalizedFiles = scored
    .filter((s) => s.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => ({ file: s.file, score: Math.abs(s.score) }));

  const adaptationLevel =
    state.totalRuns >= 3 && (topBoostedFiles.length > 0 || topPenalizedFiles.length > 0)
      ? "active"
      : "limited";
  const hasRetrievalSupport =
    similarRuns.length >= 2 ||
    (similarRuns.length === 1 && (similarRuns[0]?.similarity ?? 0) >= STRONG_SIMILARITY_THRESHOLD);
  const basedOnPastRuns = adaptationLevel === "active" && hasRetrievalSupport;
  const reusedPattern = basedOnPastRuns ? (similarRuns[0]?.task ?? null) : null;
  const note = buildFeedbackNote(state.totalRuns, adaptationLevel, task, scored.length, basedOnPastRuns, reusedPattern);

  return {
    totalRuns: state.totalRuns,
    successRate: state.successRate,
    adaptationLevel,
    note,
    basedOnPastRuns,
    reusedPattern,
    similarTasks: similarRuns.map((run) => ({
      task: run.task,
      similarity: run.similarity,
      timestamp: run.timestamp
    })),
    recentEntries,
    topBoostedFiles,
    topPenalizedFiles
  };
}

function normalizeContextFeedbackState(rawState: Partial<ContextFeedbackState>): ContextFeedbackState {
  const entries = (rawState.entries ?? []).map((entry) => {
    const task = entry.task ?? "";
    const taskCategory = entry.taskCategory ?? deriveTaskCategory(task);
    const inferredFileArea = entry.fileArea ?? inferFileAreaFromPaths([
      ...(entry.usedFiles ?? []),
      ...(entry.selectedFiles ?? [])
    ]);
    const fileArea = inferredFileArea === "unknown"
      ? deriveTaskArea(task)
      : inferredFileArea;
    const taskScope = entry.taskScope ?? buildTaskScopeKey(taskCategory, fileArea);

    return {
      task,
      taskTokens: entry.taskTokens ?? tokenizeTaskPattern(task),
      taskScope,
      taskCategory,
      fileArea,
      timestamp: entry.timestamp ?? new Date(0).toISOString(),
      selectedFiles: entry.selectedFiles ?? [],
      usedFiles: entry.usedFiles ?? [],
      unusedFiles: entry.unusedFiles ?? [],
      success: entry.success ?? true,
      confidence: entry.confidence ?? "unknown",
      tokensSaved: entry.tokensSaved ?? 0,
      ...(entry.runKey ? { runKey: entry.runKey } : {}),
      ...(entry.completionSource !== undefined ? { completionSource: entry.completionSource } : {})
    };
  });

  return {
    artifactType: "kiwi-control/context-feedback",
    version: 4,
    entries,
    fileScores: rawState.fileScores ?? {},
    scopeScores: rawState.scopeScores ?? {},
    totalRuns: rawState.totalRuns ?? entries.length,
    successRate: rawState.successRate ?? (entries.length > 0 ? Math.round((entries.filter((entry) => entry.success).length / entries.length) * 100) : 0)
  };
}

function getScopedScores(
  state: ContextFeedbackState,
  scopeKey: string,
  taskCategory: TaskCategory
): Record<string, number> {
  if (state.scopeScores?.[scopeKey]) {
    return state.scopeScores[scopeKey] ?? {};
  }

  if (state.scopeScores?.[taskCategory]) {
    return state.scopeScores[taskCategory] ?? {};
  }

  return {};
}

function resolveScopedScores(
  state: ContextFeedbackState,
  task: string
): Record<string, number> {
  const taskCategory = deriveTaskCategory(task);
  const exactScope = deriveTaskScope(task);

  if (state.scopeScores?.[exactScope]) {
    return state.scopeScores[exactScope] ?? {};
  }

  if (state.scopeScores?.[taskCategory]) {
    return state.scopeScores[taskCategory] ?? {};
  }

  const matchingScopes = Object.entries(state.scopeScores ?? {}).filter(([scope]) =>
    scope.startsWith(`${taskCategory}::`)
  );

  if (matchingScopes.length === 0) {
    return {};
  }

  const combined: Record<string, number> = {};
  for (const [, scores] of matchingScopes) {
    for (const [file, score] of Object.entries(scores)) {
      combined[file] = (combined[file] ?? 0) + score;
    }
  }
  return combined;
}

function buildFeedbackNote(
  totalRuns: number,
  adaptationLevel: "limited" | "active",
  task: string | undefined,
  scopedFileCount: number,
  basedOnPastRuns: boolean,
  reusedPattern: string | null
): string {
  if (totalRuns === 0) {
    return "Adaptive feedback is idle. Kiwi Control learns only from successful checkpoints and handoffs.";
  }

  if (adaptationLevel === "limited") {
    if (task && scopedFileCount === 0) {
      return "Adaptive feedback is limited for this task area. Kiwi Control needs more successful completions before it should influence selection strongly.";
    }
    return "Adaptive feedback is still limited. Kiwi Control has only a small amount of successful completion history so far.";
  }

  if (basedOnPastRuns && reusedPattern) {
    return `Adaptive feedback is active and current selection is based on past runs. Kiwi Control reused the successful pattern from "${reusedPattern}" while still checking fresh task signals.`;
  }

  return "Adaptive feedback is active for similar work and is influencing file selection with real completion history.";
}

function tokenizeTaskPattern(task: string): string[] {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, " ")
    .split(/[\s\-_]+/)
    .filter((token) => token.length > 2);
}

function retrieveSimilarRuns(
  entries: ContextFeedbackEntry[],
  task: string
): Array<{
  task: string;
  similarity: number;
  usedFiles: string[];
  timestamp: string;
}> {
  const targetTokens = new Set(tokenizeTaskPattern(task));
  const targetCategory = deriveTaskCategory(task);
  const targetArea = deriveTaskArea(task);
  if (targetTokens.size === 0) {
    return [];
  }

  return entries
    .filter((entry) => entry.success)
    .map((entry) => ({
      entry,
      similarity: computeTaskSimilarity(
        targetTokens,
        new Set(entry.taskTokens),
        entry.taskCategory === targetCategory,
        entry.fileArea === targetArea
      )
    }))
    .filter((entry) => entry.similarity >= SIMILARITY_THRESHOLD)
    .sort((left, right) => right.similarity - left.similarity || right.entry.timestamp.localeCompare(left.entry.timestamp))
    .slice(0, 5)
    .map(({ entry, similarity }) => ({
      task: entry.task,
      similarity,
      usedFiles: entry.usedFiles,
      timestamp: entry.timestamp
    }));
}

function computeTaskSimilarity(
  targetTokens: Set<string>,
  entryTokens: Set<string>,
  sameCategory: boolean,
  sameArea: boolean
): number {
  if (entryTokens.size === 0) {
    return 0;
  }

  const intersection = [...targetTokens].filter((token) => entryTokens.has(token)).length;
  const union = new Set([...targetTokens, ...entryTokens]).size;
  let similarity = union > 0 ? intersection / union : 0;
  if (sameCategory) {
    similarity += 0.15;
  }
  if (sameArea) {
    similarity += 0.15;
  }
  return Math.min(1, Math.round(similarity * 100) / 100);
}
