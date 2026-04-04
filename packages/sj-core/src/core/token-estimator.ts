import path from "node:path";
import { promises as fs } from "node:fs";
import { getMemoryPaths } from "./memory.js";
import { getStatePaths } from "./state.js";
import { deriveTaskCategory } from "./task-intent.js";
import { pathExists, readText, writeText } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EstimationMethod = "rough estimate (chars/4 heuristic)";

export interface TokenEstimate {
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  estimationMethod: EstimationMethod;
  estimateNote: string;
  fileBreakdown: Array<{
    file: string;
    tokens: number;
    selected: boolean;
  }>;
  directoryBreakdown: Array<{
    directory: string;
    tokens: number;
    fileCount: number;
    selectedTokens: number;
    selectedFileCount: number;
  }>;
  wastedFiles: WastedFileReport;
  heavyDirectories: HeavyDirectoryReport;
  tokenBreakdown: TokenBreakdownState;
}

export interface WastedFileReport {
  files: Array<{ file: string; tokens: number; reason: string }>;
  totalWastedTokens: number;
  removalSavingsPercent: number;
}

export interface HeavyDirectoryReport {
  directories: Array<{
    directory: string;
    tokens: number;
    fileCount: number;
    percentOfRepo: number;
    suggestion: string;
  }>;
}

export interface TokenUsageState {
  artifactType: "kiwi-control/token-usage";
  version: 3;
  timestamp: string;
  task: string;
  selected_tokens: number;
  full_repo_tokens: number;
  savings_percent: number;
  file_count_selected: number;
  file_count_total: number;
  estimation_method: EstimationMethod;
  estimate_note: string;
  top_directories: Array<{ directory: string; tokens: number; fileCount: number }>;
  wasted_files: Array<{ file: string; tokens: number; reason: string }>;
  wasted_tokens_total: number;
  wasted_removal_savings_percent: number;
  heavy_directories: Array<{
    directory: string;
    tokens: number;
    fileCount: number;
    percentOfRepo: number;
    suggestion: string;
  }>;
}

export interface TokenReductionCategory {
  category: "node_modules" | "dist" | "skipped dirs" | "selection filter";
  estimated_tokens_avoided: number;
  file_count: number;
  basis: "measured" | "heuristic";
  note: string;
}

export interface TokenBreakdownState {
  artifactType: "kiwi-control/token-breakdown";
  version: 1;
  timestamp: string;
  task: string;
  selected_tokens: number;
  full_repo_tokens: number;
  savings_percent: number;
  partial_scan: boolean;
  categories: TokenReductionCategory[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;
const ESTIMATION_METHOD: EstimationMethod = "rough estimate (chars/4 heuristic)";
const ESTIMATE_NOTE =
  "Estimated token counts use a chars/4 heuristic. File counts are measured directly; token counts and savings percentages are approximate, and pricing is intentionally not shown.";
const SKIPPED_DIR_SCAN_LIMIT = 400;

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".output",
  "__pycache__", ".venv", "venv", "coverage", ".turbo",
  ".nyc_output", ".cache", "target", ".agent",
  ".pnpm", ".parcel-cache", ".svelte-kit", ".nuxt",
  ".gradle", ".idea", ".vscode", "vendor",
  "storybook-static", "htmlcov", ".mypy_cache",
  ".pytest_cache", ".ruff_cache", ".tox"
]);

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

/** Files that inflate token counts but aren't real source. */
const SKIP_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  /\.min\.(js|css)$/,
  /\.bundle\.(js|css)$/,
  /\.chunk\.(js|css)$/,
  /\.d\.ts$/,
  /\.d\.mts$/,
  /\.d\.cts$/,
  /\.map$/,
  /tsconfig.*\.tsbuildinfo$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Cargo\.lock$/,
  /go\.sum$/
];

// ---------------------------------------------------------------------------
// Main estimator
// ---------------------------------------------------------------------------

export async function estimateTokens(
  targetRoot: string,
  selectedFiles: string[],
  task = ""
): Promise<TokenEstimate> {
  const collected = await collectSourceFiles(targetRoot);
  const allFiles = collected.files;
  const selectedSet = new Set(selectedFiles.map((f) => normalizePath(f)));

  const fileBreakdown: TokenEstimate["fileBreakdown"] = [];
  let selectedTokens = 0;
  let fullRepoTokens = 0;

  // Directory accumulator
  const dirMap = new Map<string, {
    tokens: number;
    fileCount: number;
    selectedTokens: number;
    selectedFileCount: number;
  }>();

  for (const file of allFiles) {
    const fullPath = path.join(targetRoot, file);
    let content: string;
    try {
      content = await readText(fullPath);
    } catch {
      continue;
    }

    const tokens = estimateCharTokens(content);
    const isSelected = selectedSet.has(normalizePath(file));

    fileBreakdown.push({ file, tokens, selected: isSelected });
    fullRepoTokens += tokens;

    if (isSelected) {
      selectedTokens += tokens;
    }

    // Accumulate directory stats
    const dir = path.dirname(file) || ".";
    const existing = dirMap.get(dir) ?? { tokens: 0, fileCount: 0, selectedTokens: 0, selectedFileCount: 0 };
    existing.tokens += tokens;
    existing.fileCount += 1;
    if (isSelected) {
      existing.selectedTokens += tokens;
      existing.selectedFileCount += 1;
    }
    dirMap.set(dir, existing);
  }

  const savingsPercent = fullRepoTokens > 0
    ? Math.round(((fullRepoTokens - selectedTokens) / fullRepoTokens) * 100)
    : 0;

  const directoryBreakdown = [...dirMap.entries()]
    .map(([directory, stats]) => ({ directory, ...stats }))
    .sort((a, b) => b.tokens - a.tokens);

  const wastedFiles = detectWastedFiles(fileBreakdown, task);
  const heavyDirectories = detectHeavyDirectories(directoryBreakdown, fullRepoTokens, task);
  const tokenBreakdown = await buildTokenBreakdown(
    targetRoot,
    task,
    selectedTokens,
    fullRepoTokens,
    savingsPercent,
    collected.skippedDirectories
  );

  return {
    selectedTokens,
    fullRepoTokens,
    savingsPercent,
    estimationMethod: ESTIMATION_METHOD,
    estimateNote: ESTIMATE_NOTE,
    fileBreakdown,
    directoryBreakdown,
    wastedFiles,
    heavyDirectories,
    tokenBreakdown
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateCharTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isSkippedFile(name: string): boolean {
  return SKIP_FILE_PATTERNS.some((re) => re.test(name));
}

async function collectSourceFiles(targetRoot: string): Promise<{ files: string[]; skippedDirectories: string[] }> {
  const files: string[] = [];
  const skippedDirectories = new Set<string>();

  async function scanDir(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".agent") continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          skippedDirectories.add(normalizePath(path.relative(targetRoot, fullPath)));
          continue;
        }
        await scanDir(fullPath, depth + 1);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      if (isSkippedFile(entry.name)) continue;

      const relativePath = path.relative(targetRoot, fullPath);
      files.push(relativePath);
    }
  }

  await scanDir(targetRoot, 0);

  const selectiveAgentFiles = await collectSelectiveAgentFiles(targetRoot);
  for (const file of selectiveAgentFiles) {
    if (!files.includes(file)) {
      files.push(file);
    }
  }

  return { files, skippedDirectories: [...skippedDirectories] };
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
  const included: string[] = [];

  for (const absolutePath of candidates) {
    if (await pathExists(absolutePath)) {
      included.push(normalizePath(path.relative(targetRoot, absolutePath)));
    }
  }

  return included;
}

// ---------------------------------------------------------------------------
// Wasted file detection
// ---------------------------------------------------------------------------

function detectWastedFiles(
  fileBreakdown: TokenEstimate["fileBreakdown"],
  task: string
): WastedFileReport {
  const wasted: WastedFileReport["files"] = [];
  const taskCategory = deriveTaskCategory(task);

  for (const entry of fileBreakdown) {
    if (!entry.selected) continue;

    const basename = path.basename(entry.file);
    const reason = classifyPotentialWaste(entry.file, basename, taskCategory);
    if (reason) {
      wasted.push({ file: entry.file, tokens: entry.tokens, reason });
    }

    // Large files that may be wasteful
    if (entry.tokens > 5000 && !wasted.some((w) => w.file === entry.file)) {
      wasted.push({
        file: entry.file,
        tokens: entry.tokens,
        reason: `Large file (${Math.round(entry.tokens / 1000)}K tokens) — verify it is needed`
      });
    }
  }

  const totalWastedTokens = wasted.reduce((s, w) => s + w.tokens, 0);
  const selectedTokens = fileBreakdown
    .filter((f) => f.selected)
    .reduce((s, f) => s + f.tokens, 0);
  const removalSavingsPercent = selectedTokens > 0
    ? Math.round((totalWastedTokens / selectedTokens) * 100)
    : 0;

  return {
    files: wasted.sort((a, b) => b.tokens - a.tokens).slice(0, 10),
    totalWastedTokens,
    removalSavingsPercent
  };
}

function classifyPotentialWaste(
  filePath: string,
  basename: string,
  taskCategory: ReturnType<typeof deriveTaskCategory>
): string | null {
  if (/\.stories\.(ts|js|tsx|jsx)$/.test(filePath)) {
    return "Storybook story in context — verify it is needed for this task";
  }

  if (
    taskCategory !== "testing" &&
    (/\.test\.(ts|js|tsx|jsx)$/.test(filePath) || /\.spec\.(ts|js|tsx|jsx)$/.test(filePath) || filePath.includes("__tests__/"))
  ) {
    return "Test file outside a testing task — verify it is needed";
  }

  if (
    taskCategory !== "docs" &&
    (basename.toLowerCase() === "readme.md" || /\.mdx?$/.test(filePath))
  ) {
    return "Documentation file outside a docs task — verify it is needed";
  }

  if (
    taskCategory !== "config" &&
    taskCategory !== "release" &&
    isConfigLikeFile(filePath)
  ) {
    return "Config file outside a config or release task — verify it is needed";
  }

  return null;
}

function isConfigLikeFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return (
    /(^|\/)(tsconfig|eslint|prettier|vite|webpack|rollup|babel|jest|vitest|playwright|tailwind|postcss|docker-compose|deno|cargo|ruff|mypy|pyproject|tox|\.github\/workflows)\b/.test(normalized) ||
    normalized.endsWith(".config.ts") ||
    normalized.endsWith(".config.js") ||
    normalized.endsWith(".config.mjs") ||
    normalized.endsWith(".config.cjs") ||
    normalized.endsWith(".yaml") ||
    normalized.endsWith(".yml") ||
    normalized.endsWith(".toml")
  );
}

// ---------------------------------------------------------------------------
// Heavy directory detection
// ---------------------------------------------------------------------------

const HEAVY_DIR_THRESHOLD_PERCENT = 15;

function detectHeavyDirectories(
  directoryBreakdown: TokenEstimate["directoryBreakdown"],
  fullRepoTokens: number,
  task: string
): HeavyDirectoryReport {
  const directories: HeavyDirectoryReport["directories"] = [];
  const taskCategory = deriveTaskCategory(task);

  for (const dir of directoryBreakdown) {
    const percentOfRepo = fullRepoTokens > 0
      ? Math.round((dir.tokens / fullRepoTokens) * 100)
      : 0;

    if (percentOfRepo >= HEAVY_DIR_THRESHOLD_PERCENT) {
      let suggestion: string;
      if (dir.directory.includes("gen") || dir.directory.includes("generated")) {
        suggestion = "Generated directory — exclude from context selection";
      } else if (taskCategory !== "testing" && (dir.directory.includes("test") || dir.directory.includes("spec"))) {
        suggestion = "Test directory — exclude unless task is about testing";
      } else if (taskCategory !== "docs" && (dir.directory.includes("doc") || dir.directory.includes("docs"))) {
        suggestion = "Documentation directory — exclude for code-only tasks";
      } else {
        suggestion = `Contains ${percentOfRepo}% of repo tokens — consider adding to exclude patterns`;
      }

      directories.push({
        directory: dir.directory,
        tokens: dir.tokens,
        fileCount: dir.fileCount,
        percentOfRepo,
        suggestion
      });
    }
  }

  return { directories: directories.slice(0, 5) };
}

async function buildTokenBreakdown(
  targetRoot: string,
  task: string,
  selectedTokens: number,
  fullRepoTokens: number,
  savingsPercent: number,
  skippedDirectories: string[]
): Promise<TokenBreakdownState> {
  const nodeModulesDirs = skippedDirectories.filter((directory) => path.basename(directory) === "node_modules");
  const distDirs = skippedDirectories.filter((directory) => ["dist", "build", ".next", ".output"].includes(path.basename(directory)));
  const otherSkippedDirs = skippedDirectories.filter(
    (directory) => !nodeModulesDirs.includes(directory) && !distDirs.includes(directory)
  );

  const [nodeModulesEstimate, distEstimate, skippedDirEstimate] = await Promise.all([
    estimateSkippedDirectoryTokens(targetRoot, nodeModulesDirs),
    estimateSkippedDirectoryTokens(targetRoot, distDirs),
    estimateSkippedDirectoryTokens(targetRoot, otherSkippedDirs)
  ]);

  const selectionFilterSavings = Math.max(0, fullRepoTokens - selectedTokens);

  return {
    artifactType: "kiwi-control/token-breakdown",
    version: 1,
    timestamp: new Date().toISOString(),
    task,
    selected_tokens: selectedTokens,
    full_repo_tokens: fullRepoTokens,
    savings_percent: savingsPercent,
    partial_scan: nodeModulesEstimate.partial || distEstimate.partial || skippedDirEstimate.partial,
    categories: [
      {
        category: "selection filter",
        estimated_tokens_avoided: selectionFilterSavings,
        file_count: 0,
        basis: "measured",
        note: "Measured reduction from selecting a bounded working set instead of every scanned file."
      },
      {
        category: "node_modules",
        estimated_tokens_avoided: nodeModulesEstimate.tokens,
        file_count: nodeModulesEstimate.fileCount,
        basis: "heuristic",
        note: nodeModulesEstimate.note
      },
      {
        category: "dist",
        estimated_tokens_avoided: distEstimate.tokens,
        file_count: distEstimate.fileCount,
        basis: "heuristic",
        note: distEstimate.note
      },
      {
        category: "skipped dirs",
        estimated_tokens_avoided: skippedDirEstimate.tokens,
        file_count: skippedDirEstimate.fileCount,
        basis: "heuristic",
        note: skippedDirEstimate.note
      }
    ]
  };
}

async function estimateSkippedDirectoryTokens(
  targetRoot: string,
  directories: string[]
): Promise<{ tokens: number; fileCount: number; partial: boolean; note: string }> {
  if (directories.length === 0) {
    return {
      tokens: 0,
      fileCount: 0,
      partial: false,
      note: "No matching skipped directories were observed in the current repo scan."
    };
  }

  let tokens = 0;
  let fileCount = 0;
  let visitedFiles = 0;
  let partial = false;

  const visit = async (absolutePath: string): Promise<void> => {
    if (visitedFiles >= SKIPPED_DIR_SCAN_LIMIT) {
      partial = true;
      return;
    }

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(absolutePath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (visitedFiles >= SKIPPED_DIR_SCAN_LIMIT) {
        partial = true;
        break;
      }

      const fullPath = path.join(absolutePath, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext) || isSkippedFile(entry.name)) {
        continue;
      }

      try {
        const stat = await fs.stat(fullPath);
        tokens += Math.max(1, Math.ceil(stat.size / CHARS_PER_TOKEN));
        fileCount += 1;
        visitedFiles += 1;
      } catch {
        continue;
      }
    }
  };

  for (const directory of directories) {
    await visit(path.join(targetRoot, directory));
  }

  return {
    tokens,
    fileCount,
    partial,
    note: partial
      ? `Heuristic estimate from a partial sample of ${fileCount} file(s) across skipped directories.`
      : `Heuristic estimate from ${fileCount} source-like file(s) under skipped directories.`
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function persistTokenUsage(
  targetRoot: string,
  task: string,
  estimate: TokenEstimate
): Promise<string> {
  const statePath = path.join(
    targetRoot,
    ".agent",
    "state",
    "token-usage.json"
  );

  const topDirectories = estimate.directoryBreakdown
    .slice(0, 10)
    .map((d) => ({ directory: d.directory, tokens: d.tokens, fileCount: d.fileCount }));

  const record: TokenUsageState = {
    artifactType: "kiwi-control/token-usage",
    version: 3,
    timestamp: new Date().toISOString(),
    task,
    selected_tokens: estimate.selectedTokens,
    full_repo_tokens: estimate.fullRepoTokens,
    savings_percent: estimate.savingsPercent,
    file_count_selected: estimate.fileBreakdown.filter((f) => f.selected).length,
    file_count_total: estimate.fileBreakdown.length,
    estimation_method: estimate.estimationMethod,
    estimate_note: estimate.estimateNote,
    top_directories: topDirectories,
    wasted_files: estimate.wastedFiles.files,
    wasted_tokens_total: estimate.wastedFiles.totalWastedTokens,
    wasted_removal_savings_percent: estimate.wastedFiles.removalSavingsPercent,
    heavy_directories: estimate.heavyDirectories.directories
  };

  await writeText(statePath, `${JSON.stringify(record, null, 2)}\n`);
  await persistTokenBreakdown(targetRoot, estimate.tokenBreakdown);
  return statePath;
}

export async function persistTokenBreakdown(
  targetRoot: string,
  breakdown: TokenBreakdownState
): Promise<string> {
  const statePath = path.join(targetRoot, ".agent", "state", "token-breakdown.json");
  await writeText(statePath, `${JSON.stringify(breakdown, null, 2)}\n`);
  return statePath;
}
