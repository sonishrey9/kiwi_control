import path from "node:path";
import { Dirent, promises as fs } from "node:fs";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ProjectType } from "./config.js";
import { buildContextIndex, deriveModuleGroup, type ContextIndexFileRecord, type ContextIndexState } from "./context-index.js";
import type { WriteResult } from "../utils/fs.js";
import { ensureDir, isIgnoredArtifactName, pathExists, readText, writeText } from "../utils/fs.js";

const TREE_DEPTH_LIMIT = 5;
const EXPLAIN_DEPTH_LIMIT = 5;
const MAX_DISCOVERED_FILES = 2000;
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

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  ".pnpm",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".cache",
  ".tmp",
  "tmp",
  "temp",
  ".temp",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".gradle",
  ".idea",
  ".vscode",
  "coverage",
  ".nyc_output",
  "htmlcov",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
  ".tox",
  ".agent"
]);

const execFile = promisify(execFileCallback);

const ENTRYPOINT_NAMES = new Set([
  "main.ts",
  "main.tsx",
  "main.js",
  "main.jsx",
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "app.ts",
  "app.tsx",
  "app.js",
  "app.py",
  "server.ts",
  "server.js",
  "cli.ts",
  "cli.js",
  "manage.py",
  "__main__.py"
]);

export interface RepoContextTreeNode {
  name: string;
  path: string;
  kind: "directory" | "file";
  children: RepoContextTreeNode[];
}

export interface RepoContextTreeModuleGroup {
  id: string;
  fileCount: number;
  files: string[];
  imports: string[];
  importedBy: string[];
  entryPoints: string[];
}

export interface RepoContextTreeState {
  artifactType: "kiwi-control/context-tree";
  version: 1;
  timestamp: string;
  targetRoot: string;
  projectType: ProjectType | string;
  languages: string[];
  entryPoints: string[];
  keyModules: string[];
  topReverseDependencyHubs: Array<{
    file: string;
    moduleGroup: string;
    importedByCount: number;
  }>;
  dependencyClusters: RepoContextTreeModuleGroup[];
  tree: RepoContextTreeNode[];
  traversal: {
    maxDepth: number;
    selectionDepth: number;
    explainDepth: number;
  };
  filesDiscovered: number;
  importableFiles: number;
}

export interface RepoContextOperatorView {
  artifactType: "kiwi-control/context-tree-view";
  version: 1;
  timestamp: string;
  summary: string;
  languages: string[];
  entryPoints: string[];
  keyModules: Array<{
    id: string;
    fileCount: number;
    entryPoints: string[];
  }>;
  topReverseDependencyHubs: RepoContextTreeState["topReverseDependencyHubs"];
  tree: RepoContextTreeNode[];
}

export interface RepoContextSeedOptions {
  projectName: string;
  projectType: ProjectType | string;
  profile: string;
  authoritySource: string;
  activeRole: string;
  recommendedMcpPack: string;
  nextRecommendedSpecialist: string;
  nextSuggestedCommand: string;
}

export interface RepoContextSeedArtifacts {
  repoFacts: Record<string, unknown>;
  currentFocus: Record<string, unknown>;
  openRisks: Record<string, unknown>;
}

export async function buildRepoContextTree(
  targetRoot: string,
  projectType: ProjectType | string
): Promise<{
  state: RepoContextTreeState;
  view: RepoContextOperatorView;
  index: ContextIndexState;
}> {
  const discoveredFiles = await discoverRepoFiles(targetRoot);
  const changedFiles = await detectChangedFiles(targetRoot, discoveredFiles);
  const index = await buildContextIndex({
    targetRoot,
    discoveredFiles: discoveredFiles.map((file) => ({ file: file.file, mtime: file.mtime })),
    changedFiles
  });

  const tree = buildTreeNodes(discoveredFiles.map((entry) => entry.file));
  const languages = collectLanguages(discoveredFiles.map((entry) => entry.file));
  const entryPoints = collectEntryPoints(discoveredFiles.map((entry) => entry.file), index.files);
  const dependencyClusters = buildDependencyClusters(index.files);
  const topReverseDependencyHubs = [...index.files]
    .map((file) => ({
      file: file.file,
      moduleGroup: file.moduleGroup,
      importedByCount: file.importedBy.length
    }))
    .filter((file) => file.importedByCount > 0)
    .sort((left, right) => right.importedByCount - left.importedByCount || left.file.localeCompare(right.file))
    .slice(0, 10);
  const keyModules = dependencyClusters
    .slice()
    .sort((left, right) => right.fileCount - left.fileCount || left.id.localeCompare(right.id))
    .slice(0, 8)
    .map((group) => group.id);

  const state: RepoContextTreeState = {
    artifactType: "kiwi-control/context-tree",
    version: 1,
    timestamp: new Date().toISOString(),
    targetRoot,
    projectType,
    languages,
    entryPoints,
    keyModules,
    topReverseDependencyHubs,
    dependencyClusters,
    tree,
    traversal: {
      maxDepth: TREE_DEPTH_LIMIT,
      selectionDepth: 3,
      explainDepth: EXPLAIN_DEPTH_LIMIT
    },
    filesDiscovered: discoveredFiles.length,
    importableFiles: index.files.length
  };

  const view: RepoContextOperatorView = {
    artifactType: "kiwi-control/context-tree-view",
    version: 1,
    timestamp: state.timestamp,
    summary: `Discovered ${state.filesDiscovered} files across ${dependencyClusters.length} module groups. Entry points: ${entryPoints.slice(0, 5).join(", ") || "none"}.`,
    languages,
    entryPoints,
    keyModules: dependencyClusters
      .slice()
      .sort((left, right) => right.fileCount - left.fileCount || left.id.localeCompare(right.id))
      .slice(0, 8)
      .map((group) => ({
        id: group.id,
        fileCount: group.fileCount,
        entryPoints: group.entryPoints
      })),
    topReverseDependencyHubs,
    tree
  };

  return { state, view, index };
}

export async function persistRepoContextTreeArtifacts(
  targetRoot: string,
  tree: RepoContextTreeState,
  view: RepoContextOperatorView
): Promise<WriteResult[]> {
  const statePath = path.join(targetRoot, ".agent", "state", "context-tree.json");
  const contextPath = path.join(targetRoot, ".agent", "context", "context-tree.json");

  return Promise.all([
    writeJsonArtifact(statePath, tree),
    writeJsonArtifact(contextPath, view)
  ]);
}

export function buildRepoContextSeedArtifacts(
  tree: RepoContextTreeState,
  options: RepoContextSeedOptions
): RepoContextSeedArtifacts {
  const updatedAt = new Date().toISOString();
  return {
    repoFacts: {
      artifactType: "shrey-junior/repo-facts",
      version: 1,
      updatedAt,
      projectName: options.projectName,
      projectType: options.projectType,
      profile: options.profile,
      authoritySource: options.authoritySource,
      activeRole: options.activeRole,
      recommendedMcpPack: options.recommendedMcpPack,
      languages: tree.languages,
      entryPoints: tree.entryPoints,
      keyModules: tree.keyModules
    },
    currentFocus: {
      artifactType: "shrey-junior/current-focus",
      version: 1,
      updatedAt,
      currentFocus: "Review the repo-aware context tree before widening scope.",
      focusOwnerRole: options.activeRole,
      nextRecommendedSpecialist: options.nextRecommendedSpecialist,
      nextSuggestedMcpPack: options.recommendedMcpPack,
      nextFileToRead: ".agent/context/context-tree.json",
      nextSuggestedCommand: options.nextSuggestedCommand,
      latestCheckpoint: ".agent/state/checkpoints/latest.json",
      latestTaskPacket: null,
      latestHandoff: null,
      latestDispatchManifest: null,
      latestReconcile: null,
      entryPoints: tree.entryPoints,
      keyModules: tree.keyModules
    },
    openRisks: {
      artifactType: "shrey-junior/open-risks",
      version: 1,
      updatedAt,
      source: "repo-context-tree",
      risks: []
    }
  };
}

export async function persistRepoContextSeedArtifacts(
  targetRoot: string,
  artifacts: RepoContextSeedArtifacts
): Promise<WriteResult[]> {
  return Promise.all([
    writeJsonArtifact(path.join(targetRoot, ".agent", "memory", "repo-facts.json"), artifacts.repoFacts),
    writeJsonArtifact(path.join(targetRoot, ".agent", "memory", "current-focus.json"), artifacts.currentFocus),
    writeJsonArtifact(path.join(targetRoot, ".agent", "memory", "open-risks.json"), artifacts.openRisks)
  ]);
}

async function writeJsonArtifact(filePath: string, value: unknown): Promise<WriteResult> {
  const nextContent = `${JSON.stringify(value, null, 2)}\n`;
  const exists = await pathExists(filePath);
  const currentContent = exists ? await readText(filePath) : null;
  if (currentContent === nextContent) {
    return {
      path: filePath,
      status: "unchanged",
      detail: "already up to date",
      addedLines: 0,
      removedLines: 0
    };
  }
  await ensureDir(path.dirname(filePath));
  await writeText(filePath, nextContent);
  return {
    path: filePath,
    status: exists ? "updated" : "created",
    detail: exists ? "updated repo-aware artifact" : "created repo-aware artifact"
  };
}

async function discoverRepoFiles(
  targetRoot: string
): Promise<Array<{ file: string; mtime: number }>> {
  const discovered: Array<{ file: string; mtime: number }> = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: targetRoot, depth: 0 }];

  while (queue.length > 0 && discovered.length < MAX_DISCOVERED_FILES) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (isIgnoredArtifactName(entry.name)) {
        continue;
      }
      const fullPath = path.join(current.dir, entry.name);
      const relativePath = path.relative(targetRoot, fullPath) || entry.name;
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name) || current.depth >= TREE_DEPTH_LIMIT) {
          continue;
        }
        queue.push({ dir: fullPath, depth: current.depth + 1 });
        continue;
      }
      if (!shouldIncludeRepoFile(relativePath)) {
        continue;
      }
      try {
        const stat = await fs.stat(fullPath);
        discovered.push({
          file: relativePath,
          mtime: stat.mtimeMs
        });
      } catch {
        continue;
      }
    }
  }

  return discovered.sort((left, right) => left.file.localeCompare(right.file));
}

function shouldIncludeRepoFile(relativePath: string): boolean {
  const base = path.basename(relativePath);
  const ext = path.extname(relativePath).toLowerCase();
  if (SOURCE_EXTENSIONS.has(ext)) {
    return true;
  }
  return [
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml"
  ].includes(base);
}

async function detectChangedFiles(
  targetRoot: string,
  discoveredFiles: Array<{ file: string; mtime: number }>
): Promise<string[]> {
  try {
    const gitDir = path.join(targetRoot, ".git");
    if (!(await pathExists(gitDir))) {
      return [];
    }
    const { stdout } = await execFile("git", ["status", "--short"], {
      cwd: targetRoot,
      encoding: "utf8"
    });
    const changed = stdout
      .split("\n")
      .map((line) => line.slice(3).trim())
      .filter((line) => Boolean(line))
      .map((line) => line.replace(/\\/g, "/"));
    return discoveredFiles
      .map((entry) => entry.file)
      .filter((file) => changed.includes(file))
      .slice(0, 32);
  } catch {
    // Ignore git discovery failures and fall back to a deterministic small sample.
  }
  return discoveredFiles.slice(0, 12).map((entry) => entry.file);
}

function buildTreeNodes(files: string[]): RepoContextTreeNode[] {
  const root: RepoContextTreeNode = {
    name: ".",
    path: ".",
    kind: "directory",
    children: []
  };

  for (const file of files) {
    const segments = file.split(path.sep);
    let current = root;
    for (const [index, segment] of segments.entries()) {
      const nodePath = segments.slice(0, index + 1).join(path.sep);
      const isLeaf = index === segments.length - 1;
      let next = current.children.find((child) => child.name === segment && child.kind === (isLeaf ? "file" : "directory"));
      if (!next) {
        next = {
          name: segment,
          path: nodePath,
          kind: isLeaf ? "file" : "directory",
          children: []
        };
        current.children.push(next);
        current.children.sort((left, right) => {
          if (left.kind !== right.kind) {
            return left.kind === "directory" ? -1 : 1;
          }
          return left.name.localeCompare(right.name);
        });
      }
      current = next;
    }
  }

  return root.children;
}

function collectLanguages(files: string[]): string[] {
  const languages = new Set<string>();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    switch (ext) {
      case ".ts":
      case ".tsx":
        languages.add("typescript");
        break;
      case ".js":
      case ".jsx":
      case ".mjs":
      case ".cjs":
        languages.add("javascript");
        break;
      case ".py":
        languages.add("python");
        break;
      case ".rs":
        languages.add("rust");
        break;
      case ".go":
        languages.add("go");
        break;
      case ".java":
      case ".kt":
      case ".kts":
        languages.add("jvm");
        break;
      case ".md":
      case ".mdx":
        languages.add("docs");
        break;
      default:
        break;
    }
  }
  return [...languages].sort((left, right) => left.localeCompare(right));
}

function collectEntryPoints(files: string[], indexRecords: ContextIndexFileRecord[]): string[] {
  const recordMap = new Map(indexRecords.map((record) => [record.file, record] as const));
  const candidates = files.filter((file) => {
    const base = path.basename(file);
    if (ENTRYPOINT_NAMES.has(base)) {
      return true;
    }
    if (base === "package.json" || base === "pyproject.toml" || base === "Cargo.toml") {
      return true;
    }
    const record = recordMap.get(file);
    return Boolean(record && record.importedBy.length === 0 && (record.imports.length > 0 || record.exports.length > 0));
  });
  return [...new Set(candidates)].sort((left, right) => left.localeCompare(right)).slice(0, 16);
}

function buildDependencyClusters(records: ContextIndexFileRecord[]): RepoContextTreeModuleGroup[] {
  const groups = new Map<string, RepoContextTreeModuleGroup>();

  for (const record of records) {
    const group = groups.get(record.moduleGroup) ?? {
      id: record.moduleGroup,
      fileCount: 0,
      files: [],
      imports: [],
      importedBy: [],
      entryPoints: []
    };
    group.fileCount += 1;
    group.files.push(record.file);
    group.imports.push(...record.imports);
    group.importedBy.push(...record.importedBy);
    if (ENTRYPOINT_NAMES.has(path.basename(record.file)) || record.importedBy.length === 0) {
      group.entryPoints.push(record.file);
    }
    groups.set(record.moduleGroup, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      files: [...new Set(group.files)].sort((left, right) => left.localeCompare(right)),
      imports: [...new Set(group.imports)].sort((left, right) => left.localeCompare(right)),
      importedBy: [...new Set(group.importedBy)].sort((left, right) => left.localeCompare(right)),
      entryPoints: [...new Set(group.entryPoints)].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
