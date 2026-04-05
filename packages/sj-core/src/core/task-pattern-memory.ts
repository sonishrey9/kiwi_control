import path from "node:path";
import { ensureDir, pathExists, readJson, writeText } from "../utils/fs.js";

export interface TaskPatternRecord {
  task: string;
  taskTokens: string[];
  usedFiles: string[];
  timestamp: string;
  successCount: number;
}

export interface TaskPatternMemoryState {
  artifactType: "kiwi-control/task-pattern-memory";
  version: 1;
  updatedAt: string;
  patterns: TaskPatternRecord[];
}

const MAX_PATTERNS = 50;

function memoryPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "memory", "task-patterns.json");
}

export async function loadTaskPatternMemory(targetRoot: string): Promise<TaskPatternMemoryState> {
  const filePath = memoryPath(targetRoot);
  if (!(await pathExists(filePath))) {
    return {
      artifactType: "kiwi-control/task-pattern-memory",
      version: 1,
      updatedAt: new Date(0).toISOString(),
      patterns: []
    };
  }
  try {
    const state = await readJson<TaskPatternMemoryState>(filePath);
    if (state.artifactType !== "kiwi-control/task-pattern-memory" || state.version !== 1) {
      return {
        artifactType: "kiwi-control/task-pattern-memory",
        version: 1,
        updatedAt: new Date(0).toISOString(),
        patterns: []
      };
    }
    return state;
  } catch {
    return {
      artifactType: "kiwi-control/task-pattern-memory",
      version: 1,
      updatedAt: new Date(0).toISOString(),
      patterns: []
    };
  }
}

export async function recordTaskPattern(
  targetRoot: string,
  entry: {
    task: string;
    taskTokens: string[];
    usedFiles: string[];
    timestamp: string;
  }
): Promise<TaskPatternMemoryState> {
  const state = await loadTaskPatternMemory(targetRoot);
  const existing = state.patterns.find((pattern) => pattern.task === entry.task);
  const nextPatterns = existing
    ? state.patterns.map((pattern) =>
        pattern.task === entry.task
          ? {
              ...pattern,
              timestamp: entry.timestamp,
              usedFiles: [...new Set([...pattern.usedFiles, ...entry.usedFiles])].sort((left, right) => left.localeCompare(right)),
              successCount: pattern.successCount + 1
            }
          : pattern
      )
    : [
        {
          task: entry.task,
          taskTokens: entry.taskTokens,
          usedFiles: [...new Set(entry.usedFiles)].sort((left, right) => left.localeCompare(right)),
          timestamp: entry.timestamp,
          successCount: 1
        },
        ...state.patterns
      ].slice(0, MAX_PATTERNS);

  const nextState: TaskPatternMemoryState = {
    artifactType: "kiwi-control/task-pattern-memory",
    version: 1,
    updatedAt: new Date().toISOString(),
    patterns: nextPatterns
  };
  await persistTaskPatternMemory(targetRoot, nextState);
  return nextState;
}

export async function persistTaskPatternMemory(targetRoot: string, state: TaskPatternMemoryState): Promise<string> {
  const filePath = memoryPath(targetRoot);
  await ensureDir(path.dirname(filePath));
  await writeText(filePath, `${JSON.stringify(state, null, 2)}\n`);
  return filePath;
}
