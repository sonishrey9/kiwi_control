import path from "node:path";
import { promises as fs } from "node:fs";
import type { GitState } from "./git.js";
import { inspectGitState } from "./git.js";
import { pathExists, readText, writeText } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ContextSelection {
  include: string[];
  exclude: string[];
  reason: string;
  signals: ContextSignals;
  confidence: ContextConfidence;
}

export interface ContextSignals {
  changedFiles: string[];
  recentFiles: string[];
  importNeighbors: string[];
  proximityFiles: string[];
  keywordMatches: string[];
}

export type ContextConfidence = "high" | "medium" | "low";

export interface WorktreeState {
  artifactType: "kiwi-control/worktree";
  version: 2;
  timestamp: string;
  targetRoot: string;
  changed_files: string[];
  recent_files: string[];
  dirty: boolean;
  branch: string | null;
  headCommit: string | null;
  branchAge: number | null;
  hasCheckpoint: boolean;
  stagedFiles: string[];
  untrackedFiles: string[];
}

export interface ContextSelectionState {
  artifactType: "kiwi-control/context-selection";
  version: 2;
  timestamp: string;
  task: string;
  include: string[];
  exclude: string[];
  reason: string;
  confidence: ContextConfidence;
  signals: ContextSignals;
}

// ---------------------------------------------------------------------------
// Exclude patterns — aggressive artifact filtering
// ---------------------------------------------------------------------------

/** Directories that are never relevant source context. */
const EXCLUDED_DIRECTORIES = new Set([
  // Package managers & dependencies
  "node_modules", ".pnpm", "bower_components", "jspm_packages",
  // Version control
  ".git", ".svn", ".hg",
  // Build outputs
  "dist", "build", "out", ".output", "_build", "lib-esm", "lib-cjs",
  // Framework caches & outputs
  ".next", ".nuxt", ".svelte-kit", ".vercel", ".netlify", ".turbo",
  ".parcel-cache", ".webpack", ".rollup.cache", ".vite",
  // Python
  "__pycache__", ".venv", "venv", "env", ".eggs", "*.egg-info",
  ".mypy_cache", ".pytest_cache", ".ruff_cache", ".tox",
  // Rust / C
  "target", "cmake-build-debug", "cmake-build-release",
  // Java / Kotlin
  ".gradle", ".idea",
  // Test coverage & reports
  "coverage", ".nyc_output", "htmlcov", "lcov-report",
  // Caches & temp
  ".cache", ".tmp", "tmp", "temp", ".temp",
  // IDE & OS
  ".vscode", ".idea", ".vs",
  // Environment / secrets
  ".env", ".envrc",
  // iOS / Android
  "Pods", ".expo",
  // Misc generated
  "vendor", "storybook-static", ".docusaurus",
  // Shrey Junior artifacts
  ".agent"
]);

/** File‐level globs that are never relevant. */
const EXCLUDED_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  // Lockfiles
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^Cargo\.lock$/,
  /^Gemfile\.lock$/,
  /^poetry\.lock$/,
  /^composer\.lock$/,
  /^Pipfile\.lock$/,
  /^go\.sum$/,
  /^flake\.lock$/,
  // Minified / bundled
  /\.min\.(js|css)$/,
  /\.bundle\.(js|css)$/,
  /\.chunk\.(js|css)$/,
  // Source maps
  /\.map$/,
  // Generated type declarations from build
  /\.d\.ts$/,
  /\.d\.mts$/,
  /\.d\.cts$/,
  // tsbuildinfo
  /tsconfig.*\.tsbuildinfo$/,
  // Screenshots / images (binary noise)
  /\.(png|jpg|jpeg|gif|bmp|ico|webp|avif|svg)$/i,
  // Fonts
  /\.(woff2?|ttf|eot|otf)$/i,
  // Videos / audio
  /\.(mp4|webm|ogg|mp3|wav|flac)$/i,
  // Archives
  /\.(zip|tar|gz|bz2|7z|rar|tgz)$/i,
  // Compiled / binary
  /\.(o|a|so|dylib|dll|exe|wasm|pyc|pyo|class)$/i,
  // Editor swap / backup
  /\.sw[a-p]$/,
  /~$/,
  // Env files (secrets)
  /^\.env(\..+)?$/,
  // DB files
  /\.(sqlite|sqlite3|db)$/,
  // Release artifacts
  /^CHANGELOG\.md$/i,
  /^LICENSE(\.md|\.txt)?$/i,
  // OS junk
  /^\.DS_Store$/,
  /^Thumbs\.db$/
];

// ---------------------------------------------------------------------------
// Source file detection
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".kts",
  ".swift", ".c", ".cpp", ".h", ".hpp", ".cc",
  ".css", ".scss", ".less", ".sass",
  ".html", ".vue", ".svelte", ".astro",
  ".json", ".yaml", ".yml", ".toml",
  ".md", ".mdx",
  ".sql", ".graphql", ".gql",
  ".sh", ".bash", ".zsh",
  ".prisma", ".proto", ".tf", ".hcl"
]);

const IMPORTABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"
]);

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const SCORE_CHANGED = 10;
const SCORE_IMPORT_NEIGHBOR = 6;
const SCORE_KEYWORD = 5;
const SCORE_PROXIMITY = 3;
const SCORE_RECENT = 2;

const MAX_SELECTED_FILES = 30;
const MAX_RECENT_FILES = 20;
const RECENT_SCAN_DEPTH = 3;
const MAX_IMPORT_SEED_FILES = 15;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function contextSelector(
  task: string,
  targetRoot: string
): Promise<ContextSelection> {
  const gitState = await inspectGitState(targetRoot);
  const worktree = await buildWorktreeState(targetRoot, gitState);
  const signals = await collectSignals(task, targetRoot, gitState);
  const selection = rankAndSelect(task, targetRoot, signals);

  await persistWorktreeState(targetRoot, worktree);
  await persistContextSelection(targetRoot, task, selection, signals);

  return selection;
}

// ---------------------------------------------------------------------------
// Worktree state — branch-aware, checkpoint-aware
// ---------------------------------------------------------------------------

async function buildWorktreeState(
  targetRoot: string,
  git: GitState
): Promise<WorktreeState> {
  const checkpointPath = path.join(targetRoot, ".agent", "state", "checkpoints", "latest.json");
  const hasCheckpoint = await pathExists(checkpointPath);

  let branchAge: number | null = null;
  if (git.branch && git.isGitRepo) {
    branchAge = await estimateBranchAge(targetRoot, git.branch);
  }

  return {
    artifactType: "kiwi-control/worktree",
    version: 2,
    timestamp: new Date().toISOString(),
    targetRoot,
    changed_files: git.changedFiles,
    recent_files: [],
    dirty: !git.clean,
    branch: git.branch ?? null,
    headCommit: git.headCommit ?? null,
    branchAge,
    hasCheckpoint,
    stagedFiles: git.stagedFiles ?? [],
    untrackedFiles: git.untrackedFiles ?? []
  };
}

async function estimateBranchAge(
  targetRoot: string,
  branch: string
): Promise<number | null> {
  try {
    const { runCommand } = await import("../utils/child-process.js");
    const result = await runCommand(
      "git", ["log", "--format=%ct", "--reverse", `${branch}`, "--not", "--remotes=origin/main", "--remotes=origin/master", "-1"],
      targetRoot
    );
    if (result.code === 0 && result.stdout.trim()) {
      const firstCommitEpoch = Number.parseInt(result.stdout.trim(), 10);
      return Math.floor((Date.now() / 1000 - firstCommitEpoch) / 86400);
    }
  } catch {
    // Not critical — return null
  }
  return null;
}

// ---------------------------------------------------------------------------
// Signal collection
// ---------------------------------------------------------------------------

async function collectSignals(
  task: string,
  targetRoot: string,
  git: GitState
): Promise<ContextSignals> {
  const changedFiles = git.changedFiles.filter(
    (f) => isSourceFile(f) && !isExcludedPath(f) && !isExcludedFile(f)
  );

  const recentFiles = await collectRecentFiles(targetRoot, MAX_RECENT_FILES);

  const importNeighbors = await collectImportNeighbors(
    targetRoot,
    changedFiles
  );

  const proximityFiles = collectProximityFiles(
    changedFiles,
    recentFiles
  );

  const keywordMatches = await collectKeywordMatches(
    task,
    targetRoot,
    changedFiles,
    recentFiles
  );

  return {
    changedFiles,
    recentFiles,
    importNeighbors,
    proximityFiles,
    keywordMatches
  };
}

// ---------------------------------------------------------------------------
// Keyword matching — tokenized, multi-word, case-insensitive
// ---------------------------------------------------------------------------

function tokenizeTask(task: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "need", "must",
    "it", "its", "this", "that", "these", "those", "my", "your", "his",
    "her", "our", "their", "what", "which", "who", "whom", "how", "when",
    "where", "why", "all", "each", "every", "both", "few", "more", "some",
    "any", "no", "not", "only", "same", "so", "than", "too", "very",
    "just", "about", "above", "after", "before", "between", "into",
    "through", "during", "up", "down", "out", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "also",
    // Common task verbs that don't help with file matching
    "fix", "update", "add", "remove", "delete", "change", "modify",
    "implement", "create", "make", "refactor", "improve", "ensure"
  ]);

  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, " ")
    .split(/[\s\-_]+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

function scoreFileAgainstKeywords(filePath: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const basename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dirParts = path.dirname(filePath).toLowerCase().split(path.sep);
  const allParts = [basename, ...dirParts].join(" ");

  // Split camelCase/PascalCase and kebab-case into tokens
  const fileTokens = allParts
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_./\\]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  let matchCount = 0;
  for (const keyword of keywords) {
    // Exact token match
    if (fileTokens.some((t) => t === keyword)) {
      matchCount += 2;
      continue;
    }
    // Substring match (weaker)
    if (fileTokens.some((t) => t.includes(keyword) || keyword.includes(t))) {
      matchCount += 1;
    }
  }

  return matchCount;
}

async function collectKeywordMatches(
  task: string,
  targetRoot: string,
  changedFiles: string[],
  recentFiles: string[]
): Promise<string[]> {
  const keywords = tokenizeTask(task);
  if (keywords.length === 0) return [];

  const alreadyKnown = new Set([...changedFiles, ...recentFiles]);
  const matches: Array<{ file: string; score: number }> = [];

  // Score all known files
  for (const file of alreadyKnown) {
    const score = scoreFileAgainstKeywords(file, keywords);
    if (score > 0) {
      matches.push({ file, score });
    }
  }

  // Also scan top-level source directories for keyword matches
  const topDirs = await listSourceDirectories(targetRoot);
  for (const dir of topDirs) {
    const files = await shallowSourceFiles(path.join(targetRoot, dir), targetRoot, 2);
    for (const file of files) {
      if (alreadyKnown.has(file)) continue;
      const score = scoreFileAgainstKeywords(file, keywords);
      if (score >= 2) {
        matches.push({ file, score });
      }
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((m) => m.file);
}

async function listSourceDirectories(targetRoot: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    const entries = await fs.readdir(targetRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      dirs.push(entry.name);
    }
  } catch {
    // Ignore read errors
  }
  return dirs;
}

async function shallowSourceFiles(
  dir: string,
  targetRoot: string,
  maxDepth: number
): Promise<string[]> {
  const results: string[] = [];

  async function scan(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath, depth + 1);
        continue;
      }

      if (!isSourceFile(entry.name) || isExcludedFile(entry.name)) continue;
      results.push(path.relative(targetRoot, fullPath));
    }
  }

  await scan(dir, 0);
  return results;
}

// ---------------------------------------------------------------------------
// Ranking & selection
// ---------------------------------------------------------------------------

function rankAndSelect(
  task: string,
  targetRoot: string,
  signals: ContextSignals
): ContextSelection {
  const scored = new Map<string, number>();
  const keywords = tokenizeTask(task);

  for (const file of signals.changedFiles) {
    scored.set(file, (scored.get(file) ?? 0) + SCORE_CHANGED);
  }

  for (const file of signals.importNeighbors) {
    scored.set(file, (scored.get(file) ?? 0) + SCORE_IMPORT_NEIGHBOR);
  }

  for (const file of signals.proximityFiles) {
    scored.set(file, (scored.get(file) ?? 0) + SCORE_PROXIMITY);
  }

  for (const file of signals.recentFiles) {
    scored.set(file, (scored.get(file) ?? 0) + SCORE_RECENT);
  }

  // Keyword scoring — applied to ALL candidates, using tokenized matching
  for (const [file] of scored) {
    const kwScore = scoreFileAgainstKeywords(file, keywords);
    if (kwScore > 0) {
      scored.set(file, (scored.get(file) ?? 0) + Math.min(kwScore, SCORE_KEYWORD));
    }
  }

  // Keyword-only matches that weren't in other signals
  for (const file of signals.keywordMatches) {
    if (!scored.has(file)) {
      const kwScore = scoreFileAgainstKeywords(file, keywords);
      scored.set(file, Math.min(kwScore, SCORE_KEYWORD));
    }
  }

  const sorted = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([file]) => file);

  const include = sorted.slice(0, MAX_SELECTED_FILES);
  const exclude = buildExcludeList();

  const confidence = assessConfidence(signals, include);

  const topSignal = signals.changedFiles.length > 0
    ? "working tree changes"
    : signals.keywordMatches.length > 0
      ? "task keyword matching"
      : signals.recentFiles.length > 0
        ? "recently edited files"
        : "proximity heuristics";

  const reason =
    `Selected ${include.length} files based on ${topSignal}. ` +
    `Signals: ${signals.changedFiles.length} changed, ` +
    `${signals.importNeighbors.length} import neighbors, ` +
    `${signals.keywordMatches.length} keyword matches, ` +
    `${signals.proximityFiles.length} proximity, ` +
    `${signals.recentFiles.length} recent. ` +
    `Confidence: ${confidence}.`;

  return { include, exclude, reason, signals, confidence };
}

function assessConfidence(
  signals: ContextSignals,
  selected: string[]
): ContextConfidence {
  if (selected.length === 0) return "low";

  const hasChangedFiles = signals.changedFiles.length > 0;
  const hasImportNeighbors = signals.importNeighbors.length > 0;
  const hasKeywordMatches = signals.keywordMatches.length > 0;

  const signalCount = [hasChangedFiles, hasImportNeighbors, hasKeywordMatches]
    .filter(Boolean).length;

  if (signalCount >= 2 && hasChangedFiles) return "high";
  if (signalCount >= 1 && (hasChangedFiles || hasKeywordMatches)) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Exclude list builder
// ---------------------------------------------------------------------------

function buildExcludeList(): string[] {
  return [
    // Directory exclusions (as globs)
    ...[...EXCLUDED_DIRECTORIES].map((d) => `**/${d}/**`),
    // File pattern exclusions
    "**/*.lock",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.bundle.js",
    "**/*.chunk.js",
    "**/*.map",
    "**/*.d.ts",
    "**/*.d.mts",
    "**/*.d.cts",
    "**/tsconfig*.tsbuildinfo",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/Cargo.lock",
    "**/go.sum",
    "**/.DS_Store",
    "**/*.pyc",
    "**/*.pyo",
    "**/*.wasm",
    "**/*.sqlite*",
    "**/.env*"
  ];
}

// ---------------------------------------------------------------------------
// Recent files collection
// ---------------------------------------------------------------------------

async function collectRecentFiles(
  targetRoot: string,
  limit: number
): Promise<string[]> {
  const candidates: Array<{ file: string; mtime: number }> = [];

  async function scanDir(dir: string, depth: number): Promise<void> {
    if (depth > RECENT_SCAN_DEPTH) return;

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath, depth + 1);
        continue;
      }

      if (!isSourceFile(entry.name) || isExcludedFile(entry.name)) continue;

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

// ---------------------------------------------------------------------------
// Import neighbor collection — with existence verification
// ---------------------------------------------------------------------------

async function collectImportNeighbors(
  targetRoot: string,
  changedFiles: string[]
): Promise<string[]> {
  const neighbors = new Set<string>();

  for (const file of changedFiles.slice(0, MAX_IMPORT_SEED_FILES)) {
    const fullPath = path.join(targetRoot, file);
    const ext = path.extname(file);

    if (!IMPORTABLE_EXTENSIONS.has(ext)) continue;

    let content: string;
    try {
      content = await readText(fullPath);
    } catch {
      continue;
    }

    const imports = extractImports(content, ext);

    for (const imp of imports) {
      const resolved = await resolveImportPath(targetRoot, file, imp);
      if (resolved && !changedFiles.includes(resolved) && !isExcludedPath(resolved)) {
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

    // Dynamic imports
    const dynamicImports = content.matchAll(
      /import\s*\(\s*["']([^"']+)["']\s*\)/g
    );
    for (const match of dynamicImports) {
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

/** Resolve an import specifier to a real file path, verifying it exists. */
async function resolveImportPath(
  targetRoot: string,
  sourceFile: string,
  importSpecifier: string
): Promise<string | null> {
  const sourceDir = path.dirname(sourceFile);
  let resolved = path.normalize(path.join(sourceDir, importSpecifier));

  // Strip .js extension (common in ESM TypeScript)
  resolved = resolved.replace(/\.js$/, "");

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

  // Try direct file match
  for (const ext of extensions) {
    const candidate = resolved + ext;
    const fullCandidate = path.join(targetRoot, candidate);
    if (await pathExists(fullCandidate)) {
      return candidate;
    }
  }

  // Try index file match
  for (const ext of extensions) {
    const candidate = path.join(resolved, `index${ext}`);
    const fullCandidate = path.join(targetRoot, candidate);
    if (await pathExists(fullCandidate)) {
      return candidate;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Proximity — sibling directory files
// ---------------------------------------------------------------------------

function collectProximityFiles(
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

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function isExcludedPath(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.some((part) => EXCLUDED_DIRECTORIES.has(part));
}

function isExcludedFile(fileName: string): boolean {
  const basename = path.basename(fileName);
  return EXCLUDED_FILE_PATTERNS.some((re) => re.test(basename));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

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
    version: 2,
    timestamp: new Date().toISOString(),
    task,
    include: selection.include,
    exclude: selection.exclude,
    reason: selection.reason,
    confidence: selection.confidence,
    signals
  };
  await writeText(statePath, `${JSON.stringify(record, null, 2)}\n`);
  return statePath;
}
