import path from "node:path";
import type { WriteResult } from "../utils/fs.js";
import { ensureDir, pathExists, readJson, readText, relativeFrom, writeText } from "../utils/fs.js";
import type { ContextIndexFileRecord, ContextIndexState } from "./context-index.js";
import type { RepoContextOperatorView, RepoContextTreeState } from "./context-tree.js";

export interface RepoMapState {
  artifactType: "kiwi-control/repo-map";
  version: 1;
  generatedAt: string;
  projectType: string;
  summary: string;
  languages: string[];
  entryPoints: string[];
  keyModules: Array<{
    id: string;
    fileCount: number;
    entryPoints: string[];
  }>;
  topReverseDependencyHubs: RepoContextTreeState["topReverseDependencyHubs"];
  filesDiscovered: number;
  importableFiles: number;
  indexedFiles: number;
}

export interface SymbolIndexEntry {
  symbol: string;
  kind: "export" | "local-function";
  file: string;
  moduleGroup: string;
}

export interface SymbolIndexState {
  artifactType: "kiwi-control/symbol-index";
  version: 1;
  generatedAt: string;
  totalFiles: number;
  totalSymbols: number;
  files: Array<{
    file: string;
    moduleGroup: string;
    exports: string[];
    localFunctions: string[];
  }>;
  symbols: SymbolIndexEntry[];
}

export interface DependencyGraphState {
  artifactType: "kiwi-control/dependency-graph";
  version: 1;
  generatedAt: string;
  nodes: Array<{
    file: string;
    moduleGroup: string;
    exports: number;
    localFunctions: number;
    imports: number;
    importedBy: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    kind: "import" | "call";
  }>;
  fileRelationships: Array<{
    file: string;
    moduleGroup: string;
    imports: string[];
    importedBy: string[];
    callTargets: string[];
    relationships: string[];
  }>;
}

export interface ImpactMapState {
  artifactType: "kiwi-control/impact-map";
  version: 1;
  generatedAt: string;
  changedFiles: string[];
  forwardDependencies: string[];
  reverseDependencies: string[];
  impactedFiles: string[];
  dependencyDistances: Record<string, number>;
  dependencyChains: Record<string, string[]>;
  impactedModules: string[];
}

export interface CompactContextPack {
  artifactType: "kiwi-control/compact-context-pack";
  version: 1;
  generatedAt: string;
  mode: "overview" | "focus" | "changed";
  focusFiles: string[];
  missingFocusFiles: string[];
  summary: string;
  files: Array<{
    file: string;
    moduleGroup: string;
    reasons: string[];
    exports: string[];
    localFunctions: string[];
    imports: string[];
    importedBy: string[];
    callTargets: string[];
  }>;
  dependencyChains: Array<{
    file: string;
    chain: string[];
  }>;
  modules: Array<{
    id: string;
    fileCount: number;
    entryPoints: string[];
  }>;
}

export interface RepoIntelligenceArtifacts {
  repoMap: RepoMapState;
  symbolIndex: SymbolIndexState;
  dependencyGraph: DependencyGraphState;
  impactMap: ImpactMapState;
}

export interface RepoIntelligenceSummary {
  available: boolean;
  generatedAt: string | null;
  summary: string | null;
  repoMapPath: string | null;
  symbolIndexPath: string | null;
  dependencyGraphPath: string | null;
  impactMapPath: string | null;
  entryPoints: string[];
  keyModules: Array<{
    id: string;
    fileCount: number;
    entryPoints: string[];
  }>;
  topReverseDependencyHubs: RepoMapState["topReverseDependencyHubs"];
  changedFiles: string[];
  impactedFiles: string[];
}

export async function buildRepoIntelligenceArtifacts(options: {
  tree: RepoContextTreeState;
  view: RepoContextOperatorView;
  index: ContextIndexState;
}): Promise<RepoIntelligenceArtifacts> {
  const generatedAt = options.tree.timestamp;
  return {
    repoMap: buildRepoMap(options.tree, options.view, options.index, generatedAt),
    symbolIndex: buildSymbolIndex(options.index, generatedAt),
    dependencyGraph: buildDependencyGraph(options.index, generatedAt),
    impactMap: buildImpactMap(options.index, generatedAt)
  };
}

export async function persistRepoIntelligenceArtifacts(
  targetRoot: string,
  artifacts: RepoIntelligenceArtifacts
): Promise<WriteResult[]> {
  return Promise.all([
    writeJsonArtifact(repoMapPath(targetRoot), artifacts.repoMap),
    writeJsonArtifact(symbolIndexPath(targetRoot), artifacts.symbolIndex),
    writeJsonArtifact(dependencyGraphPath(targetRoot), artifacts.dependencyGraph),
    writeJsonArtifact(impactMapPath(targetRoot), artifacts.impactMap)
  ]);
}

export async function persistRepoIntelligenceIndexArtifacts(
  targetRoot: string,
  index: ContextIndexState
): Promise<WriteResult[]> {
  const generatedAt = index.timestamp;
  return Promise.all([
    writeJsonArtifact(symbolIndexPath(targetRoot), buildSymbolIndex(index, generatedAt)),
    writeJsonArtifact(dependencyGraphPath(targetRoot), buildDependencyGraph(index, generatedAt)),
    writeJsonArtifact(impactMapPath(targetRoot), buildImpactMap(index, generatedAt))
  ]);
}

export async function loadRepoIntelligenceSummary(targetRoot: string): Promise<RepoIntelligenceSummary> {
  const [repoMap, impactMap, hasSymbolIndex, hasDependencyGraph] = await Promise.all([
    readJsonIfPresent<RepoMapState>(repoMapPath(targetRoot)),
    readJsonIfPresent<ImpactMapState>(impactMapPath(targetRoot)),
    pathExists(symbolIndexPath(targetRoot)),
    pathExists(dependencyGraphPath(targetRoot))
  ]);

  if (!repoMap || !impactMap || !hasSymbolIndex || !hasDependencyGraph) {
    return {
      available: false,
      generatedAt: null,
      summary: null,
      repoMapPath: null,
      symbolIndexPath: null,
      dependencyGraphPath: null,
      impactMapPath: null,
      entryPoints: [],
      keyModules: [],
      topReverseDependencyHubs: [],
      changedFiles: [],
      impactedFiles: []
    };
  }

  return {
    available: true,
    generatedAt: repoMap.generatedAt,
    summary: repoMap.summary,
    repoMapPath: relativeFrom(targetRoot, repoMapPath(targetRoot)),
    symbolIndexPath: relativeFrom(targetRoot, symbolIndexPath(targetRoot)),
    dependencyGraphPath: relativeFrom(targetRoot, dependencyGraphPath(targetRoot)),
    impactMapPath: relativeFrom(targetRoot, impactMapPath(targetRoot)),
    entryPoints: repoMap.entryPoints,
    keyModules: repoMap.keyModules,
    topReverseDependencyHubs: repoMap.topReverseDependencyHubs,
    changedFiles: impactMap.changedFiles,
    impactedFiles: impactMap.impactedFiles
  };
}

export function buildCompactContextPack(options: {
  index: ContextIndexState;
  repoMap: RepoMapState;
  focusFiles?: string[];
  mode?: "overview" | "focus" | "changed";
  limit?: number;
}): CompactContextPack {
  const fileMap = new Map(options.index.files.map((entry) => [entry.file, entry] as const));
  const moduleMap = new Map<string, Set<string>>();
  for (const entry of options.index.files) {
    const moduleFiles = moduleMap.get(entry.moduleGroup) ?? new Set<string>();
    moduleFiles.add(entry.file);
    moduleMap.set(entry.moduleGroup, moduleFiles);
  }

  const requestedFocus = uniqueStrings(options.focusFiles ?? []);
  const focusFiles = requestedFocus.filter((file) => fileMap.has(file));
  const missingFocusFiles = requestedFocus.filter((file) => !fileMap.has(file));
  const mode = options.mode ?? (focusFiles.length > 0 ? "focus" : "overview");
  const limit = Math.max(4, Math.min(options.limit ?? 12, 24));

  const seedFiles =
    mode === "changed" && options.index.lastImpact.changedFiles.length > 0
      ? options.index.lastImpact.changedFiles.filter((file) => fileMap.has(file))
      : focusFiles.length > 0
        ? focusFiles
        : uniqueStrings([
            ...options.repoMap.entryPoints.slice(0, 4),
            ...options.repoMap.topReverseDependencyHubs.slice(0, 4).map((entry) => entry.file)
          ]).filter((file) => fileMap.has(file));

  const ranking = new Map<string, { score: number; reasons: Set<string> }>();
  const addRank = (file: string, score: number, reason: string): void => {
    if (!fileMap.has(file)) {
      return;
    }
    const current = ranking.get(file) ?? { score: Number.NEGATIVE_INFINITY, reasons: new Set<string>() };
    current.score = Math.max(current.score, score);
    current.reasons.add(reason);
    ranking.set(file, current);
  };

  for (const file of seedFiles) {
    addRank(file, 100, mode === "changed" ? "changed file" : "focus file");
  }

  for (const file of seedFiles) {
    const record = fileMap.get(file);
    if (!record) {
      continue;
    }
    for (const dependency of record.relationships) {
      addRank(dependency, 80, "direct dependency");
    }
    for (const dependent of options.index.reverseDependencies[file] ?? []) {
      addRank(dependent, 78, "reverse dependent");
    }
    for (const modulePeer of moduleMap.get(record.moduleGroup) ?? []) {
      if (modulePeer !== file) {
        addRank(modulePeer, 50, "shared module");
      }
    }
  }

  if (mode === "changed") {
    for (const impacted of options.index.lastImpact.impactedFiles) {
      const distance = options.index.lastImpact.dependencyDistances[impacted] ?? 3;
      addRank(impacted, 70 - distance, "impact chain");
    }
  }

  const selectedFiles = [...ranking.entries()]
    .sort((left, right) => {
      if (right[1].score !== left[1].score) {
        return right[1].score - left[1].score;
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([file]) => file);

  const files = selectedFiles.map((file) => {
    const record = fileMap.get(file)!;
    return {
      file,
      moduleGroup: record.moduleGroup,
      reasons: [...(ranking.get(file)?.reasons ?? new Set<string>())].sort((left, right) => left.localeCompare(right)),
      exports: record.exports,
      localFunctions: record.localFunctions,
      imports: record.imports,
      importedBy: record.importedBy,
      callTargets: record.importCallTargets
    };
  });

  const dependencyChains = selectedFiles
    .map((file) => ({
      file,
      chain: options.index.lastImpact.dependencyChains[file]
    }))
    .filter((entry): entry is { file: string; chain: string[] } => Array.isArray(entry.chain) && entry.chain.length > 1)
    .sort((left, right) => left.file.localeCompare(right.file));

  const moduleIds = uniqueStrings(files.map((entry) => entry.moduleGroup));
  const modules = options.repoMap.keyModules
    .filter((entry) => moduleIds.includes(entry.id))
    .sort((left, right) => right.fileCount - left.fileCount || left.id.localeCompare(right.id));

  const summary =
    mode === "changed"
      ? `Focused changed-area pack with ${files.length} related files across ${modules.length} module groups.`
      : mode === "focus"
        ? `Focused repo pack for ${focusFiles.join(", ") || "requested files"} with ${files.length} structurally related files.`
        : `Overview repo pack with ${files.length} high-signal files across ${modules.length} module groups.`;

  return {
    artifactType: "kiwi-control/compact-context-pack",
    version: 1,
    generatedAt: options.index.timestamp,
    mode,
    focusFiles: seedFiles,
    missingFocusFiles,
    summary,
    files,
    dependencyChains,
    modules
  };
}

function buildRepoMap(
  tree: RepoContextTreeState,
  view: RepoContextOperatorView,
  index: ContextIndexState,
  generatedAt: string
): RepoMapState {
  return {
    artifactType: "kiwi-control/repo-map",
    version: 1,
    generatedAt,
    projectType: String(tree.projectType),
    summary: view.summary,
    languages: tree.languages,
    entryPoints: tree.entryPoints,
    keyModules: view.keyModules,
    topReverseDependencyHubs: tree.topReverseDependencyHubs,
    filesDiscovered: tree.filesDiscovered,
    importableFiles: tree.importableFiles,
    indexedFiles: index.indexedFiles
  };
}

function buildSymbolIndex(index: ContextIndexState, generatedAt: string): SymbolIndexState {
  const symbols = index.files
    .flatMap((record) => [
      ...record.exports.map((symbol) => ({
        symbol,
        kind: "export" as const,
        file: record.file,
        moduleGroup: record.moduleGroup
      })),
      ...record.localFunctions.map((symbol) => ({
        symbol,
        kind: "local-function" as const,
        file: record.file,
        moduleGroup: record.moduleGroup
      }))
    ])
    .sort((left, right) => {
      if (left.symbol !== right.symbol) {
        return left.symbol.localeCompare(right.symbol);
      }
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }
      return left.kind.localeCompare(right.kind);
    });

  return {
    artifactType: "kiwi-control/symbol-index",
    version: 1,
    generatedAt,
    totalFiles: index.files.length,
    totalSymbols: symbols.length,
    files: index.files
      .map((record) => ({
        file: record.file,
        moduleGroup: record.moduleGroup,
        exports: record.exports,
        localFunctions: record.localFunctions
      }))
      .sort((left, right) => left.file.localeCompare(right.file)),
    symbols
  };
}

function buildDependencyGraph(index: ContextIndexState, generatedAt: string): DependencyGraphState {
  const edges = uniqueEdges(
    index.files.flatMap((record) => [
      ...record.imports.map((to) => ({ from: record.file, to, kind: "import" as const })),
      ...record.importCallTargets.map((to) => ({ from: record.file, to, kind: "call" as const }))
    ])
  );

  return {
    artifactType: "kiwi-control/dependency-graph",
    version: 1,
    generatedAt,
    nodes: index.files
      .map((record) => ({
        file: record.file,
        moduleGroup: record.moduleGroup,
        exports: record.exports.length,
        localFunctions: record.localFunctions.length,
        imports: record.imports.length,
        importedBy: record.importedBy.length
      }))
      .sort((left, right) => left.file.localeCompare(right.file)),
    edges,
    fileRelationships: index.files
      .map((record) => ({
        file: record.file,
        moduleGroup: record.moduleGroup,
        imports: record.imports,
        importedBy: record.importedBy,
        callTargets: record.importCallTargets,
        relationships: record.relationships
      }))
      .sort((left, right) => left.file.localeCompare(right.file))
  };
}

function buildImpactMap(index: ContextIndexState, generatedAt: string): ImpactMapState {
  const moduleByFile = new Map(index.files.map((record) => [record.file, record.moduleGroup] as const));
  const impactedModules = uniqueStrings(
    [
      ...index.lastImpact.changedFiles,
      ...index.lastImpact.impactedFiles
    ].map((file) => moduleByFile.get(file) ?? "root")
  );

  return {
    artifactType: "kiwi-control/impact-map",
    version: 1,
    generatedAt,
    changedFiles: index.lastImpact.changedFiles,
    forwardDependencies: index.lastImpact.forwardDependencies,
    reverseDependencies: index.lastImpact.reverseDependencies,
    impactedFiles: index.lastImpact.impactedFiles,
    dependencyDistances: index.lastImpact.dependencyDistances,
    dependencyChains: index.lastImpact.dependencyChains,
    impactedModules
  };
}

function repoMapPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "context", "repo-map.json");
}

function symbolIndexPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "symbol-index.json");
}

function dependencyGraphPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "dependency-graph.json");
}

function impactMapPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "impact-map.json");
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  try {
    return await readJson<T>(filePath);
  } catch {
    return null;
  }
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
    detail: exists ? "updated repo intelligence artifact" : "created repo intelligence artifact"
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function uniqueEdges(
  edges: Array<{ from: string; to: string; kind: "import" | "call" }>
): Array<{ from: string; to: string; kind: "import" | "call" }> {
  return [...new Map(
    edges
      .filter((edge) => Boolean(edge.from) && Boolean(edge.to))
      .map((edge) => [`${edge.kind}:${edge.from}->${edge.to}`, edge] as const)
  ).values()].sort((left, right) => {
    if (left.from !== right.from) {
      return left.from.localeCompare(right.from);
    }
    if (left.to !== right.to) {
      return left.to.localeCompare(right.to);
    }
    return left.kind.localeCompare(right.kind);
  });
}
