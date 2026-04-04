import path from "node:path";

export interface TokenEfficiencyTrimmedFile {
  file: string;
  note: string;
}

export interface TokenEfficiencySelectionResult {
  include: string[];
  removed: TokenEfficiencyTrimmedFile[];
  note: string | null;
}

const SHORT_ENABLE_PHRASES: Array<[RegExp, string]> = [
  [/\bRun the project build and verify it succeeds\./g, "Run the build."],
  [/\bRun affected tests and verify they pass\./g, "Run affected tests."],
  [/\bRun existing tests to verify no regressions\./g, "Run tests."],
  [/\bReview the diff for scope creep — revert unrelated changes\./g, "Review the diff for unrelated changes."],
  [/\bNo over-explaining — keep responses focused on the goal\./g, "No over-explaining — keep responses focused on the goal."],
  [/\bRead each file before editing — never write blind\./g, "Read each file before editing — never write blind."],
  [/\bMinimal edits only — change only what the goal requires\./g, "Minimal edits only — change only what the goal requires."],
  [/\bNo refactoring unless the goal explicitly requires it\./g, "No refactoring unless the goal explicitly requires it."],
  [/\bDo not create files unless the goal requires new functionality\./g, "Do not create files unless required."]
];

export function optimizeInstructionLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const optimized: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      continue;
    }

    for (const [pattern, replacement] of SHORT_ENABLE_PHRASES) {
      line = line.replace(pattern, replacement);
    }

    if (seen.has(line)) {
      continue;
    }

    seen.add(line);
    optimized.push(line);
  }

  return optimized;
}

export function compressInstructionText(text: string): string {
  let compressed = text;
  for (const [pattern, replacement] of SHORT_ENABLE_PHRASES) {
    compressed = compressed.replace(pattern, replacement);
  }
  return compressed
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function trimSelectionRedundancy(
  selectedFiles: string[],
  directSignalFiles: Set<string>
): TokenEfficiencySelectionResult {
  const groupedByDirectory = new Map<string, string[]>();

  for (const file of selectedFiles) {
    const directory = path.dirname(file).replace(/\\/g, "/");
    const group = groupedByDirectory.get(directory) ?? [];
    group.push(file);
    groupedByDirectory.set(directory, group);
  }

  const keep = new Set<string>();
  const removed: TokenEfficiencyTrimmedFile[] = [];

  for (const files of groupedByDirectory.values()) {
    const direct = files.filter((file) => directSignalFiles.has(file));
    const passive = files.filter((file) => !directSignalFiles.has(file));

    if (direct.length === 0 || passive.length <= 1) {
      for (const file of files) {
        keep.add(file);
      }
      continue;
    }

    for (const file of direct) {
      keep.add(file);
    }
    keep.add(passive[0] as string);

    for (const file of passive.slice(1)) {
      removed.push({
        file,
        note: "Redundancy trim removed this passive sibling because a stronger file in the same directory already covers the area."
      });
    }
  }

  const include = selectedFiles.filter((file) => keep.has(file));
  return {
    include,
    removed,
    note: removed.length > 0
      ? `Token optimization removed ${removed.length} redundant sibling file${removed.length === 1 ? "" : "s"} from the bounded working set.`
      : null
  };
}
