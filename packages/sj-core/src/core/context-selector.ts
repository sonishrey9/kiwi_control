import path from "node:path";
import { promises as fs } from "node:fs";
import type { GitState } from "./git.js";
import { inspectGitState } from "./git.js";
import { pathExists, readText, writeText } from "../utils/fs.js";

export interface ContextSelection {
  include: string[];
  exclude: string[];
  reason: string;
  signals: ContextSignals;
}

export interface ContextSignals {
  changedFiles: string[];
  recentFiles: string[];
  importNeighbors: string[];
  proximityFiles: string[];
}

export interface WorktreeState {
  artifactType: "kiwi-control/worktree";
  version: 1;
  timestamp: string;
  targetRoot: string;
  changed_files: string[];
  recent_files: string[];
  dirty: boolean;
  branch: string | null;
  headCommit: string | null;
}

export interface ContextSelectionState {
  artifactType: "kiwi-control/context-selection";
  version: 1;
  timestamp: string;
  task: string;
  include: string[];
  exclude: string[];
  reason: string;
  signals: ContextSignals;
}

const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".env",
  "coverage",
  ".nyc_output",
  ".cache",
  "target",
  ".turbo"
];

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".swift", ".c", ".cpp", ".h", ".hpp",
  ".css", ".scss", ".less",
  ".html", ".vue", ".svelte",
  ".json", ".yaml", ".yml", ".toml",
  ".md", ".mdx",
  ".sql", ".graphql", ".gql",
  ".sh", ".bash", ".zsh"
]);

export async function contextSelector(
  task: string,
  targetRoot: string
): Promise<ContextSelection> {
  const gitState = await inspectGitState(targetRoot);
  const worktree = buildWorktreeState(targetRoot, gitState);
  const signals = await collectSignals(task, targetRoot, gitState);
  const selection = rankAndSelect(task, targetRoot, signals);

  await persistWorktreeState(targetRoot, worktree);
  await persistContextSelection(targetRoot, task, selection, signals);

  return selection;
}

function buildWorktreeState(targetRoot: string, git: GitState): WorktreeState {
  return {
    artifactType: "kiwi-control/worktree",
    version: 1,
    timestamp: new Date().toISOString(),
    targetRoot,
    changed_files: git.changedFiles,
    recent_files: [],
    dirty: !git.clean,
    branch: git.branch ?? null,
    headCommit: git.headCommit ?? null
  };
}

async function collectSignals(
  task: string,
  targetRoot: string,
  git: GitState
): Promise<ContextSignals> {
  const changedFiles = git.changedFiles.filter(
    (f) => isSourceFile(f) && !isExcludedPath(f)
  );

  const recentFiles = await collectRecentFiles(targetRoot, 20);

  const importNeighbors = await collectImportNeighbors(
    targetRoot,
    changedFiles
  );

  const proximityFiles = collectProximityFiles(
    targetRoot,
    changedFiles,
    recentFiles
  );

  return {
    changedFiles,
    recentFiles,
    importNeighbors,
    proximityFiles
  };
}

function rankAndSelect(
  task: string,
  targetRoot: string,
  signals: ContextSignals
): ContextSelection {
  const scored = new Map<string, number>();
  const taskLower = task.toLowerCase();

  for (const file of signals.changedFiles) {
    scored.set(file, (scored.get(file) ?? 0) + 10);
  }

  for (const file of signals.importNeighbors) {
    scored.set(file, (scored.get(file) ?? 0) + 6);
  }

  for (const file of signals.proximityFiles) {
    scored.set(file, (scored.get(file) ?? 0) + 3);
  }

  for (const file of signals.recentFiles) {
    scored.set(file, (scored.get(file) ?? 0) + 2);
  }

  for (const [file, score] of scored) {
    const basename = path.basename(file).toLowerCase();
    if (taskLower.includes(basename.replace(/\.[^.]+$/, ""))) {
      scored.set(file, score + 4);
    }
  }

  const sorted = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([file]) => file);

  const include = sorted.slice(0, 30);

  const exclude = buildExcludeList(targetRoot, include);

  const topSignal = signals.changedFiles.length > 0
    ? "working tree changes"
    : signals.recentFiles.length > 0
      ? "recently edited files"
      : "task keyword matching";

  const reason = `Selected ${include.length} files based on ${topSignal}. ` +
    `Signals: ${signals.changedFiles.length} changed, ` +
    `${signals.importNeighbors.length} import neighbors, ` +
    `${signals.proximityFiles.length} proximity, ` +
    `${signals.recentFiles.length} recent.`;

  return { include, exclude, reason, signals };
}

function buildExcludeList(targetRoot: string, included: string[]): string[] {
  const includeSet = new Set(included);
  const excludeDirs = DEFAULT_EXCLUDE_PATTERNS.map(
    (p) => path.join(targetRoot, p)
  );

  return [
    ...excludeDirs,
    "**/*.lock",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.map",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml"
  ];
}

async function collectRecentFiles(
  targetRoot: string,
  limit: number
): Promise<string[]> {
  const candidates: Array<{ file: string; mtime: number }> = [];

  async function scanDir(dir: string, depth: number): Promise<void> {
    if (depth > 3) return;

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || DEFAULT_EXCLUDE_PATTERNS.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath, depth + 1);
        continue;
      }

      if (!isSourceFile(entry.name)) continue;

      try {
        const stat = await fs.stat(fullPath);
        const relativePath = path.relative(targetRoot, fullPath);
        candidates.push({ file: relativePath, mtime: stat.mtimeMs });
      } catch {
        continue;
      }
    }
  }

  await scanDir(targetRoot, 0);

  return candidates
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((c) => c.file);
}

async function collectImportNeighbors(
  targetRoot: string,
  changedFiles: string[]
): Promise<string[]> {
  const neighbors = new Set<string>();

  for (const file of changedFiles.slice(0, 10)) {
    const fullPath = path.join(targetRoot, file);
    const ext = path.extname(file);

    if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"].includes(ext)) {
      continue;
    }

    let content: string;
    try {
      content = await readText(fullPath);
    } catch {
      continue;
    }

    const imports = extractImports(content, ext);

    for (const imp of imports) {
      const resolved = resolveImportPath(targetRoot, file, imp);
      if (resolved && !changedFiles.includes(resolved)) {
        neighbors.add(resolved);
      }
    }
  }

  return [...neighbors];
}

function extractImports(content: string, ext: string): string[] {
  const imports: string[] = [];

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    const esImports = content.matchAll(
      /(?:import|export)\s+.*?from\s+["']([^"']+)["']/g
    );
    for (const match of esImports) {
      if (match[1] && isRelativeImport(match[1])) {
        imports.push(match[1]);
      }
    }

    const requires = content.matchAll(
      /require\s*\(\s*["']([^"']+)["']\s*\)/g
    );
    for (const match of requires) {
      if (match[1] && isRelativeImport(match[1])) {
        imports.push(match[1]);
      }
    }
  }

  if (ext === ".py") {
    const fromImports = content.matchAll(
      /from\s+(\.\S+)\s+import/g
    );
    for (const match of fromImports) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }

  return imports;
}

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function resolveImportPath(
  targetRoot: string,
  sourceFile: string,
  importSpecifier: string
): string | null {
  const sourceDir = path.dirname(sourceFile);
  let resolved = path.normalize(path.join(sourceDir, importSpecifier));

  resolved = resolved.replace(/\.js$/, "");

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    const relativePath = candidate.startsWith(targetRoot)
      ? path.relative(targetRoot, candidate)
      : candidate;
    if (isSourceFile(relativePath)) {
      return relativePath;
    }
  }

  const indexCandidates = extensions.map(
    (ext) => path.join(resolved, `index${ext}`)
  );
  for (const candidate of indexCandidates) {
    const relativePath = candidate.startsWith(targetRoot)
      ? path.relative(targetRoot, candidate)
      : candidate;
    if (isSourceFile(relativePath)) {
      return relativePath;
    }
  }

  return resolved;
}

function collectProximityFiles(
  targetRoot: string,
  changedFiles: string[],
  recentFiles: string[]
): string[] {
  const siblingDirs = new Set<string>();
  for (const file of changedFiles) {
    siblingDirs.add(path.dirname(file));
  }

  return recentFiles.filter((file) => {
    const dir = path.dirname(file);
    return siblingDirs.has(dir) && !changedFiles.includes(file);
  });
}

function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function isExcludedPath(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.some((part) => DEFAULT_EXCLUDE_PATTERNS.includes(part));
}

async function persistWorktreeState(
  targetRoot: string,
  worktree: WorktreeState
): Promise<string> {
  const statePath = path.join(targetRoot, ".agent", "state", "worktree.json");
  await writeText(statePath, `${JSON.stringify(worktree, null, 2)}\n`);
  return statePath;
}

async function persistContextSelection(
  targetRoot: string,
  task: string,
  selection: ContextSelection,
  signals: ContextSignals
): Promise<string> {
  const statePath = path.join(
    targetRoot,
    ".agent",
    "state",
    "context-selection.json"
  );
  const record: ContextSelectionState = {
    artifactType: "kiwi-control/context-selection",
    version: 1,
    timestamp: new Date().toISOString(),
    task,
    include: selection.include,
    exclude: selection.exclude,
    reason: selection.reason,
    signals
  };
  await writeText(statePath, `${JSON.stringify(record, null, 2)}\n`);
  return statePath;
}
