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
  costEstimates: CostEstimates;
  wastedFiles: WastedFileReport;
  heavyDirectories: HeavyDirectoryReport;
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

export interface CostEstimates {
  /** Cost per 1M input tokens for each model tier */
  tiers: Array<{
    model: string;
    inputCostPer1M: number;
    selectedCost: string;
    fullRepoCost: string;
    savingsCost: string;
  }>;
}

export interface TokenUsageState {
  artifactType: "kiwi-control/token-usage";
  version: 2;
  timestamp: string;
  task: string;
  selected_tokens: number;
  full_repo_tokens: number;
  savings_percent: number;
  file_count_selected: number;
  file_count_total: number;
  estimation_method: EstimationMethod;
  top_directories: Array<{ directory: string; tokens: number; fileCount: number }>;
  cost_estimates: CostEstimates;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;
const ESTIMATION_METHOD: EstimationMethod = "rough estimate (chars/4 heuristic)";

/** Model pricing tiers — input cost per 1M tokens (USD) as of mid-2025 */
const MODEL_TIERS: Array<{ model: string; inputCostPer1M: number }> = [
  { model: "Haiku 4.5", inputCostPer1M: 0.80 },
  { model: "Sonnet 4.6", inputCostPer1M: 3.00 },
  { model: "Opus 4.6", inputCostPer1M: 15.00 }
];

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
  const allFiles = await collectSourceFiles(targetRoot);
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

  const costEstimates = computeCostEstimates(selectedTokens, fullRepoTokens);
  const wastedFiles = detectWastedFiles(fileBreakdown, task);
  const heavyDirectories = detectHeavyDirectories(directoryBreakdown, fullRepoTokens, task);

  return {
    selectedTokens,
    fullRepoTokens,
    savingsPercent,
    estimationMethod: ESTIMATION_METHOD,
    fileBreakdown,
    directoryBreakdown,
    costEstimates,
    wastedFiles,
    heavyDirectories
  };
}

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

function computeCostEstimates(selectedTokens: number, fullRepoTokens: number): CostEstimates {
  const savedTokens = fullRepoTokens - selectedTokens;

  return {
    tiers: MODEL_TIERS.map((tier) => ({
      model: tier.model,
      inputCostPer1M: tier.inputCostPer1M,
      selectedCost: formatCost(selectedTokens * tier.inputCostPer1M / 1_000_000),
      fullRepoCost: formatCost(fullRepoTokens * tier.inputCostPer1M / 1_000_000),
      savingsCost: formatCost(savedTokens * tier.inputCostPer1M / 1_000_000)
    }))
  };
}

function formatCost(dollars: number): string {
  if (dollars < 0.01) return "<$0.01";
  return `$${dollars.toFixed(2)}`;
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

async function collectSourceFiles(targetRoot: string): Promise<string[]> {
  const files: string[] = [];

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
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
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

  return files;
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
    version: 2,
    timestamp: new Date().toISOString(),
    task,
    selected_tokens: estimate.selectedTokens,
    full_repo_tokens: estimate.fullRepoTokens,
    savings_percent: estimate.savingsPercent,
    file_count_selected: estimate.fileBreakdown.filter((f) => f.selected).length,
    file_count_total: estimate.fileBreakdown.length,
    estimation_method: estimate.estimationMethod,
    top_directories: topDirectories,
    cost_estimates: estimate.costEstimates,
    wasted_files: estimate.wastedFiles.files,
    wasted_tokens_total: estimate.wastedFiles.totalWastedTokens,
    wasted_removal_savings_percent: estimate.wastedFiles.removalSavingsPercent,
    heavy_directories: estimate.heavyDirectories.directories
  };

  await writeText(statePath, `${JSON.stringify(record, null, 2)}\n`);
  return statePath;
}
