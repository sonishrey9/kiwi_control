import path from "node:path";
import { promises as fs } from "node:fs";
import type { GitState } from "./git.js";
import { inspectGitState } from "./git.js";
import { computeAdaptiveWeights } from "./context-feedback.js";
import type { AdaptiveWeights } from "./context-feedback.js";
import { buildContextIndex } from "./context-index.js";
import { getMemoryPaths } from "./memory.js";
import { matchSkillsForTask } from "./skills-registry.js";
import { getStatePaths } from "./state.js";
import { classifyFileArea, deriveTaskArea, deriveTaskCategory } from "./task-intent.js";
import type {
  ContextTraceState,
  ExplainabilityReason,
  FileAnalysisEntry,
  IndexingState,
  SkippedPathEntry
} from "./context-trace.js";
import { persistContextTrace, persistIndexingState } from "./context-trace.js";
import { trimSelectionRedundancy } from "../integrations/token-efficiency.js";
import { pathExists, readText, writeText } from "../utils/fs.js";
import type { RepoContextAuthorityState } from "./context-tree.js";

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
  forwardDependencies?: string[];
  reverseDependencies?: string[];
  proximityFiles: string[];
  keywordMatches: string[];
  repoContextFiles: string[];
  dependencyDistances?: Record<string, number>;
  dependencyChains?: Record<string, string[]>;
  discovery?: ContextDiscoveryMetrics;
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
  version: 3;
  timestamp: string;
  task: string;
  include: string[];
  exclude: string[];
  reason: string;
  confidence: ContextConfidence;
  signals: ContextSignals;
}

interface DiscoveredSourceFile {
  file: string;
  mtime: number;
  depth: number;
}

export interface ContextDiscoveryMetrics {
  totalFiles: number;
  discoveredFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  skippedDirectories: number;
  visitedDirectories: number;
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

interface DiscoveryResult {
  files: DiscoveredSourceFile[];
  metrics: ContextDiscoveryMetrics;
}

interface ExplainabilityLedgerEntry {
  score: number;
  reasons: Set<ExplainabilityReason>;
}

interface RankedContextSelection extends ContextSelection {
  explainability: {
    fileAnalysis: {
      selected: FileAnalysisEntry[];
      excluded: FileAnalysisEntry[];
    };
    expansionSteps: ContextTraceState["expansionSteps"];
  };
}

interface PrecisionTrimmedFile {
  file: string;
  reason: ExplainabilityReason;
  note: string;
}

interface PrecisionRefinementResult {
  include: string[];
  reason: string | null;
  removed: PrecisionTrimmedFile[];
}

interface ConfidenceAssessment {
  level: ContextConfidence;
  signalDiversity: number;
  signalCoverage: number;
  discoveryBudgetLimited: boolean;
  maxDepthExplored: number;
}

interface SkillSignalState {
  activeSkillIds: string[];
  activeSkillKeywords: string[];
  activeSkillTemplates: string[];
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
  "dist", "dist-types", "build", "out", ".output", "_build", "lib-esm", "lib-cjs",
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
  ".playwright-cli", ".playwright-mcp",
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
  /^Thumbs\.db$/,
  /^\._/,
  /\.log$/i
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
const SCORE_REPO_CONTEXT = 8;
const SCORE_IMPORT_NEIGHBOR = 6;
const SCORE_CALL_DEPENDENCY = 7;
const SCORE_DEPENDENCY_DISTANCE_MAX = 5;
const SCORE_KEYWORD = 5;
const SCORE_ADAPTIVE_MAX = 4;
const SCORE_PROXIMITY = 3;
const SCORE_RECENT = 2;
const WEIGHT_DEPENDENCY = 0.4;
const WEIGHT_TASK_SIMILARITY = 0.25;
const WEIGHT_PAST_SUCCESS = 0.2;
const WEIGHT_RECENCY = 0.15;
const MIN_SELECTION_SCORE = 10;

const CONTEXT_TOKEN_BUDGET = 12_000;
const MAX_RECENT_FILES = 20;
const MAX_IMPORT_SEED_FILES = 15;
const DISCOVERY_FILE_BUDGET = 1_500;
const DISCOVERY_DIRECTORY_BUDGET = 600;
const DISCOVERY_PRIORITY_DIRECTORIES = [
  "packages",
  "apps",
  "src",
  "app",
  "lib",
  "features",
  "modules",
  "services",
  "components",
  "tests"
];

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function contextSelector(
  task: string,
  targetRoot: string,
  options: {
    expand?: boolean;
  } = {}
): Promise<ContextSelection> {
  const gitState = await inspectGitState(targetRoot);
  const worktree = await buildWorktreeState(targetRoot, gitState);
  const skillRegistry = await matchSkillsForTask(targetRoot, task).catch(() => null);
  const skillSignals: SkillSignalState = {
    activeSkillIds: skillRegistry?.activeSkills.map((skill) => skill.skillId) ?? [],
    activeSkillKeywords: skillRegistry?.activeSkills.flatMap((skill) => skill.triggerConditions) ?? [],
    activeSkillTemplates: skillRegistry?.activeSkills.flatMap((skill) => skill.executionTemplate) ?? []
  };
  const signals = await collectSignals(task, targetRoot, gitState, skillSignals);
  const adaptive = await computeAdaptiveWeights(targetRoot, task);
  const selection = await rankAndSelect(task, targetRoot, signals, adaptive, skillSignals, options);

  await persistWorktreeState(targetRoot, worktree);
  await persistContextSelection(targetRoot, task, selection, signals);
  if (signals.discovery) {
    await persistIndexingState(targetRoot, buildIndexingState(task, signals.discovery));
  }
  await persistContextTrace(targetRoot, buildContextTrace(task, selection, signals));

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
  git: GitState,
  skillSignals: SkillSignalState
): Promise<ContextSignals> {
  const authority = await loadContextAuthority(targetRoot);
  const changedFiles = git.changedFiles.filter(
    (f) => isSourceFile(f) && !isExcludedPath(f) && !isExcludedFile(f)
  );

  const discovery = await discoverSourceFiles(targetRoot);
  const recentFiles = collectRecentFiles(discovery.files, MAX_RECENT_FILES);
  let importNeighbors = await collectImportNeighbors(targetRoot, changedFiles);
  let discoveryMetrics = discovery.metrics;
  let dependencyDistances: Record<string, number> | undefined;
  let dependencyChains: Record<string, string[]> | undefined;
  let forwardDependencies: string[] | undefined;
  let reverseDependencies: string[] | undefined;

  try {
    const contextIndex = await buildContextIndex({
      targetRoot,
      discoveredFiles: discovery.files.map((entry) => ({
        file: entry.file,
        mtime: entry.mtime
      })),
      changedFiles
    });
    importNeighbors = contextIndex.lastImpact.impactedFiles;
    forwardDependencies = contextIndex.lastImpact.forwardDependencies;
    reverseDependencies = contextIndex.lastImpact.reverseDependencies;
    dependencyDistances = contextIndex.lastImpact.dependencyDistances;
    dependencyChains = contextIndex.lastImpact.dependencyChains;
    discoveryMetrics = {
      ...discovery.metrics,
      indexedFiles: contextIndex.indexedFiles,
      indexUpdatedFiles: contextIndex.updatedFiles.length,
      indexReusedFiles: contextIndex.reusedFiles,
      impactFiles: contextIndex.lastImpact.impactedFiles.length
    };
  } catch {
    // Fall back to direct changed-file import scanning when the incremental index is unavailable.
  }
  const authorityFiles = (authority?.criticalFiles ?? [])
    .filter((file) => !isExcludedPath(file) && !isExcludedFile(file));
  const selectiveAgentFiles = await collectSelectiveAgentFiles(targetRoot);
  const repoContextFiles = [...authorityFiles, ...selectiveAgentFiles]
    .filter((file, index, items) => items.indexOf(file) === index);

  const proximityFiles = collectProximityFiles(
    changedFiles,
    recentFiles
  );

  const keywordMatches = await collectKeywordMatches(
    task,
    discovery.files,
    changedFiles,
    recentFiles,
    skillSignals.activeSkillKeywords
  );

  return {
    changedFiles,
    recentFiles,
    importNeighbors,
    ...(forwardDependencies ? { forwardDependencies } : {}),
    ...(reverseDependencies ? { reverseDependencies } : {}),
    proximityFiles,
    keywordMatches,
    repoContextFiles,
    ...(dependencyDistances ? { dependencyDistances } : {}),
    ...(dependencyChains ? { dependencyChains } : {}),
    discovery: discoveryMetrics
  };
}

async function loadContextAuthority(targetRoot: string): Promise<RepoContextAuthorityState | null> {
  const authorityPath = path.join(targetRoot, ".agent", "context-authority.json");
  if (!(await pathExists(authorityPath))) {
    return null;
  }
  try {
    return JSON.parse(await readText(authorityPath)) as RepoContextAuthorityState;
  } catch {
    return null;
  }
}

async function discoverSourceFiles(targetRoot: string): Promise<DiscoveryResult> {
  const discovered: DiscoveredSourceFile[] = [];
  const pendingDirectories: Array<{ dir: string; depth: number }> = [{ dir: targetRoot, depth: 0 }];
  const ignoreRulesApplied = new Set<string>();
  const skipped: SkippedPathEntry[] = [];
  let visitedDirectories = 0;
  let maxDepthExplored = 0;
  let totalFiles = 0;
  let analyzedFiles = 0;
  let skippedFiles = 0;
  let skippedDirectories = 0;
  let partialScan = false;

  const noteSkipped = (entry: SkippedPathEntry): void => {
    if (skipped.length >= 20) {
      return;
    }
    skipped.push(entry);
  };

  while (pendingDirectories.length > 0) {
    if (visitedDirectories >= DISCOVERY_DIRECTORY_BUDGET || discovered.length >= DISCOVERY_FILE_BUDGET) {
      partialScan = true;
      break;
    }

    const current = pendingDirectories.shift();
    if (!current) {
      break;
    }

    visitedDirectories += 1;
    maxDepthExplored = Math.max(maxDepthExplored, current.depth);

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    const directories = entries
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => compareDiscoveryEntries(left.name, right.name));
    const files = entries
      .filter((entry) => entry.isFile())
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of directories) {
      const relativeDir = path.relative(targetRoot, path.join(current.dir, entry.name));

      if (entry.name.startsWith(".")) {
        skippedDirectories += 1;
        partialScan = true;
        ignoreRulesApplied.add("hidden directory");
        noteSkipped({ path: relativeDir, reason: "hidden directory rule" });
        continue;
      }

      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        skippedDirectories += 1;
        partialScan = true;
        ignoreRulesApplied.add(`directory ignore: ${entry.name}`);
        noteSkipped({ path: relativeDir, reason: `ignored directory (${entry.name})`, estimated: true });
        continue;
      }

      pendingDirectories.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
    }

    for (const entry of files) {
      if (!isSourceFile(entry.name)) {
        continue;
      }

      const fullPath = path.join(current.dir, entry.name);
      const relativePath = path.relative(targetRoot, fullPath);
      totalFiles += 1;

      if (isExcludedFile(entry.name)) {
        skippedFiles += 1;
        ignoreRulesApplied.add("file ignore pattern");
        noteSkipped({ path: relativePath, reason: "file ignore rule" });
        continue;
      }

      if (isExcludedPath(relativePath)) {
        skippedFiles += 1;
        partialScan = true;
        ignoreRulesApplied.add("path ignore rule");
        noteSkipped({ path: relativePath, reason: "path ignore rule" });
        continue;
      }

      try {
        const stat = await fs.stat(fullPath);
        discovered.push({
          file: relativePath,
          mtime: stat.mtimeMs,
          depth: current.depth
        });
        analyzedFiles += 1;
      } catch {
        continue;
      }

      if (discovered.length >= DISCOVERY_FILE_BUDGET) {
        break;
      }
    }
  }

  return {
    files: discovered,
    metrics: {
      totalFiles,
      discoveredFiles: discovered.length,
      analyzedFiles,
      skippedFiles,
      skippedDirectories,
      visitedDirectories,
      maxDepthExplored,
      fileBudgetReached: discovered.length >= DISCOVERY_FILE_BUDGET,
      directoryBudgetReached: visitedDirectories >= DISCOVERY_DIRECTORY_BUDGET,
      partialScan,
      ignoreRulesApplied: [...ignoreRulesApplied],
      skipped
    }
  };
}

function compareDiscoveryEntries(left: string, right: string): number {
  const leftPriority = discoveryPriority(left);
  const rightPriority = discoveryPriority(right);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return left.localeCompare(right);
}

function discoveryPriority(name: string): number {
  const index = DISCOVERY_PRIORITY_DIRECTORIES.indexOf(name.toLowerCase());
  return index === -1 ? DISCOVERY_PRIORITY_DIRECTORIES.length : index;
}

async function collectSelectiveAgentFiles(targetRoot: string): Promise<string[]> {
  const memoryPaths = getMemoryPaths(targetRoot);
  const statePaths = getStatePaths(targetRoot);
  const candidates = [
    memoryPaths.currentFocus,
    statePaths.latestCheckpointJson,
    memoryPaths.openRisks,
    memoryPaths.repoFacts
  ];
  const files: string[] = [];

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }
    const relativePath = path.relative(targetRoot, candidate);
    if (isExcludedFile(relativePath)) {
      continue;
    }
    files.push(relativePath);
  }

  return files;
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
  discoveredFiles: DiscoveredSourceFile[],
  changedFiles: string[],
  recentFiles: string[],
  extraKeywords: string[] = []
): Promise<string[]> {
  const keywords = [...new Set([...tokenizeTask(task), ...tokenizeTask(extraKeywords.join(" "))])];
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

  for (const { file } of discoveredFiles) {
    if (alreadyKnown.has(file)) continue;
    const score = scoreFileAgainstKeywords(file, keywords);
    if (score >= 2) {
      matches.push({ file, score });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((m) => m.file);
}

// ---------------------------------------------------------------------------
// Ranking & selection
// ---------------------------------------------------------------------------

async function rankAndSelect(
  task: string,
  targetRoot: string,
  signals: ContextSignals,
  adaptive: AdaptiveWeights,
  skillSignals: SkillSignalState,
  options: {
    expand?: boolean;
  } = {}
): Promise<RankedContextSelection> {
  const scored = new Map<string, number>();
  const explainabilityLedger = new Map<string, ExplainabilityLedgerEntry>();
  const keywords = [...new Set([...tokenizeTask(task), ...tokenizeTask(skillSignals.activeSkillKeywords.join(" "))])];
  const taskCategory = deriveTaskCategory(task);
  const taskArea = deriveTaskArea(task);
  const hardIncluded = new Set<string>(signals.changedFiles);

  const addScore = (file: string, amount: number, reason: ExplainabilityReason): void => {
    scored.set(file, (scored.get(file) ?? 0) + amount);
    const entry = explainabilityLedger.get(file) ?? { score: 0, reasons: new Set<ExplainabilityReason>() };
    entry.score = scored.get(file) ?? amount;
    entry.reasons.add(reason);
    explainabilityLedger.set(file, entry);
  };

  for (const file of signals.changedFiles) {
    addScore(file, SCORE_CHANGED, "changed file");
  }

  for (const file of signals.repoContextFiles) {
    addScore(file, SCORE_REPO_CONTEXT, "repo context");
  }

  for (const file of signals.reverseDependencies ?? []) {
    const dependencyDistance = signals.dependencyDistances?.[file] ?? 1;
    const dependencyValue = Math.min(1, 1 / dependencyDistance);
    addScore(file, Math.round((dependencyValue * adaptive.tunedWeights.dependency * 100) + 12), "import dependency");
    addScore(file, Math.round(dependencyValue * 10), "dependency distance");
  }

  for (const file of signals.forwardDependencies ?? []) {
    const dependencyDistance = signals.dependencyDistances?.[file] ?? 1;
    const dependencyValue = Math.min(1, 0.6 / dependencyDistance);
    const dependencyChain = signals.dependencyChains?.[file] ?? [];
    const dependencyReason: ExplainabilityReason = dependencyChain.length > 2 ? "call dependency" : "import dependency";
    addScore(file, Math.round((dependencyValue * adaptive.tunedWeights.dependency * 100) + 6), dependencyReason);
    addScore(file, Math.round(dependencyValue * 8), "dependency distance");
  }

  for (const file of signals.proximityFiles) {
    addScore(file, SCORE_PROXIMITY, "proximity");
  }

  for (const file of signals.recentFiles) {
    addScore(file, SCORE_RECENT, "recent file");
  }

  // Keyword scoring — applied to ALL candidates, using tokenized matching
  for (const [file] of scored) {
    const kwScore = scoreFileAgainstKeywords(file, keywords);
    if (kwScore > 0) {
      const normalizedKeyword = Math.min(1, kwScore / SCORE_KEYWORD);
      addScore(file, Math.round(normalizedKeyword * adaptive.tunedWeights.taskSimilarity * 100), "keyword match");
    }
  }

  // Keyword-only matches that weren't in other signals
  for (const file of signals.keywordMatches) {
    if (!scored.has(file)) {
      const kwScore = scoreFileAgainstKeywords(file, keywords);
      const normalizedKeyword = Math.min(1, kwScore / SCORE_KEYWORD);
      addScore(file, Math.round(normalizedKeyword * adaptive.tunedWeights.taskSimilarity * 100), "keyword match");
    }
  }

  // Adaptive feedback: boost historically useful files, penalize wasted ones
  for (const [file, boost] of adaptive.boosted) {
    if (scored.has(file)) {
      const normalizedBoost = Math.min(1, boost / SCORE_ADAPTIVE_MAX);
      addScore(file, Math.round(normalizedBoost * adaptive.tunedWeights.pastSuccess * 100), "adaptive boost");
      if (adaptive.basedOnPastRuns) {
        addScore(file, 0, "based on past runs");
        if (adaptive.reusedPattern) {
          addScore(file, 0, "reused pattern");
        }
      }
    }
  }
  for (const [file, penalty] of adaptive.penalized) {
    if (scored.has(file)) {
      const normalizedPenalty = Math.min(1, penalty / SCORE_ADAPTIVE_MAX);
      scored.set(file, Math.max(0, (scored.get(file) ?? 0) - Math.round(normalizedPenalty * adaptive.tunedWeights.pastSuccess * 100)));
      const entry = explainabilityLedger.get(file) ?? { score: 0, reasons: new Set<ExplainabilityReason>() };
      entry.score = scored.get(file) ?? 0;
      entry.reasons.add("adaptive penalty");
      explainabilityLedger.set(file, entry);
    }
  }

  for (const [file, score] of scored) {
    const taskFit = scoreFileForTask(file, taskCategory, taskArea);
    const normalizedTaskFit = taskFit > 0 ? Math.min(1, taskFit / SCORE_KEYWORD) : 0;
    scored.set(file, Math.max(0, score + Math.round(normalizedTaskFit * adaptive.tunedWeights.taskSimilarity * 100)));
    if (taskFit !== 0) {
      const entry = explainabilityLedger.get(file) ?? { score: 0, reasons: new Set<ExplainabilityReason>() };
      entry.score = scored.get(file) ?? 0;
      entry.reasons.add("task fit");
      explainabilityLedger.set(file, entry);
    }
  }

  const minimumSelectionScore = options.expand ? Math.max(4, Math.floor(MIN_SELECTION_SCORE * 0.6)) : MIN_SELECTION_SCORE;
  const tokenBudget = options.expand ? Math.round(CONTEXT_TOKEN_BUDGET * 1.5) : CONTEXT_TOKEN_BUDGET;
  const sorted = [...scored.entries()]
    .filter(([file, score]) => hardIncluded.has(file) || score >= minimumSelectionScore)
    .sort((a, b) => b[1] - a[1]);

  const includeBeforeTrim = await selectFilesWithinBudget(
    targetRoot,
    sorted,
    new Set([...signals.changedFiles, ...signals.repoContextFiles]),
    tokenBudget,
    maxSelectionCountForTask(task, options.expand)
  );
  const precisionRefinement = refineSelectionForTask(task, includeBeforeTrim, signals);
  const directSignals = new Set([
    ...signals.changedFiles,
    ...signals.importNeighbors,
    ...signals.keywordMatches,
    ...signals.repoContextFiles
  ]);
  const redundancyTrim = trimSelectionRedundancy(precisionRefinement.include, directSignals);
  const exclude = buildExcludeList();

  const confidenceAssessment = assessConfidence(signals, redundancyTrim.include);
  const confidence = confidenceAssessment.level;

  const topSignal = signals.changedFiles.length > 0
    ? "working tree changes"
    : signals.keywordMatches.length > 0
      ? "task keyword matching"
      : signals.recentFiles.length > 0
        ? "recently edited files"
        : "proximity heuristics";

  const reason =
    `Selected ${redundancyTrim.include.length} files based on ${topSignal}. ` +
      `Signals: ${signals.changedFiles.length} changed, ` +
      `${signals.importNeighbors.length} import neighbors, ` +
      `${signals.keywordMatches.length} keyword matches, ` +
      `${signals.repoContextFiles.length} repo context files, ` +
      `${signals.proximityFiles.length} proximity, ` +
      `${signals.recentFiles.length} recent, ` +
      `${skillSignals.activeSkillIds.length} active skills. ` +
      `${adaptive.basedOnPastRuns ? `Based on past runs from "${adaptive.reusedPattern ?? "similar work"}". ` : ""}` +
      `${precisionRefinement.reason ? `${precisionRefinement.reason} ` : ""}` +
      `${options.expand ? "Expanded scope mode is active. " : ""}` +
      `${redundancyTrim.note ? `${redundancyTrim.note} ` : ""}` +
      `Coverage: ${Math.round(confidenceAssessment.signalCoverage * 100)}% of candidate signal files. ` +
      `Diversity: ${confidenceAssessment.signalDiversity} signal types. ` +
      `Discovery depth: ${confidenceAssessment.maxDepthExplored}${confidenceAssessment.discoveryBudgetLimited ? " (budget-limited)" : ""}. ` +
      `Budget: ~${await estimateSelectionTokens(targetRoot, redundancyTrim.include)} tokens. ` +
      `Confidence: ${confidence}.`;

  const trimmedByFile = new Map(
    [
      ...precisionRefinement.removed.map((entry) => [entry.file, { note: entry.note, reason: entry.reason }] as const),
      ...redundancyTrim.removed.map((entry) => [entry.file, { note: entry.note, reason: "selection filter" as ExplainabilityReason }] as const)
    ]
  );
  const finalSelectedSet = new Set(redundancyTrim.include);
  const selected = redundancyTrim.include.map((file) =>
    buildFileAnalysisEntry(file, explainabilityLedger.get(file), [], undefined, signals.dependencyChains?.[file])
  );
  const excluded = sorted
    .filter(([file]) => !finalSelectedSet.has(file))
    .map(([file, score]) => {
      const trimmed = trimmedByFile.get(file);
      const baseReasons: ExplainabilityReason[] = trimmed
        ? [trimmed.reason]
        : [score <= 1 ? "low relevance" : "selection filter"];
      const note = trimmed?.note ?? (score <= 1
        ? "Signal strength stayed too weak to justify inclusion."
        : "The file did not make the bounded working set.");
      return buildFileAnalysisEntry(file, explainabilityLedger.get(file), baseReasons, note, signals.dependencyChains?.[file]);
    });

  return {
    include: redundancyTrim.include,
    exclude,
    reason,
    signals,
    confidence,
    explainability: {
      fileAnalysis: {
        selected,
        excluded
      },
      expansionSteps: buildExpansionSteps(
        signals,
        sorted,
        includeBeforeTrim,
        {
          include: redundancyTrim.include,
          removed: [
            ...precisionRefinement.removed,
            ...redundancyTrim.removed.map((entry) => ({
              file: entry.file,
              reason: "selection filter" as ExplainabilityReason,
              note: entry.note
            }))
          ],
          reason: [precisionRefinement.reason, redundancyTrim.note].filter(Boolean).join(" ").trim() || null
        },
        redundancyTrim.include
      )
    }
  };
}

async function selectFilesWithinBudget(
  targetRoot: string,
  rankedFiles: Array<[string, number]>,
  mustInclude: Set<string>,
  budgetTokens: number,
  maxFiles: number
): Promise<string[]> {
  const include: string[] = [];
  const included = new Set<string>();
  let totalTokens = 0;

  const orderedFiles = [
    ...rankedFiles.filter(([file]) => mustInclude.has(file)),
    ...rankedFiles.filter(([file]) => !mustInclude.has(file))
  ];

  for (const [file] of orderedFiles) {
    if (included.has(file)) {
      continue;
    }
    if (include.length >= maxFiles && !mustInclude.has(file)) {
      continue;
    }

    const estimatedTokens = await estimateFileTokens(targetRoot, file);
    const canFit = totalTokens + estimatedTokens <= budgetTokens;
    if (!canFit && include.length > 0 && !mustInclude.has(file)) {
      continue;
    }

    include.push(file);
    included.add(file);
    totalTokens += estimatedTokens;
  }

  return include;
}

function maxSelectionCountForTask(task: string, expand = false): number {
  const normalized = task.toLowerCase();
  const category = deriveTaskCategory(task);
  if (category === "docs") {
    return expand ? 12 : 8;
  }
  if (/\brefactor|migration|broad|cross-cutting|rewrite\b/i.test(normalized)) {
    return expand ? 45 : 30;
  }
  return expand ? 30 : 20;
}

async function estimateSelectionTokens(targetRoot: string, files: string[]): Promise<number> {
  let total = 0;
  for (const file of files) {
    total += await estimateFileTokens(targetRoot, file);
  }
  return total;
}

async function estimateFileTokens(targetRoot: string, relativePath: string): Promise<number> {
  try {
    const stat = await fs.stat(path.join(targetRoot, relativePath));
    return Math.max(1, Math.ceil(stat.size / 4));
  } catch {
    return 1;
  }
}

function assessConfidence(
  signals: ContextSignals,
  selected: string[]
): ConfidenceAssessment {
  if (selected.length === 0) {
    return {
      level: "low",
      signalDiversity: 0,
      signalCoverage: 0,
      discoveryBudgetLimited: Boolean(signals.discovery?.fileBudgetReached || signals.discovery?.directoryBudgetReached),
      maxDepthExplored: signals.discovery?.maxDepthExplored ?? 0
    };
  }

  const selectedSet = new Set(selected);
  const candidateSignalFiles = new Set([
    ...signals.changedFiles,
    ...signals.importNeighbors,
    ...signals.keywordMatches,
    ...signals.repoContextFiles,
    ...signals.proximityFiles
  ]);
  const coveredSignalFiles = [...candidateSignalFiles].filter((file) => selectedSet.has(file)).length;
  const signalCoverage = candidateSignalFiles.size > 0 ? coveredSignalFiles / candidateSignalFiles.size : 0;

  const hasChangedFiles = signals.changedFiles.length > 0;
  const hasImportNeighbors = signals.importNeighbors.length > 0;
  const hasKeywordMatches = signals.keywordMatches.length > 0;
  const hasRepoContextFiles = signals.repoContextFiles.length > 0;
  const hasProximityFiles = signals.proximityFiles.length > 0;
  const hasRecentFiles = signals.recentFiles.length > 0;
  const signalDiversity = [
    hasChangedFiles,
    hasImportNeighbors,
    hasKeywordMatches,
    hasRepoContextFiles,
    hasProximityFiles
  ].filter(Boolean).length;

  const discoveryBudgetLimited = Boolean(
    signals.discovery?.fileBudgetReached || signals.discovery?.directoryBudgetReached
  );
  const maxDepthExplored = signals.discovery?.maxDepthExplored ?? 0;

  let level: ContextConfidence = "low";

  if (
    hasChangedFiles &&
    (hasImportNeighbors || hasRepoContextFiles) &&
    signalDiversity >= 3 &&
    signalCoverage >= 0.6 &&
    !discoveryBudgetLimited
  ) {
    level = "high";
  } else if (
    (hasChangedFiles && signalDiversity >= 2 && signalCoverage >= 0.4) ||
    (hasKeywordMatches && signalDiversity >= 2 && signalCoverage >= 0.5 && maxDepthExplored >= 4)
  ) {
    level = "medium";
  } else if (hasChangedFiles && signalCoverage >= 0.25) {
    level = "medium";
  } else if (hasKeywordMatches && hasRecentFiles && signalCoverage >= 0.5 && maxDepthExplored >= 4 && !discoveryBudgetLimited) {
    level = "medium";
  }

  if (discoveryBudgetLimited && level === "high") {
    level = "medium";
  }

  if (!hasChangedFiles && signalDiversity < 2) {
    level = "low";
  }

  if (!hasChangedFiles && maxDepthExplored < 4 && level === "medium") {
    level = "low";
  }

  return {
    level,
    signalDiversity,
    signalCoverage,
    discoveryBudgetLimited,
    maxDepthExplored
  };
}

function buildFileAnalysisEntry(
  file: string,
  ledgerEntry: ExplainabilityLedgerEntry | undefined,
  fallbackReasons: ExplainabilityReason[],
  note?: string,
  dependencyChain?: string[]
): FileAnalysisEntry {
  const reasons = uniqueReasons([
    ...(ledgerEntry ? [...ledgerEntry.reasons] : []),
    ...fallbackReasons
  ]);
  const selectionWhy = buildSelectionWhy(reasons, dependencyChain, note);

  return {
    file,
    reasons,
    ...(typeof ledgerEntry?.score === "number" ? { score: ledgerEntry.score } : {}),
    ...(note ? { note } : {}),
    ...(selectionWhy ? { selectionWhy } : {}),
    ...(dependencyChain && dependencyChain.length > 1 ? { dependencyChain } : {})
  };
}

function buildSelectionWhy(
  reasons: ExplainabilityReason[],
  dependencyChain?: string[],
  note?: string
): string | undefined {
  const readableReasons = reasons.slice(0, 3).join(", ");
  if (dependencyChain && dependencyChain.length > 1) {
    return `Selected because of ${readableReasons}. Dependency chain: ${dependencyChain.join(" -> ")}.`;
  }
  if (note) {
    return `Selected because of ${readableReasons}. ${note}`;
  }
  if (readableReasons) {
    return `Selected because of ${readableReasons}.`;
  }
  return undefined;
}

function buildExpansionSteps(
  signals: ContextSignals,
  sorted: Array<[string, number]>,
  includeBeforeTrim: string[],
  precisionRefinement: PrecisionRefinementResult,
  finalSelection: string[]
): ContextTraceState["expansionSteps"] {
  const seedFiles = uniqueFiles([
    ...signals.changedFiles,
    ...signals.importNeighbors,
    ...signals.keywordMatches,
    ...signals.repoContextFiles,
    ...signals.proximityFiles
  ]);
  const expandedCandidates = uniqueFiles(sorted.map(([file]) => file));

  const steps: ContextTraceState["expansionSteps"] = [
    {
      step: "initial signals",
      summary:
        `Seeded selection from ${signals.changedFiles.length} changed, ` +
        `${signals.importNeighbors.length} import, ${signals.keywordMatches.length} keyword, ` +
        `${signals.proximityFiles.length} proximity, and ${signals.repoContextFiles.length} repo-context signals.`,
      filesAdded: seedFiles.slice(0, 12)
    },
    {
      step: "expansion",
      summary:
        `Expanded the working set to ${expandedCandidates.length} candidate files using weighted signals and task-fit heuristics` +
        (signals.discovery?.indexedFiles
          ? ` while reusing an incremental import index (${signals.discovery.indexUpdatedFiles ?? 0} updated, ${signals.discovery.indexReusedFiles ?? 0} reused).`
          : ".") +
        (signals.dependencyChains && Object.keys(signals.dependencyChains).length > 0
          ? ` Shortest dependency chains were used for ${Object.keys(signals.dependencyChains).length} structurally related files.`
          : ""),
      filesAdded: expandedCandidates.slice(0, 12)
    },
    {
      step: "budget selection",
      summary: `Selected ${includeBeforeTrim.length} files within the bounded context budget before task-specific precision trimming.`,
      filesAdded: includeBeforeTrim
    }
  ];

  if (precisionRefinement.removed.length > 0) {
    steps.push({
      step: "precision trim",
      summary: precisionRefinement.reason ?? "Removed low-relevance files after scoring.",
      filesAdded: finalSelection,
      filesRemoved: precisionRefinement.removed.map((entry) => entry.file)
    });
  }

  return steps;
}

function buildContextTrace(
  task: string,
  selection: RankedContextSelection,
  signals: ContextSignals
): ContextTraceState {
  const discovery = signals.discovery;
  const scannedFiles = selection.explainability.fileAnalysis.selected.length + selection.explainability.fileAnalysis.excluded.length;
  const skippedFiles = discovery?.skipped.length ?? 0;
  return {
    artifactType: "kiwi-control/context-trace",
    version: 1,
    timestamp: new Date().toISOString(),
    task,
    fileAnalysis: {
      totalFiles: scannedFiles + skippedFiles,
      scannedFiles,
      skippedFiles,
      selectedFiles: selection.explainability.fileAnalysis.selected.length,
      excludedFiles: selection.explainability.fileAnalysis.excluded.length,
      selected: selection.explainability.fileAnalysis.selected,
      excluded: selection.explainability.fileAnalysis.excluded,
      skipped: discovery?.skipped ?? []
    },
    initialSignals: {
      changedFiles: signals.changedFiles,
      recentFiles: signals.recentFiles,
      importNeighbors: signals.importNeighbors,
      proximityFiles: signals.proximityFiles,
      keywordMatches: signals.keywordMatches,
      repoContextFiles: signals.repoContextFiles,
      ...(signals.dependencyDistances ? { dependencyDistances: signals.dependencyDistances } : {}),
      ...(signals.dependencyChains ? { dependencyChains: signals.dependencyChains } : {})
    },
    expansionSteps: selection.explainability.expansionSteps,
    finalSelection: {
      include: selection.include,
      excludePatterns: selection.exclude,
      reason: selection.reason,
      confidence: selection.confidence
    },
    honesty: {
      heuristic: true,
      lowConfidence: selection.confidence === "low",
      partialScan: Boolean(discovery?.partialScan || discovery?.fileBudgetReached || discovery?.directoryBudgetReached)
    }
  };
}

function buildIndexingState(task: string, discovery: ContextDiscoveryMetrics): IndexingState {
  return {
    artifactType: "kiwi-control/indexing",
    version: 1,
    timestamp: new Date().toISOString(),
    task,
    totalFiles: discovery.totalFiles,
    discoveredFiles: discovery.discoveredFiles,
    analyzedFiles: discovery.analyzedFiles,
    skippedFiles: discovery.skippedFiles,
    visitedDirectories: discovery.visitedDirectories,
    skippedDirectories: discovery.skippedDirectories,
    maxDepthExplored: discovery.maxDepthExplored,
    fileBudgetReached: discovery.fileBudgetReached,
    directoryBudgetReached: discovery.directoryBudgetReached,
    partialScan: discovery.partialScan,
    ignoreRulesApplied: discovery.ignoreRulesApplied,
    skipped: discovery.skipped,
    ...(typeof discovery.indexedFiles === "number" ? { indexedFiles: discovery.indexedFiles } : {}),
    ...(typeof discovery.indexUpdatedFiles === "number" ? { indexUpdatedFiles: discovery.indexUpdatedFiles } : {}),
    ...(typeof discovery.indexReusedFiles === "number" ? { indexReusedFiles: discovery.indexReusedFiles } : {}),
    ...(typeof discovery.impactFiles === "number" ? { impactFiles: discovery.impactFiles } : {})
  };
}

function uniqueFiles(files: string[]): string[] {
  return [...new Set(files)];
}

function uniqueReasons(reasons: ExplainabilityReason[]): ExplainabilityReason[] {
  return [...new Set(reasons)];
}

function refineSelectionForTask(
  task: string,
  selected: string[],
  signals: ContextSignals
): PrecisionRefinementResult {
  const taskCategory = deriveTaskCategory(task);
  const taskArea = deriveTaskArea(task);
  const precisionSensitiveCategories = new Set(["docs", "testing", "config", "ui", "implementation"]);

  if (!precisionSensitiveCategories.has(taskCategory)) {
    return { include: selected, reason: null, removed: [] };
  }

  const repoContextFiles = new Set(signals.repoContextFiles);
  const directSignals = new Set([
    ...signals.changedFiles,
    ...signals.importNeighbors,
    ...signals.keywordMatches
  ]);
  const hasAreaAlignedDirectSignal = [...directSignals].some((file) => classifyFileArea(file) === taskArea);

  if (!hasAreaAlignedDirectSignal) {
    return { include: selected, reason: null, removed: [] };
  }

  const scopedPrefixes = deriveScopedPrefixes([...directSignals].filter((file) => classifyFileArea(file) === taskArea), taskArea);

  const refined: string[] = [];
  const removed: PrecisionTrimmedFile[] = [];
  let trimmedPassiveFiles = 0;
  let trimmedAuthorityFiles = 0;
  let trimmedOutOfScopeFiles = 0;

  for (const file of selected) {
    if (repoContextFiles.has(file) || directSignals.has(file)) {
      refined.push(file);
      continue;
    }

    if (isAuthorityInstructionFile(file)) {
      trimmedAuthorityFiles += 1;
      removed.push({
        file,
        reason: "passive authority",
        note: "Authority guidance existed, but a stronger task-aligned signal already covered this area."
      });
      continue;
    }

    if (classifyFileArea(file) !== taskArea) {
      trimmedPassiveFiles += 1;
      removed.push({
        file,
        reason: "file-type mismatch",
        note: `This ${classifyFileArea(file)} file did not match the ${taskArea} task area.`
      });
      continue;
    }

     if (!matchesScopedPrefixes(file, scopedPrefixes)) {
      trimmedOutOfScopeFiles += 1;
      removed.push({
        file,
        reason: "out-of-directory",
        note: "This file sat outside the strongest task-aligned directory prefix."
      });
      continue;
    }

    refined.push(file);
  }

  const trimmedFiles = trimmedPassiveFiles + trimmedAuthorityFiles + trimmedOutOfScopeFiles;
  const trimReasons: string[] = [];
  if (trimmedPassiveFiles > 0) {
    trimReasons.push(`${trimmedPassiveFiles} file-type mismatch${trimmedPassiveFiles === 1 ? "" : "es"}`);
  }
  if (trimmedAuthorityFiles > 0) {
    trimReasons.push(`${trimmedAuthorityFiles} passive authorit${trimmedAuthorityFiles === 1 ? "y file" : "y files"}`);
  }
  if (trimmedOutOfScopeFiles > 0) {
    trimReasons.push(`${trimmedOutOfScopeFiles} out-of-directory file${trimmedOutOfScopeFiles === 1 ? "" : "s"}`);
  }

  return {
    include: refined,
    reason: trimmedFiles > 0
      ? `Precision trim removed ${trimmedFiles} low-relevance file${trimmedFiles === 1 ? "" : "s"} for this ${taskCategory} task (${trimReasons.join(", ")}).`
      : null,
    removed
  };
}

function scoreFileForTask(filePath: string, taskCategory: ReturnType<typeof deriveTaskCategory>, taskArea: ReturnType<typeof deriveTaskArea>): number {
  const fileArea = classifyFileArea(filePath);

  if (fileArea === taskArea) {
    return 2;
  }

  if (isAuthorityInstructionFile(filePath) && taskCategory !== "general") {
    return -2;
  }

  if (taskCategory === "implementation" && fileArea !== "application") {
    return -1;
  }

  if (taskCategory !== "implementation" && fileArea !== taskArea && fileArea !== "context") {
    return -1;
  }

  return 0;
}

function deriveScopedPrefixes(files: string[], taskArea: ReturnType<typeof deriveTaskArea>): string[] {
  const prefixes = new Set<string>();

  for (const file of files) {
    if (taskArea !== "application" && taskArea !== "docs") {
      continue;
    }

    const directory = path.dirname(file).replace(/\\/g, "/");
    if (!directory || directory === ".") {
      continue;
    }

    prefixes.add(directory);
  }

  return [...prefixes];
}

function matchesScopedPrefixes(filePath: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) {
    return true;
  }

  const normalized = filePath.replace(/\\/g, "/");
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function isAuthorityInstructionFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const basename = path.basename(normalized);

  return basename === "agents.md"
    || basename === "claude.md"
    || basename === "copilot-instructions.md"
    || normalized.startsWith(".github/instructions/")
    || normalized.startsWith(".github/agents/");
}

// ---------------------------------------------------------------------------
// Exclude list builder
// ---------------------------------------------------------------------------

function buildExcludeList(): string[] {
  return [
    // Directory exclusions (as globs)
    ...[...EXCLUDED_DIRECTORIES]
      .filter((directory) => directory !== ".agent")
      .map((d) => `**/${d}/**`),
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
    "**/.env*",
    "**/.agent/tasks/**",
    "**/.agent/state/history/**",
    "**/.agent/state/handoff/**",
    "**/.agent/state/dispatch/**"
  ];
}

// ---------------------------------------------------------------------------
// Recent files collection
// ---------------------------------------------------------------------------

function collectRecentFiles(
  discoveredFiles: DiscoveredSourceFile[],
  limit: number
): string[] {
  return [...discoveredFiles]
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((candidate) => candidate.file);
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
    version: 3,
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
