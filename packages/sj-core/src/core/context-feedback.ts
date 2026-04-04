import path from "node:path";
import { pathExists, readJson, writeText } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextFeedbackEntry {
  task: string;
  timestamp: string;
  selectedFiles: string[];
  usedFiles: string[];
  unusedFiles: string[];
  success: boolean;
  confidence: string;
  tokensSaved: number;
}

export interface ContextFeedbackState {
  artifactType: "kiwi-control/context-feedback";
  version: 1;
  entries: ContextFeedbackEntry[];
  fileScores: Record<string, number>;
  totalRuns: number;
  successRate: number;
}

export interface AdaptiveWeights {
  boosted: Map<string, number>;
  penalized: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 50;
const BOOST_PER_USE = 2;
const PENALTY_PER_WASTE = -1;
const DECAY_FACTOR = 0.9;

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
      version: 1,
      entries: [],
      fileScores: {},
      totalRuns: 0,
      successRate: 0
    };
  }
  return readJson<ContextFeedbackState>(fp);
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
  entry: Omit<ContextFeedbackEntry, "timestamp">
): Promise<ContextFeedbackState> {
  const state = await loadContextFeedback(targetRoot);

  const fullEntry: ContextFeedbackEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };

  // Add entry, trim to max
  const entries = [fullEntry, ...state.entries].slice(0, MAX_ENTRIES);

  // Recompute file scores: decay existing, then apply new feedback
  const fileScores: Record<string, number> = {};

  // Decay all existing scores
  for (const [file, score] of Object.entries(state.fileScores)) {
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
    version: 1,
    entries,
    fileScores,
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
  targetRoot: string
): Promise<AdaptiveWeights> {
  const state = await loadContextFeedback(targetRoot);
  const boosted = new Map<string, number>();
  const penalized = new Map<string, number>();

  for (const [file, score] of Object.entries(state.fileScores)) {
    if (score > 0) {
      boosted.set(file, score);
    } else if (score < 0) {
      penalized.set(file, Math.abs(score));
    }
  }

  return { boosted, penalized };
}

// ---------------------------------------------------------------------------
// Feedback summary for UI/CLI
// ---------------------------------------------------------------------------

export interface FeedbackSummary {
  totalRuns: number;
  successRate: number;
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

export async function buildFeedbackSummary(targetRoot: string): Promise<FeedbackSummary> {
  const state = await loadContextFeedback(targetRoot);

  const recentEntries = state.entries.slice(0, 5).map((e) => ({
    task: e.task,
    success: e.success,
    filesSelected: e.selectedFiles.length,
    filesUsed: e.usedFiles.length,
    filesWasted: e.unusedFiles.length,
    timestamp: e.timestamp
  }));

  const scored = Object.entries(state.fileScores)
    .map(([file, score]) => ({ file, score }))
    .sort((a, b) => b.score - a.score);

  const topBoostedFiles = scored.filter((s) => s.score > 0).slice(0, 5);
  const topPenalizedFiles = scored
    .filter((s) => s.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => ({ file: s.file, score: Math.abs(s.score) }));

  return {
    totalRuns: state.totalRuns,
    successRate: state.successRate,
    recentEntries,
    topBoostedFiles,
    topPenalizedFiles
  };
}
