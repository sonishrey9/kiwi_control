import path from "node:path";
import type { WriteResult } from "../utils/fs.js";
import { ensureDir, pathExists, readJson, readText, relativeFrom, writeText } from "../utils/fs.js";
import type { ContextIndexFileRecord, ContextIndexState } from "./context-index.js";
import type { RepoContextOperatorView, RepoContextTreeState } from "./context-tree.js";
import { classifyFileArea, deriveTaskArea, deriveTaskCategory, tokenizeTaskText } from "./task-intent.js";

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
  rankedFiles: Array<{
    file: string;
    moduleGroup: string;
    score: number;
    reasons: string[];
    changed: boolean;
    entryPoint: boolean;
    importedByCount: number;
    dependencyDistance: number | null;
  }>;
  rankedModules: Array<{
    id: string;
    score: number;
    changedFiles: string[];
    impactedFiles: string[];
    entryPoints: string[];
    topFiles: string[];
  }>;
  clusters: Array<{
    id: string;
    changedFiles: string[];
    impactedFiles: string[];
    score: number;
    topFiles: string[];
  }>;
}

export interface CompactContextPack {
  artifactType: "kiwi-control/compact-context-pack";
  version: 1;
  generatedAt: string;
  mode: "overview" | "focus" | "changed";
  task: string | null;
  focusFiles: string[];
  missingFocusFiles: string[];
  summary: string;
  files: Array<{
    file: string;
    moduleGroup: string;
    score: number;
    reasons: string[];
    matchedTerms: string[];
    matchedSymbols: string[];
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
    score: number;
    topFiles: string[];
  }>;
  clusters: Array<{
    id: string;
    score: number;
    changedFiles: string[];
    impactedFiles: string[];
    topFiles: string[];
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
  compactContextPackAvailable: boolean;
  compactContextPackPath: string | null;
  compactContextPackMode: CompactContextPack["mode"] | null;
  compactContextPackTask: string | null;
  compactContextPackSummary: string | null;
  compactContextPackFiles: number;
}

export async function buildRepoIntelligenceArtifacts(options: {
  tree: RepoContextTreeState;
  view: RepoContextOperatorView;
  index: ContextIndexState;
}): Promise<RepoIntelligenceArtifacts> {
  const generatedAt = options.tree.timestamp;
  const repoMap = buildRepoMap(options.tree, options.view, options.index, generatedAt);
  return {
    repoMap,
    symbolIndex: buildSymbolIndex(options.index, generatedAt),
    dependencyGraph: buildDependencyGraph(options.index, generatedAt),
    impactMap: buildImpactMap(options.index, generatedAt, repoMap)
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
  const repoMap = await readJsonIfPresent<RepoMapState>(repoMapPath(targetRoot));
  return Promise.all([
    writeJsonArtifact(symbolIndexPath(targetRoot), buildSymbolIndex(index, generatedAt)),
    writeJsonArtifact(dependencyGraphPath(targetRoot), buildDependencyGraph(index, generatedAt)),
    writeJsonArtifact(impactMapPath(targetRoot), buildImpactMap(index, generatedAt, repoMap))
  ]);
}

export async function loadRepoIntelligenceSummary(targetRoot: string): Promise<RepoIntelligenceSummary> {
  const [repoMap, impactMap, compactContextPack, hasSymbolIndex, hasDependencyGraph] = await Promise.all([
    readJsonIfPresent<RepoMapState>(repoMapPath(targetRoot)),
    readJsonIfPresent<ImpactMapState>(impactMapPath(targetRoot)),
    readJsonIfPresent<CompactContextPack>(compactContextPackPath(targetRoot)),
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
      impactedFiles: [],
      compactContextPackAvailable: false,
      compactContextPackPath: null,
      compactContextPackMode: null,
      compactContextPackTask: null,
      compactContextPackSummary: null,
      compactContextPackFiles: 0
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
    impactedFiles: impactMap.impactedFiles,
    compactContextPackAvailable: Boolean(compactContextPack),
    compactContextPackPath: compactContextPack ? relativeFrom(targetRoot, compactContextPackPath(targetRoot)) : null,
    compactContextPackMode: compactContextPack?.mode ?? null,
    compactContextPackTask: compactContextPack?.task ?? null,
    compactContextPackSummary: compactContextPack?.summary ?? null,
    compactContextPackFiles: compactContextPack?.files.length ?? 0
  };
}

export function buildCompactContextPack(options: {
  index: ContextIndexState;
  repoMap: RepoMapState;
  impactMap?: ImpactMapState;
  focusTargets?: string[];
  mode?: "overview" | "focus" | "changed";
  task?: string;
  limit?: number;
}): CompactContextPack {
  const fileMap = new Map(options.index.files.map((entry) => [entry.file, entry] as const));
  const moduleMap = new Map<string, Set<string>>();
  for (const entry of options.index.files) {
    const moduleFiles = moduleMap.get(entry.moduleGroup) ?? new Set<string>();
    moduleFiles.add(entry.file);
    moduleMap.set(entry.moduleGroup, moduleFiles);
  }

  const impactMap = options.impactMap ?? buildImpactMap(options.index, options.index.timestamp, options.repoMap);
  const requestedFocus = uniqueStrings(options.focusTargets ?? []);
  const resolvedFocus = resolveFocusTargets(requestedFocus, fileMap, moduleMap);
  const focusFiles = resolvedFocus.focusFiles;
  const missingFocusFiles = resolvedFocus.missingFocusTargets;
  const mode = options.mode ?? (focusFiles.length > 0 ? "focus" : "overview");
  const limit = Math.max(4, Math.min(options.limit ?? 12, 24));
  const taskTokens = uniqueStrings(tokenizeTaskText(options.task ?? ""));
  const taskArea = options.task ? deriveTaskArea(options.task) : "unknown";
  const taskCategory = options.task ? deriveTaskCategory(options.task) : "general";

  const seedFiles =
    mode === "changed" && options.index.lastImpact.changedFiles.length > 0
      ? options.index.lastImpact.changedFiles.filter((file) => fileMap.has(file))
      : focusFiles.length > 0
        ? focusFiles
        : uniqueStrings([
            ...options.repoMap.entryPoints.slice(0, 4),
            ...options.repoMap.topReverseDependencyHubs.slice(0, 4).map((entry) => entry.file)
          ]).filter((file) => fileMap.has(file));

  const impactRanks = new Map(impactMap.rankedFiles.map((entry) => [entry.file, entry] as const));
  const ranking = new Map<string, { score: number; reasons: Set<string>; matchedTerms: Set<string>; matchedSymbols: Set<string> }>();
  const addRank = (
    file: string,
    score: number,
    reason: string,
    options: { matchedTerm?: string; matchedSymbol?: string } = {}
  ): void => {
    if (!fileMap.has(file)) {
      return;
    }
    const current = ranking.get(file) ?? {
      score: 0,
      reasons: new Set<string>(),
      matchedTerms: new Set<string>(),
      matchedSymbols: new Set<string>()
    };
    current.score += score;
    current.reasons.add(reason);
    if (options.matchedTerm) {
      current.matchedTerms.add(options.matchedTerm);
    }
    if (options.matchedSymbol) {
      current.matchedSymbols.add(options.matchedSymbol);
    }
    ranking.set(file, current);
  };

  for (const [file, impactRank] of impactRanks) {
    addRank(file, impactRank.score, impactRank.changed ? "impact rank (changed)" : "impact rank");
    for (const reason of impactRank.reasons) {
      addRank(file, impactRank.score, reason);
    }
  }

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

  if (taskTokens.length > 0) {
    for (const [file, record] of fileMap) {
      const area = classifyFileArea(file);
      if (taskArea !== "unknown" && area === taskArea) {
        addRank(file, 52, "task area match");
      } else if (taskCategory === "docs" && area === "context") {
        addRank(file, 30, "docs context support");
      } else if (taskArea !== "unknown" && area !== "unknown") {
        addRank(file, 18, "cross-area support");
      }

      const pathWords = tokenizeTaskText(file.replace(/[/.]/g, " "));
      const pathMatches = taskTokens.filter((token) => pathWords.includes(token) || record.moduleGroup.toLowerCase().includes(token));
      for (const token of pathMatches.slice(0, 4)) {
        addRank(file, 62, "task term match", { matchedTerm: token });
      }

      const symbolPool = [...record.exports, ...record.localFunctions];
      for (const token of taskTokens) {
        const matchedSymbols = symbolPool.filter((symbol) => symbol.toLowerCase().includes(token));
        for (const symbol of matchedSymbols.slice(0, 3)) {
          addRank(file, 72, "task symbol match", { matchedTerm: token, matchedSymbol: symbol });
        }
      }
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
      score: ranking.get(file)?.score ?? 0,
      reasons: [...(ranking.get(file)?.reasons ?? new Set<string>())].sort((left, right) => left.localeCompare(right)),
      matchedTerms: [...(ranking.get(file)?.matchedTerms ?? new Set<string>())].sort((left, right) => left.localeCompare(right)),
      matchedSymbols: [...(ranking.get(file)?.matchedSymbols ?? new Set<string>())].sort((left, right) => left.localeCompare(right)),
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
  const moduleRanks = new Map(impactMap.rankedModules.map((entry) => [entry.id, entry] as const));
  const modules = options.repoMap.keyModules
    .filter((entry) => moduleIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      fileCount: entry.fileCount,
      entryPoints: entry.entryPoints,
      score: moduleRanks.get(entry.id)?.score ?? 0,
      topFiles: moduleRanks.get(entry.id)?.topFiles ?? []
    }))
    .sort((left, right) => right.score - left.score || right.fileCount - left.fileCount || left.id.localeCompare(right.id));

  const selectedFileSet = new Set(selectedFiles);
  const clusters = impactMap.clusters
    .filter((entry) =>
      entry.changedFiles.some((file) => selectedFileSet.has(file))
      || entry.impactedFiles.some((file) => selectedFileSet.has(file))
      || entry.topFiles.some((file) => selectedFileSet.has(file))
    )
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const summary =
    mode === "changed"
      ? `${options.task ? `Task-focused changed-area pack for "${options.task}"` : "Focused changed-area pack"} with ${files.length} related files across ${modules.length} module groups.`
      : mode === "focus"
        ? `${options.task ? `Task-focused pack for "${options.task}" around` : "Focused repo pack for"} ${focusFiles.join(", ") || requestedFocus.join(", ") || "requested files"} with ${files.length} structurally related files.`
        : `${options.task ? `Task-focused repo pack for "${options.task}"` : "Overview repo pack"} with ${files.length} high-signal files across ${modules.length} module groups.`;

  return {
    artifactType: "kiwi-control/compact-context-pack",
    version: 1,
    generatedAt: options.index.timestamp,
    mode,
    task: options.task ?? null,
    focusFiles: seedFiles,
    missingFocusFiles,
    summary,
    files,
    dependencyChains,
    modules,
    clusters
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

function buildImpactMap(
  index: ContextIndexState,
  generatedAt: string,
  repoMap?: RepoMapState | null
): ImpactMapState {
  const moduleByFile = new Map(index.files.map((record) => [record.file, record.moduleGroup] as const));
  const recordByFile = new Map(index.files.map((record) => [record.file, record] as const));
  const entryPoints = new Set(repoMap?.entryPoints ?? []);
  const changedFiles = new Set(index.lastImpact.changedFiles);
  const impactedModules = uniqueStrings(
    [
      ...index.lastImpact.changedFiles,
      ...index.lastImpact.impactedFiles
    ].map((file) => moduleByFile.get(file) ?? "root")
  );
  const callTargetsByFile = new Map(index.files.map((record) => [record.file, new Set(record.importCallTargets)] as const));
  const rankedFiles = uniqueStrings([
    ...index.lastImpact.changedFiles,
    ...index.lastImpact.impactedFiles
  ]).map((file) => {
    const record = recordByFile.get(file);
    const distance = index.lastImpact.dependencyDistances[file] ?? null;
    const reasons = new Set<string>();
    let score = 0;

    if (changedFiles.has(file)) {
      score += 100;
      reasons.add("changed file");
    }

    if (index.lastImpact.forwardDependencies.includes(file)) {
      score += Math.max(18, 34 - ((distance ?? 3) * 4));
      reasons.add("forward dependency");
    }

    if (index.lastImpact.reverseDependencies.includes(file)) {
      score += Math.max(22, 42 - ((distance ?? 3) * 5));
      reasons.add("reverse dependent");
    }

    if (index.lastImpact.dependencyChains[file]?.length) {
      score += 8;
      reasons.add("dependency chain");
    }

    if (entryPoints.has(file)) {
      score += 18;
      reasons.add("entry point");
    }

    if (record) {
      const importedByCount = record.importedBy.length;
      if (importedByCount > 0) {
        score += Math.min(importedByCount, 8);
        reasons.add("reverse dependency hub");
      }

      const moduleChangedCount = index.lastImpact.changedFiles.filter((changedFile) => moduleByFile.get(changedFile) === record.moduleGroup).length;
      if (moduleChangedCount > 0) {
        score += Math.min(moduleChangedCount * 10, 20);
        reasons.add("changed-area cluster");
      }

      for (const changedFile of changedFiles) {
        if (callTargetsByFile.get(changedFile)?.has(file) || callTargetsByFile.get(file)?.has(changedFile)) {
          score += 12;
          reasons.add("call relationship");
          break;
        }
      }
    }

    return {
      file,
      moduleGroup: moduleByFile.get(file) ?? "root",
      score,
      reasons: [...reasons].sort((left, right) => left.localeCompare(right)),
      changed: changedFiles.has(file),
      entryPoint: entryPoints.has(file),
      importedByCount: record?.importedBy.length ?? 0,
      dependencyDistance: distance
    };
  }).sort((left, right) => right.score - left.score || left.file.localeCompare(right.file));

  const rankedModules = impactedModules.map((moduleId) => {
    const moduleFiles = rankedFiles.filter((entry) => entry.moduleGroup === moduleId);
    const changed = moduleFiles.filter((entry) => entry.changed).map((entry) => entry.file);
    const impacted = moduleFiles.filter((entry) => !entry.changed).map((entry) => entry.file);
    const moduleEntryPoints = [...entryPoints].filter((entry) => moduleByFile.get(entry) === moduleId);
    const score =
      moduleFiles.reduce((total, entry) => total + entry.score, 0)
      + (moduleEntryPoints.length * 12)
      + (changed.length * 10);

    return {
      id: moduleId,
      score,
      changedFiles: changed,
      impactedFiles: impacted,
      entryPoints: moduleEntryPoints,
      topFiles: moduleFiles.slice(0, 5).map((entry) => entry.file)
    };
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const clusterAccumulator = new Map<string, {
    changedFiles: Set<string>;
    impactedFiles: Set<string>;
    score: number;
    topFiles: Array<{ file: string; score: number }>;
  }>();
  for (const fileEntry of rankedFiles) {
    const clusterId = deriveImpactClusterId(fileEntry.file);
    const cluster = clusterAccumulator.get(clusterId) ?? {
      changedFiles: new Set<string>(),
      impactedFiles: new Set<string>(),
      score: 0,
      topFiles: []
    };
    if (fileEntry.changed) {
      cluster.changedFiles.add(fileEntry.file);
    } else {
      cluster.impactedFiles.add(fileEntry.file);
    }
    cluster.score += fileEntry.score;
    cluster.topFiles.push({ file: fileEntry.file, score: fileEntry.score });
    clusterAccumulator.set(clusterId, cluster);
  }

  const clusters = [...clusterAccumulator.entries()]
    .map(([id, cluster]) => ({
      id,
      changedFiles: [...cluster.changedFiles].sort((left, right) => left.localeCompare(right)),
      impactedFiles: [...cluster.impactedFiles].sort((left, right) => left.localeCompare(right)),
      score: cluster.score,
      topFiles: cluster.topFiles
        .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
        .slice(0, 5)
        .map((entry) => entry.file)
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

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
    impactedModules,
    rankedFiles,
    rankedModules,
    clusters
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

function compactContextPackPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "context", "compact-context-pack.json");
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

export async function persistCompactContextPack(
  targetRoot: string,
  compactContextPack: CompactContextPack
): Promise<WriteResult> {
  return writeJsonArtifact(compactContextPackPath(targetRoot), compactContextPack);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function resolveFocusTargets(
  requestedFocus: string[],
  fileMap: Map<string, ContextIndexFileRecord>,
  moduleMap: Map<string, Set<string>>
): {
  focusFiles: string[];
  missingFocusTargets: string[];
} {
  const focusFiles = new Set<string>();
  const missingFocusTargets: string[] = [];

  for (const target of requestedFocus) {
    if (fileMap.has(target)) {
      focusFiles.add(target);
      continue;
    }

    const moduleFiles = moduleMap.get(target);
    if (moduleFiles) {
      for (const file of moduleFiles) {
        focusFiles.add(file);
      }
      continue;
    }

    const directoryMatches = [...fileMap.keys()].filter((file) => file.startsWith(`${target.replace(/\/+$/, "")}/`));
    if (directoryMatches.length > 0) {
      for (const file of directoryMatches) {
        focusFiles.add(file);
      }
      continue;
    }

    missingFocusTargets.push(target);
  }

  return {
    focusFiles: [...focusFiles].sort((left, right) => left.localeCompare(right)),
    missingFocusTargets: missingFocusTargets.sort((left, right) => left.localeCompare(right))
  };
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

function deriveImpactClusterId(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return segments[0] ?? ".";
  }
  if (segments[0] === "apps" && segments[1]) {
    return segments[2] === "src" && segments[3]
      ? `apps/${segments[1]}/src/${segments[3]}`
      : `apps/${segments[1]}`;
  }
  if (segments[0] === "packages" && segments[1]) {
    return segments[2] === "src" && segments[3]
      ? `packages/${segments[1]}/src/${segments[3]}`
      : `packages/${segments[1]}`;
  }
  if (segments[0] === "src") {
    return segments[1] && !segments[1].includes(".") ? `src/${segments[1]}` : "src";
  }
  if (segments[0] === "tests") {
    return "tests";
  }
  return segments.length > 2 ? `${segments[0]}/${segments[1]}` : (segments[0] ?? ".");
}
