import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists, readText, writeText } from "../utils/fs.js";

export interface TokenEstimate {
  selectedTokens: number;
  fullRepoTokens: number;
  savingsPercent: number;
  fileBreakdown: Array<{
    file: string;
    tokens: number;
    selected: boolean;
  }>;
}

export interface TokenUsageState {
  artifactType: "kiwi-control/token-usage";
  version: 1;
  timestamp: string;
  task: string;
  selected_tokens: number;
  full_repo_tokens: number;
  savings_percent: number;
  file_count_selected: number;
  file_count_total: number;
}

const CHARS_PER_TOKEN = 4;

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", "coverage",
  ".nyc_output", ".cache", "target", ".turbo",
  ".agent"
]);

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

export async function estimateTokens(
  targetRoot: string,
  selectedFiles: string[]
): Promise<TokenEstimate> {
  const allFiles = await collectSourceFiles(targetRoot);
  const selectedSet = new Set(selectedFiles.map((f) => normalizePath(f)));

  const fileBreakdown: TokenEstimate["fileBreakdown"] = [];
  let selectedTokens = 0;
  let fullRepoTokens = 0;

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
  }

  const savingsPercent = fullRepoTokens > 0
    ? Math.round(((fullRepoTokens - selectedTokens) / fullRepoTokens) * 100)
    : 0;

  return {
    selectedTokens,
    fullRepoTokens,
    savingsPercent,
    fileBreakdown
  };
}

function estimateCharTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
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

      const relativePath = path.relative(targetRoot, fullPath);
      files.push(relativePath);
    }
  }

  await scanDir(targetRoot, 0);
  return files;
}

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

  const record: TokenUsageState = {
    artifactType: "kiwi-control/token-usage",
    version: 1,
    timestamp: new Date().toISOString(),
    task,
    selected_tokens: estimate.selectedTokens,
    full_repo_tokens: estimate.fullRepoTokens,
    savings_percent: estimate.savingsPercent,
    file_count_selected: estimate.fileBreakdown.filter((f) => f.selected).length,
    file_count_total: estimate.fileBreakdown.length
  };

  await writeText(statePath, `${JSON.stringify(record, null, 2)}\n`);
  return statePath;
}
