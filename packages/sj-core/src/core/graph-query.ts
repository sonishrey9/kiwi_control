import path from "node:path";
import type {
  CompactContextPack,
  DependencyGraphState,
  ImpactMapState,
  LoadedRepoIntelligenceArtifacts,
  ReviewGraphState,
  SymbolIndexState
} from "./repo-intelligence.js";
import { loadRepoIntelligenceArtifacts } from "./repo-intelligence.js";
import { normalizeRepoPath, relativeFrom } from "../utils/fs.js";

export type GraphQueryMode = "file" | "symbol" | "neighbors" | "impact" | "module";

export interface GraphQuerySummary {
  mode: GraphQueryMode;
  target: string;
  summary: string;
  queryPath: string;
}

export interface FileQueryResult {
  file: string;
  moduleGroup: string;
  exports: string[];
  localFunctions: string[];
  imports: string[];
  importedBy: string[];
  callTargets: string[];
  relationships: string[];
  impact: {
    changed: boolean;
    score: number;
    reasons: string[];
    dependencyDistance: number | null;
    chain: string[];
  } | null;
  history: {
    touches: number;
    commits: number;
    lastTouchedAt: string | null;
  } | null;
  review: {
    score: number;
    reasons: string[];
    failures: number;
    retries: number;
    entryPoint: boolean;
    reverseDependencyHub: boolean;
  } | null;
  decisions: Array<{
    label: string;
    kind: string;
    status: string | null;
    task: string | null;
    nextCommand: string | null;
  }>;
  peers: string[];
}

export interface SymbolQueryResult {
  symbol: string;
  matches: Array<{
    file: string;
    moduleGroup: string;
    kind: "export" | "local-function";
    exports: string[];
    localFunctions: string[];
  }>;
}

export interface NeighborsQueryResult {
  target: string;
  targetKind: "file" | "module";
  moduleGroup: string | null;
  imports: string[];
  importedBy: string[];
  callTargets: string[];
  peers: string[];
  relatedModules: {
    imports: string[];
    importedBy: string[];
  };
}

export interface ImpactQueryResult {
  target: string;
  targetKind: "file" | "module";
  changedFiles: string[];
  impactedFiles: string[];
  rankedFiles: Array<{
    file: string;
    score: number;
    reasons: string[];
    dependencyDistance: number | null;
  }>;
  clusters: Array<{
    id: string;
    score: number;
    changedFiles: string[];
    impactedFiles: string[];
    topFiles: string[];
  }>;
}

export interface ModuleQueryResult {
  module: string;
  files: string[];
  entryPoints: string[];
  imports: string[];
  importedBy: string[];
  topFiles: string[];
  history: {
    touches: number;
    commits: number;
    lastTouchedAt: string | null;
  } | null;
  review: {
    score: number;
    reasons: string[];
    failures: number;
  } | null;
}

export interface GraphQueryResult {
  mode: GraphQueryMode;
  target: string;
  summary: string;
  file?: FileQueryResult;
  symbol?: SymbolQueryResult;
  neighbors?: NeighborsQueryResult;
  impact?: ImpactQueryResult;
  module?: ModuleQueryResult;
}

export async function loadGraphQueryArtifacts(targetRoot: string): Promise<LoadedRepoIntelligenceArtifacts | null> {
  return loadRepoIntelligenceArtifacts(targetRoot);
}

export function queryFileSummary(artifacts: LoadedRepoIntelligenceArtifacts, target: string): GraphQueryResult {
  const normalizedTarget = normalizeQueryTarget(target);
  const relationship = findFileRelationship(artifacts.dependencyGraph, normalizedTarget);
  if (!relationship) {
    throw new Error(`No indexed file matches "${target}".`);
  }

  const impact = artifacts.impactMap.rankedFiles.find((entry) => entry.file === relationship.file) ?? null;
  const history = artifacts.historyGraph.hotspotFiles.find((entry) => entry.file === relationship.file) ?? null;
  const review = artifacts.reviewGraph.fileRisks.find((entry) => entry.file === relationship.file) ?? null;
  const decisions = artifacts.decisionGraph.importantDecisions
    .filter((entry) => entry.relatedFiles.includes(relationship.file))
    .slice(0, 6)
    .map((entry) => ({
      label: entry.label,
      kind: entry.kind,
      status: entry.status,
      task: entry.task,
      nextCommand: entry.nextCommand
    }));

  return {
    mode: "file",
    target: relationship.file,
    summary: `File summary for ${relationship.file} with ${relationship.relationships.length} structural relationship(s).`,
    file: {
      file: relationship.file,
      moduleGroup: relationship.moduleGroup,
      exports: symbolExportsForFile(artifacts.symbolIndex, relationship.file),
      localFunctions: symbolLocalsForFile(artifacts.symbolIndex, relationship.file),
      imports: relationship.imports,
      importedBy: relationship.importedBy,
      callTargets: relationship.callTargets,
      relationships: relationship.relationships,
      impact: impact
        ? {
            changed: impact.changed,
            score: impact.score,
            reasons: impact.reasons,
            dependencyDistance: impact.dependencyDistance,
            chain: artifacts.impactMap.dependencyChains[relationship.file] ?? []
          }
        : null,
      history: history
        ? {
            touches: history.touches,
            commits: history.commits,
            lastTouchedAt: history.lastTouchedAt
          }
        : null,
      review: review
        ? {
            score: review.score,
            reasons: review.reasons,
            failures: review.failures,
            retries: review.retries,
            entryPoint: review.entryPoint,
            reverseDependencyHub: review.reverseDependencyHub
          }
        : null,
      decisions,
      peers: modulePeers(artifacts.dependencyGraph, relationship.moduleGroup, relationship.file).slice(0, 10)
    }
  };
}

export function querySymbolLookup(artifacts: LoadedRepoIntelligenceArtifacts, symbol: string): GraphQueryResult {
  const normalized = symbol.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Symbol query requires a non-empty value.");
  }

  const exact = artifacts.symbolIndex.symbols.filter((entry) => entry.symbol.toLowerCase() === normalized);
  const fuzzy = exact.length > 0
    ? exact
    : artifacts.symbolIndex.symbols.filter((entry) => entry.symbol.toLowerCase().includes(normalized));
  const matches = fuzzy.slice(0, 12).map((entry) => ({
    file: entry.file,
    moduleGroup: entry.moduleGroup,
    kind: entry.kind,
    exports: symbolExportsForFile(artifacts.symbolIndex, entry.file),
    localFunctions: symbolLocalsForFile(artifacts.symbolIndex, entry.file)
  }));

  if (matches.length === 0) {
    throw new Error(`No symbol matches "${symbol}".`);
  }

  return {
    mode: "symbol",
    target: symbol,
    summary: `Found ${matches.length} symbol match(es) for "${symbol}".`,
    symbol: {
      symbol,
      matches
    }
  };
}

export function queryNeighbors(artifacts: LoadedRepoIntelligenceArtifacts, target: string): GraphQueryResult {
  const normalizedTarget = normalizeQueryTarget(target);
  const relationship = findFileRelationship(artifacts.dependencyGraph, normalizedTarget);
  if (relationship) {
    const relatedModules = deriveRelatedModules(artifacts.dependencyGraph, [relationship.file]);
    return {
      mode: "neighbors",
      target: relationship.file,
      summary: `Neighbor summary for file ${relationship.file}.`,
      neighbors: {
        target: relationship.file,
        targetKind: "file",
        moduleGroup: relationship.moduleGroup,
        imports: relationship.imports,
        importedBy: relationship.importedBy,
        callTargets: relationship.callTargets,
        peers: modulePeers(artifacts.dependencyGraph, relationship.moduleGroup, relationship.file).slice(0, 10),
        relatedModules
      }
    };
  }

  const module = queryModuleSummary(artifacts, normalizedTarget).module!;
  return {
    mode: "neighbors",
    target: normalizedTarget,
    summary: `Neighbor summary for module ${normalizedTarget}.`,
    neighbors: {
      target: normalizedTarget,
      targetKind: "module",
      moduleGroup: normalizedTarget,
      imports: module.imports,
      importedBy: module.importedBy,
      callTargets: [],
      peers: module.files.slice(0, 10),
      relatedModules: {
        imports: module.imports,
        importedBy: module.importedBy
      }
    }
  };
}

export function queryImpact(artifacts: LoadedRepoIntelligenceArtifacts, target: string): GraphQueryResult {
  const normalizedTarget = normalizeQueryTarget(target);
  const relationship = findFileRelationship(artifacts.dependencyGraph, normalizedTarget);
  if (relationship) {
    const ranked = artifacts.impactMap.rankedFiles.find((entry) => entry.file === relationship.file) ?? null;
    const clusterIds = artifacts.impactMap.clusters
      .filter((entry) =>
        entry.changedFiles.includes(relationship.file)
        || entry.impactedFiles.includes(relationship.file)
        || entry.topFiles.includes(relationship.file)
      )
      .slice(0, 6);
    return {
      mode: "impact",
      target: relationship.file,
      summary: `Impact summary for file ${relationship.file}.`,
      impact: {
        target: relationship.file,
        targetKind: "file",
        changedFiles: ranked?.changed ? [relationship.file] : [],
        impactedFiles: artifacts.impactMap.impactedFiles.includes(relationship.file) ? [relationship.file] : [],
        rankedFiles: ranked
          ? [{
              file: ranked.file,
              score: ranked.score,
              reasons: ranked.reasons,
              dependencyDistance: ranked.dependencyDistance
            }]
          : [],
        clusters: clusterIds
      }
    };
  }

  const module = queryModuleImpact(artifacts, normalizedTarget);
  return {
    mode: "impact",
    target: normalizedTarget,
    summary: `Impact summary for module ${normalizedTarget}.`,
    impact: module
  };
}

export function queryModuleSummary(artifacts: LoadedRepoIntelligenceArtifacts, target: string): GraphQueryResult {
  const moduleId = normalizeQueryTarget(target);
  const files = artifacts.dependencyGraph.fileRelationships
    .filter((entry) => entry.moduleGroup === moduleId)
    .map((entry) => entry.file)
    .sort((left, right) => left.localeCompare(right));
  if (files.length === 0) {
    throw new Error(`No module matches "${target}".`);
  }

  const entryPoints = artifacts.repoMap.entryPoints.filter((entry) => entry.startsWith(`${moduleId}/`) || entry === moduleId);
  const relatedModules = deriveRelatedModules(artifacts.dependencyGraph, files);
  const history = artifacts.historyGraph.hotspotModules.find((entry) => entry.id === moduleId) ?? null;
  const review = artifacts.reviewGraph.moduleRisks.find((entry) => entry.id === moduleId) ?? null;
  const topFiles = topFilesForModule(artifacts, moduleId, files);

  return {
    mode: "module",
    target: moduleId,
    summary: `Module summary for ${moduleId} with ${files.length} file(s).`,
    module: {
      module: moduleId,
      files,
      entryPoints,
      imports: relatedModules.imports,
      importedBy: relatedModules.importedBy,
      topFiles,
      history: history
        ? {
            touches: history.touches,
            commits: history.commits,
            lastTouchedAt: history.lastTouchedAt
          }
        : null,
      review: review
        ? {
            score: review.score,
            reasons: review.reasons,
            failures: review.failures
          }
        : null
    }
  };
}

function queryModuleImpact(artifacts: LoadedRepoIntelligenceArtifacts, moduleId: string): ImpactQueryResult {
  const rankedModule = artifacts.impactMap.rankedModules.find((entry) => entry.id === moduleId) ?? null;
  const clusterMatches = artifacts.impactMap.clusters.filter((entry) => entry.id === moduleId || entry.id.startsWith(`${moduleId}/`));
  const relevantRankedFiles = artifacts.impactMap.rankedFiles
    .filter((entry) => entry.moduleGroup === moduleId)
    .slice(0, 12)
    .map((entry) => ({
      file: entry.file,
      score: entry.score,
      reasons: entry.reasons,
      dependencyDistance: entry.dependencyDistance
    }));

  if (!rankedModule && clusterMatches.length === 0 && relevantRankedFiles.length === 0) {
    throw new Error(`No impact data matches "${moduleId}".`);
  }

  return {
    target: moduleId,
    targetKind: "module",
    changedFiles: rankedModule?.changedFiles ?? clusterMatches.flatMap((entry) => entry.changedFiles),
    impactedFiles: rankedModule?.impactedFiles ?? clusterMatches.flatMap((entry) => entry.impactedFiles),
    rankedFiles: relevantRankedFiles,
    clusters: clusterMatches.slice(0, 8)
  };
}

function findFileRelationship(graph: DependencyGraphState, target: string): DependencyGraphState["fileRelationships"][number] | null {
  return graph.fileRelationships.find((entry) => entry.file === target) ?? null;
}

function symbolExportsForFile(index: SymbolIndexState, file: string): string[] {
  return index.files.find((entry) => entry.file === file)?.exports ?? [];
}

function symbolLocalsForFile(index: SymbolIndexState, file: string): string[] {
  return index.files.find((entry) => entry.file === file)?.localFunctions ?? [];
}

function modulePeers(graph: DependencyGraphState, moduleGroup: string, file: string): string[] {
  return graph.fileRelationships
    .filter((entry) => entry.moduleGroup === moduleGroup && entry.file !== file)
    .map((entry) => entry.file)
    .sort((left, right) => left.localeCompare(right));
}

function deriveRelatedModules(
  graph: DependencyGraphState,
  files: string[]
): {
  imports: string[];
  importedBy: string[];
} {
  const fileSet = new Set(files);
  const moduleByFile = new Map(graph.fileRelationships.map((entry) => [entry.file, entry.moduleGroup] as const));
  const ownModules = new Set(files.map((file) => moduleByFile.get(file)).filter((value): value is string => Boolean(value)));
  const imports = new Set<string>();
  const importedBy = new Set<string>();

  for (const entry of graph.fileRelationships) {
    if (!fileSet.has(entry.file)) {
      continue;
    }
    for (const dependency of [...entry.imports, ...entry.callTargets, ...entry.relationships]) {
      const moduleGroup = moduleByFile.get(dependency);
      if (moduleGroup && !fileSet.has(dependency) && !ownModules.has(moduleGroup)) {
        imports.add(moduleGroup);
      }
    }
    for (const importer of entry.importedBy) {
      const moduleGroup = moduleByFile.get(importer);
      if (moduleGroup && !fileSet.has(importer) && !ownModules.has(moduleGroup)) {
        importedBy.add(moduleGroup);
      }
    }
  }

  return {
    imports: [...imports].sort((left, right) => left.localeCompare(right)),
    importedBy: [...importedBy].sort((left, right) => left.localeCompare(right))
  };
}

function topFilesForModule(
  artifacts: LoadedRepoIntelligenceArtifacts,
  moduleId: string,
  files: string[]
): string[] {
  const impactRanks = new Map(artifacts.impactMap.rankedFiles.map((entry) => [entry.file, entry.score] as const));
  const historyTouches = new Map(artifacts.historyGraph.hotspotFiles.map((entry) => [entry.file, entry.touches] as const));
  return [...files]
    .sort((left, right) => {
      const leftScore = (impactRanks.get(left) ?? 0) + (historyTouches.get(left) ?? 0);
      const rightScore = (impactRanks.get(right) ?? 0) + (historyTouches.get(right) ?? 0);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.localeCompare(right);
    })
    .slice(0, 8);
}

function normalizeQueryTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (path.isAbsolute(trimmed)) {
    return normalizeRepoPath(relativeFrom(process.cwd(), trimmed));
  }
  return normalizeRepoPath(trimmed);
}
