import path from "node:path";
import type { ContextSelectionState } from "./context-selector.js";
import { pathExists, readJson } from "../utils/fs.js";

export interface PreparedScope {
  task: string;
  allowedFiles: string[];
  timestamp: string;
}

export interface ScopeValidationResult {
  ok: boolean;
  touchedFiles: string[];
  outOfScopeFiles: string[];
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export async function loadPreparedScope(targetRoot: string): Promise<PreparedScope | null> {
  const selectionPath = path.join(targetRoot, ".agent", "state", "context-selection.json");
  if (!(await pathExists(selectionPath))) {
    return null;
  }

  const selection = await readJson<ContextSelectionState>(selectionPath);
  return {
    task: selection.task,
    allowedFiles: selection.include.map(normalizePath),
    timestamp: selection.timestamp
  };
}

export function validateTouchedFilesAgainstAllowedFiles(
  allowedFiles: string[],
  touchedFiles: string[]
): ScopeValidationResult {
  const allowedSet = new Set(allowedFiles.map(normalizePath));
  const normalizedTouched = [...new Set(touchedFiles.map(normalizePath))];
  const relevantTouched = normalizedTouched.filter((filePath) => !filePath.startsWith(".agent/"));
  const outOfScopeFiles = relevantTouched.filter((filePath) => !allowedSet.has(filePath));

  return {
    ok: outOfScopeFiles.length === 0,
    touchedFiles: relevantTouched,
    outOfScopeFiles
  };
}
