import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { WriteResult } from "../utils/fs.js";
import { ensureDir, pathExists, readJson, readText, relativeFrom, writeText } from "../utils/fs.js";
import type { ContextIndexFileRecord, ContextIndexState } from "./context-index.js";
import type { RepoContextOperatorView, RepoContextTreeState } from "./context-tree.js";
import { classifyFileArea, deriveTaskArea, deriveTaskCategory, tokenizeTaskText } from "./task-intent.js";
import { loadCurrentFocus, loadOpenRisks, type CurrentFocusRecord, type OpenRisksRecord } from "./memory.js";
import { loadCurrentPhase, loadLatestCheckpoint, loadLatestHandoff, loadLatestTaskPacketSet, type CheckpointRecord, type HandoffRecord, type LatestTaskPacketSet, type PhaseRecord } from "./state.js";
import { loadLatestReconcileReport, type ReconcileReport } from "./reconcile.js";
import type { ExecutionStateRecord, ExecutionStateEvent } from "./execution-state.js";
import type { RuntimeLifecycleState } from "./runtime-lifecycle.js";
import type { DecisionLogicState } from "./next-action.js";
import type { WorkflowState } from "./workflow-engine.js";

const execFile = promisify(execFileCallback);
const HISTORY_COMMIT_WINDOW = 40;

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
  decisionGraph: DecisionGraphState;
  historyGraph: HistoryGraphState;
  reviewGraph: ReviewGraphState;
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
  decisionGraphPath: string | null;
  historyGraphPath: string | null;
  reviewGraphPath: string | null;
  importantDecisions: number;
  hotspotFiles: number;
  reviewRiskTargets: number;
  agentPackAvailable: boolean;
  agentPackPath: string | null;
  agentPackSummary: string | null;
  taskPackAvailable: boolean;
  taskPackPath: string | null;
  taskPackTask: string | null;
  taskPackSummary: string | null;
  taskPackFiles: number;
  compactContextPackAvailable: boolean;
  compactContextPackPath: string | null;
  compactContextPackMode: CompactContextPack["mode"] | null;
  compactContextPackTask: string | null;
  compactContextPackSummary: string | null;
  compactContextPackFiles: number;
  reviewContextPackAvailable: boolean;
  reviewContextPackPath: string | null;
  reviewContextPackTask: string | null;
  reviewContextPackSummary: string | null;
}

export interface DecisionGraphState {
  artifactType: "kiwi-control/decision-graph";
  version: 1;
  generatedAt: string;
  currentTask: string | null;
  nodes: Array<{
    id: string;
    kind: "phase" | "checkpoint" | "handoff" | "reconcile" | "focus" | "task-packet-set" | "execution-event" | "runtime-lifecycle" | "open-risk" | "task" | "file" | "module";
    label: string;
    summary: string;
    timestamp: string | null;
    status: string | null;
    task: string | null;
  }>;
  edges: Array<{
    from: string;
    to: string;
    kind: "continues" | "references-task" | "touches-file" | "touches-module" | "points-to-artifact";
  }>;
  importantDecisions: Array<{
    id: string;
    kind: string;
    label: string;
    summary: string;
    status: string | null;
    task: string | null;
    relatedFiles: string[];
    relatedModules: string[];
    nextCommand: string | null;
  }>;
}

export interface HistoryGraphState {
  artifactType: "kiwi-control/history-graph";
  version: 1;
  generatedAt: string;
  commitWindow: number;
  gitHistoryAvailable: boolean;
  commitsAnalyzed: number;
  recentCommits: Array<{
    sha: string;
    authoredAt: string;
    subject: string;
    files: string[];
    modules: string[];
  }>;
  hotspotFiles: Array<{
    file: string;
    moduleGroup: string;
    touches: number;
    commits: number;
    lastTouchedAt: string | null;
  }>;
  hotspotModules: Array<{
    id: string;
    touches: number;
    commits: number;
    files: string[];
    lastTouchedAt: string | null;
  }>;
  repeatedTouchModules: Array<{
    id: string;
    touches: number;
    commits: number;
    files: string[];
  }>;
  changeClusters: Array<{
    id: string;
    commits: number;
    touches: number;
    files: string[];
    modules: string[];
  }>;
}

export interface ReviewGraphState {
  artifactType: "kiwi-control/review-graph";
  version: 1;
  generatedAt: string;
  status: "clear" | "attention";
  globalSignals: Array<{
    signal: string;
    detail: string;
    severity: "info" | "warn" | "high";
  }>;
  fileRisks: Array<{
    file: string;
    moduleGroup: string;
    score: number;
    reasons: string[];
    touches: number;
    failures: number;
    retries: number;
    entryPoint: boolean;
    reverseDependencyHub: boolean;
  }>;
  moduleRisks: Array<{
    id: string;
    score: number;
    reasons: string[];
    touches: number;
    failures: number;
    entryPoints: string[];
    files: string[];
  }>;
  reviewAttention: Array<{
    kind: "file" | "module" | "decision";
    target: string;
    score: number;
    reasons: string[];
  }>;
}

export interface ReviewContextPack {
  artifactType: "kiwi-control/review-context-pack";
  version: 1;
  generatedAt: string;
  summary: string;
  currentTask: string | null;
  readFirst: string[];
  decisions: DecisionGraphState["importantDecisions"];
  hotspots: Array<{
    kind: "file" | "module";
    target: string;
    touches: number;
    commits: number;
  }>;
  reviewAttention: ReviewGraphState["reviewAttention"];
  globalSignals: ReviewGraphState["globalSignals"];
}

export interface AgentPackState {
  artifactType: "kiwi-control/agent-pack";
  version: 1;
  generatedAt: string;
  summary: string;
  readFirst: string[];
  sourceOfTruthNote: string;
  repo: {
    summary: string;
    entryPoints: string[];
    keyModules: RepoMapState["keyModules"];
    topReverseDependencyHubs: RepoMapState["topReverseDependencyHubs"];
  };
  decisions: DecisionGraphState["importantDecisions"];
  hotspots: ReviewContextPack["hotspots"];
  reviewAttention: ReviewGraphState["reviewAttention"];
  packPointers: {
    repoMap: string;
    taskPack: string | null;
    reviewContextPack: string;
    compactContextPack: string | null;
    decisionGraph: string;
    historyGraph: string;
    reviewGraph: string;
  };
}

export interface TaskPackState {
  artifactType: "kiwi-control/task-pack";
  version: 1;
  generatedAt: string;
  task: string | null;
  summary: string;
  readFirst: string[];
  sourceOfTruthNote: string;
  focus: {
    mode: CompactContextPack["mode"];
    focusFiles: string[];
    missingFocusFiles: string[];
    files: CompactContextPack["files"];
    modules: CompactContextPack["modules"];
    dependencyChains: CompactContextPack["dependencyChains"];
    clusters: CompactContextPack["clusters"];
  };
  decisions: DecisionGraphState["importantDecisions"];
  reviewAttention: ReviewGraphState["reviewAttention"];
}

interface RepoHistoryCommit {
  sha: string;
  authoredAt: string;
  subject: string;
  files: string[];
}

export async function buildRepoIntelligenceArtifacts(options: {
  targetRoot: string;
  tree: RepoContextTreeState;
  view: RepoContextOperatorView;
  index: ContextIndexState;
}): Promise<RepoIntelligenceArtifacts> {
  const generatedAt = options.tree.timestamp;
  const repoMap = buildRepoMap(options.tree, options.view, options.index, generatedAt);
  const impactMap = buildImpactMap(options.index, generatedAt, repoMap);
  const decisionGraph = await buildDecisionGraph(options.targetRoot, options.index, generatedAt);
  const historyGraph = await buildHistoryGraph(options.targetRoot, options.index, generatedAt);
  const reviewGraph = buildReviewGraph({
    repoMap,
    impactMap,
    decisionGraph,
    historyGraph
  }, generatedAt);
  return {
    repoMap,
    symbolIndex: buildSymbolIndex(options.index, generatedAt),
    dependencyGraph: buildDependencyGraph(options.index, generatedAt),
    impactMap,
    decisionGraph,
    historyGraph,
    reviewGraph
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
    writeJsonArtifact(impactMapPath(targetRoot), artifacts.impactMap),
    writeJsonArtifact(decisionGraphPath(targetRoot), artifacts.decisionGraph),
    writeJsonArtifact(historyGraphPath(targetRoot), artifacts.historyGraph),
    writeJsonArtifact(reviewGraphPath(targetRoot), artifacts.reviewGraph)
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
  const [repoMap, impactMap, compactContextPack, reviewContextPack, agentPack, taskPack, hasSymbolIndex, hasDependencyGraph, hasDecisionGraph, hasHistoryGraph, hasReviewGraph, decisionGraph, historyGraph, reviewGraph] = await Promise.all([
    readJsonIfPresent<RepoMapState>(repoMapPath(targetRoot)),
    readJsonIfPresent<ImpactMapState>(impactMapPath(targetRoot)),
    readJsonIfPresent<CompactContextPack>(compactContextPackPath(targetRoot)),
    readJsonIfPresent<ReviewContextPack>(reviewContextPackPath(targetRoot)),
    readJsonIfPresent<AgentPackState>(agentPackPath(targetRoot)),
    readJsonIfPresent<TaskPackState>(taskPackPath(targetRoot)),
    pathExists(symbolIndexPath(targetRoot)),
    pathExists(dependencyGraphPath(targetRoot)),
    pathExists(decisionGraphPath(targetRoot)),
    pathExists(historyGraphPath(targetRoot)),
    pathExists(reviewGraphPath(targetRoot)),
    readJsonIfPresent<DecisionGraphState>(decisionGraphPath(targetRoot)),
    readJsonIfPresent<HistoryGraphState>(historyGraphPath(targetRoot)),
    readJsonIfPresent<ReviewGraphState>(reviewGraphPath(targetRoot))
  ]);

  if (!repoMap || !impactMap || !hasSymbolIndex || !hasDependencyGraph || !hasDecisionGraph || !hasHistoryGraph || !hasReviewGraph) {
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
      decisionGraphPath: null,
      historyGraphPath: null,
      reviewGraphPath: null,
      importantDecisions: 0,
      hotspotFiles: 0,
      reviewRiskTargets: 0,
      agentPackAvailable: false,
      agentPackPath: null,
      agentPackSummary: null,
      taskPackAvailable: false,
      taskPackPath: null,
      taskPackTask: null,
      taskPackSummary: null,
      taskPackFiles: 0,
      compactContextPackAvailable: false,
      compactContextPackPath: null,
      compactContextPackMode: null,
      compactContextPackTask: null,
      compactContextPackSummary: null,
      compactContextPackFiles: 0,
      reviewContextPackAvailable: false,
      reviewContextPackPath: null,
      reviewContextPackTask: null,
      reviewContextPackSummary: null
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
    decisionGraphPath: relativeFrom(targetRoot, decisionGraphPath(targetRoot)),
    historyGraphPath: relativeFrom(targetRoot, historyGraphPath(targetRoot)),
    reviewGraphPath: relativeFrom(targetRoot, reviewGraphPath(targetRoot)),
    entryPoints: repoMap.entryPoints,
    keyModules: repoMap.keyModules,
    topReverseDependencyHubs: repoMap.topReverseDependencyHubs,
    changedFiles: impactMap.changedFiles,
    impactedFiles: impactMap.impactedFiles,
    importantDecisions: decisionGraph?.importantDecisions.length ?? 0,
    hotspotFiles: historyGraph?.hotspotFiles.length ?? 0,
    reviewRiskTargets: reviewGraph?.reviewAttention.length ?? 0,
    agentPackAvailable: Boolean(agentPack),
    agentPackPath: agentPack ? relativeFrom(targetRoot, agentPackPath(targetRoot)) : null,
    agentPackSummary: agentPack?.summary ?? null,
    taskPackAvailable: Boolean(taskPack),
    taskPackPath: taskPack ? relativeFrom(targetRoot, taskPackPath(targetRoot)) : null,
    taskPackTask: taskPack?.task ?? null,
    taskPackSummary: taskPack?.summary ?? null,
    taskPackFiles: taskPack?.focus.files.length ?? 0,
    compactContextPackAvailable: Boolean(compactContextPack),
    compactContextPackPath: compactContextPack ? relativeFrom(targetRoot, compactContextPackPath(targetRoot)) : null,
    compactContextPackMode: compactContextPack?.mode ?? null,
    compactContextPackTask: compactContextPack?.task ?? null,
    compactContextPackSummary: compactContextPack?.summary ?? null,
    compactContextPackFiles: compactContextPack?.files.length ?? 0,
    reviewContextPackAvailable: Boolean(reviewContextPack),
    reviewContextPackPath: reviewContextPack ? relativeFrom(targetRoot, reviewContextPackPath(targetRoot)) : null,
    reviewContextPackTask: reviewContextPack?.currentTask ?? null,
    reviewContextPackSummary: reviewContextPack?.summary ?? null
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

async function buildDecisionGraph(
  targetRoot: string,
  index: ContextIndexState,
  generatedAt: string
): Promise<DecisionGraphState> {
  const [
    currentPhase,
    currentFocus,
    openRisks,
    latestCheckpoint,
    latestHandoff,
    latestTaskPacketSet,
    latestReconcile,
    executionState,
    runtimeLifecycle,
    decisionLogic,
    workflow,
    executionEvents
  ] = await Promise.all([
    loadCurrentPhase(targetRoot),
    loadCurrentFocus(targetRoot),
    loadOpenRisks(targetRoot),
    loadLatestCheckpoint(targetRoot),
    loadLatestHandoff(targetRoot),
    loadLatestTaskPacketSet(targetRoot),
    loadLatestReconcileReport(targetRoot),
    readJsonIfPresent<ExecutionStateRecord>(path.join(targetRoot, ".agent", "state", "execution-state.json")),
    readJsonIfPresent<RuntimeLifecycleState>(path.join(targetRoot, ".agent", "state", "runtime-lifecycle.json")),
    readJsonIfPresent<DecisionLogicState>(path.join(targetRoot, ".agent", "state", "decision-logic.json")),
    readJsonIfPresent<WorkflowState>(path.join(targetRoot, ".agent", "state", "workflow.json")),
    readExecutionEvents(targetRoot)
  ]);

  const nodes = new Map<string, DecisionGraphState["nodes"][number]>();
  const edges = new Map<string, DecisionGraphState["edges"][number]>();
  const taskNodeIds = new Map<string, string>();
  const fileNodeIds = new Map<string, string>();
  const moduleNodeIds = new Map<string, string>();
  const recordByFile = new Map(index.files.map((record) => [record.file, record] as const));

  const ensureTaskNode = (task: string | null | undefined): string | null => {
    if (!task) {
      return null;
    }
    const existing = taskNodeIds.get(task);
    if (existing) {
      return existing;
    }
    const id = `task:${task}`;
    taskNodeIds.set(task, id);
    nodes.set(id, {
      id,
      kind: "task",
      label: task,
      summary: task,
      timestamp: null,
      status: null,
      task
    });
    return id;
  };

  const ensureFileNode = (file: string): string => {
    const existing = fileNodeIds.get(file);
    if (existing) {
      return existing;
    }
    const id = `file:${file}`;
    fileNodeIds.set(file, id);
    nodes.set(id, {
      id,
      kind: "file",
      label: file,
      summary: file,
      timestamp: null,
      status: null,
      task: null
    });
    return id;
  };

  const ensureModuleNode = (moduleGroup: string): string => {
    const existing = moduleNodeIds.get(moduleGroup);
    if (existing) {
      return existing;
    }
    const id = `module:${moduleGroup}`;
    moduleNodeIds.set(moduleGroup, id);
    nodes.set(id, {
      id,
      kind: "module",
      label: moduleGroup,
      summary: moduleGroup,
      timestamp: null,
      status: null,
      task: null
    });
    return id;
  };

  const addEdge = (from: string, to: string, kind: DecisionGraphState["edges"][number]["kind"]): void => {
    edges.set(`${from}->${kind}->${to}`, { from, to, kind });
  };

  const linkNodeToFilesAndModules = (nodeId: string, files: string[]): void => {
    for (const file of uniqueStrings(files).slice(0, 16)) {
      const fileNodeId = ensureFileNode(file);
      addEdge(nodeId, fileNodeId, "touches-file");
      const moduleGroup = recordByFile.get(file)?.moduleGroup ?? deriveImpactClusterId(file);
      const moduleNodeId = ensureModuleNode(moduleGroup);
      addEdge(nodeId, moduleNodeId, "touches-module");
    }
  };

  const addDecisionNode = (node: DecisionGraphState["nodes"][number], relatedFiles: string[] = []): void => {
    nodes.set(node.id, node);
    const taskNodeId = ensureTaskNode(node.task);
    if (taskNodeId) {
      addEdge(node.id, taskNodeId, "references-task");
    }
    linkNodeToFilesAndModules(node.id, relatedFiles);
  };

  if (currentPhase) {
    addDecisionNode({
      id: `phase:${currentPhase.phaseId}`,
      kind: "phase",
      label: currentPhase.label,
      summary: currentPhase.goal,
      timestamp: currentPhase.timestamp,
      status: currentPhase.status,
      task: currentPhase.goal
    }, currentPhase.changedFilesSummary?.changedFiles ?? []);
  }

  if (latestCheckpoint) {
    addDecisionNode({
      id: `checkpoint:${latestCheckpoint.checkpointId}`,
      kind: "checkpoint",
      label: latestCheckpoint.phase,
      summary: latestCheckpoint.summary,
      timestamp: latestCheckpoint.createdAt,
      status: "recorded",
      task: latestCheckpoint.taskContext.goal
    }, [
      ...latestCheckpoint.filesTouched,
      ...latestCheckpoint.filesCreated,
      ...latestCheckpoint.filesDeleted
    ]);
  }

  if (latestHandoff) {
    addDecisionNode({
      id: `handoff:${latestHandoff.taskId}`,
      kind: "handoff",
      label: `${latestHandoff.fromRole} -> ${latestHandoff.toRole}`,
      summary: latestHandoff.summary,
      timestamp: latestHandoff.createdAt,
      status: latestHandoff.status,
      task: latestHandoff.goal
    }, latestHandoff.filesTouched);
  }

  if (latestReconcile) {
    addDecisionNode({
      id: `reconcile:${latestReconcile.dispatchId}`,
      kind: "reconcile",
      label: latestReconcile.dispatchId,
      summary: latestReconcile.recommendedNextStep,
      timestamp: latestReconcile.createdAt,
      status: latestReconcile.status,
      task: null
    });
  }

  if (currentFocus) {
    addDecisionNode({
      id: "focus:current",
      kind: "focus",
      label: currentFocus.focusOwnerRole,
      summary: currentFocus.currentFocus,
      timestamp: currentFocus.updatedAt,
      status: "active",
      task: extractTaskFromCommand(currentFocus.nextSuggestedCommand)
    }, currentFocus.nextFileToRead ? [currentFocus.nextFileToRead] : []);
  }

  if (latestTaskPacketSet) {
    addDecisionNode({
      id: `task-packet-set:${latestTaskPacketSet.createdAt}`,
      kind: "task-packet-set",
      label: latestTaskPacketSet.packetSet,
      summary: `Latest packet set with ${latestTaskPacketSet.files.length} file(s).`,
      timestamp: latestTaskPacketSet.createdAt,
      status: "ready",
      task: null
    }, latestTaskPacketSet.files);
  }

  if (executionState) {
    addDecisionNode({
      id: `execution-state:${executionState.revision}`,
      kind: "execution-event",
      label: executionState.lifecycle,
      summary: executionState.reason ?? executionState.nextCommand ?? "Execution state recorded.",
      timestamp: executionState.lastUpdatedAt,
      status: executionState.lifecycle,
      task: executionState.task
    }, flattenArtifactFiles(executionState.artifacts));
  }

  if (runtimeLifecycle) {
    addDecisionNode({
      id: `runtime-lifecycle:${runtimeLifecycle.timestamp}`,
      kind: "runtime-lifecycle",
      label: runtimeLifecycle.currentStage,
      summary: runtimeLifecycle.nextRecommendedAction ?? runtimeLifecycle.nextSuggestedCommand ?? "Runtime lifecycle recorded.",
      timestamp: runtimeLifecycle.timestamp,
      status: runtimeLifecycle.validationStatus,
      task: runtimeLifecycle.currentTask
    }, runtimeLifecycle.recentEvents.flatMap((event) => event.files).slice(0, 24));
  }

  for (const event of executionEvents.slice(0, 10)) {
    addDecisionNode({
      id: `execution-event:${event.revision}`,
      kind: "execution-event",
      label: event.type,
      summary: event.reason ?? event.nextCommand ?? event.type,
      timestamp: event.recordedAt,
      status: event.lifecycle,
      task: event.task
    }, flattenArtifactFiles(event.artifacts));
  }

  if (openRisks && openRisks.risks.length > 0) {
    openRisks.risks.slice(0, 8).forEach((risk, index) => {
      addDecisionNode({
        id: `open-risk:${index}`,
        kind: "open-risk",
        label: "open risk",
        summary: risk,
        timestamp: openRisks.updatedAt,
        status: "warn",
        task: null
      });
    });
  }

  if (decisionLogic) {
    const taskNodeId = ensureTaskNode(executionState?.task ?? runtimeLifecycle?.currentTask ?? null);
    if (taskNodeId) {
      const decisionNodeId = "focus:current";
      if (nodes.has(decisionNodeId)) {
        addEdge(decisionNodeId, taskNodeId, "continues");
      }
    }
  }

  const importantDecisions = [...nodes.values()]
    .filter((node) => !["file", "module", "task"].includes(node.kind))
    .sort((left, right) => {
      const leftTime = left.timestamp ?? "";
      const rightTime = right.timestamp ?? "";
      return rightTime.localeCompare(leftTime);
    })
    .slice(0, 12)
    .map((node) => {
      const relatedFiles = [...edges.values()]
        .filter((edge) => edge.from === node.id && edge.kind === "touches-file")
        .map((edge) => edge.to.replace(/^file:/, ""))
        .slice(0, 8);
      const relatedModules = [...edges.values()]
        .filter((edge) => edge.from === node.id && edge.kind === "touches-module")
        .map((edge) => edge.to.replace(/^module:/, ""))
        .slice(0, 6);
      return {
        id: node.id,
        kind: node.kind,
        label: node.label,
        summary: node.summary,
        status: node.status,
        task: node.task,
        relatedFiles,
        relatedModules,
        nextCommand: extractCommandFromDecisionNode(node, currentFocus, latestCheckpoint, latestHandoff, latestReconcile, executionState, workflow)
      };
    });

  return {
    artifactType: "kiwi-control/decision-graph",
    version: 1,
    generatedAt,
    currentTask: executionState?.task ?? runtimeLifecycle?.currentTask ?? null,
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to) || left.kind.localeCompare(right.kind)),
    importantDecisions
  };
}

async function buildHistoryGraph(
  targetRoot: string,
  index: ContextIndexState,
  generatedAt: string
): Promise<HistoryGraphState> {
  const commits = await readRecentGitHistory(targetRoot, HISTORY_COMMIT_WINDOW);
  const recordByFile = new Map(index.files.map((record) => [record.file, record] as const));
  const fileTouches = new Map<string, { touches: number; commits: Set<string>; lastTouchedAt: string | null }>();
  const moduleTouches = new Map<string, { touches: number; commits: Set<string>; files: Set<string>; lastTouchedAt: string | null }>();
  const clusterTouches = new Map<string, { commits: Set<string>; touches: number; files: Set<string>; modules: Set<string> }>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const moduleGroup = recordByFile.get(file)?.moduleGroup ?? deriveImpactClusterId(file);
      const fileEntry = fileTouches.get(file) ?? { touches: 0, commits: new Set<string>(), lastTouchedAt: null };
      fileEntry.touches += 1;
      fileEntry.commits.add(commit.sha);
      fileEntry.lastTouchedAt = !fileEntry.lastTouchedAt || commit.authoredAt > fileEntry.lastTouchedAt ? commit.authoredAt : fileEntry.lastTouchedAt;
      fileTouches.set(file, fileEntry);

      const moduleEntry = moduleTouches.get(moduleGroup) ?? { touches: 0, commits: new Set<string>(), files: new Set<string>(), lastTouchedAt: null };
      moduleEntry.touches += 1;
      moduleEntry.commits.add(commit.sha);
      moduleEntry.files.add(file);
      moduleEntry.lastTouchedAt = !moduleEntry.lastTouchedAt || commit.authoredAt > moduleEntry.lastTouchedAt ? commit.authoredAt : moduleEntry.lastTouchedAt;
      moduleTouches.set(moduleGroup, moduleEntry);

      const clusterId = deriveImpactClusterId(file);
      const clusterEntry = clusterTouches.get(clusterId) ?? { commits: new Set<string>(), touches: 0, files: new Set<string>(), modules: new Set<string>() };
      clusterEntry.commits.add(commit.sha);
      clusterEntry.touches += 1;
      clusterEntry.files.add(file);
      clusterEntry.modules.add(moduleGroup);
      clusterTouches.set(clusterId, clusterEntry);
    }
  }

  const hotspotFiles = [...fileTouches.entries()]
    .map(([file, entry]) => ({
      file,
      moduleGroup: recordByFile.get(file)?.moduleGroup ?? deriveImpactClusterId(file),
      touches: entry.touches,
      commits: entry.commits.size,
      lastTouchedAt: entry.lastTouchedAt
    }))
    .sort((left, right) => right.touches - left.touches || right.commits - left.commits || left.file.localeCompare(right.file))
    .slice(0, 24);

  const hotspotModules = [...moduleTouches.entries()]
    .map(([id, entry]) => ({
      id,
      touches: entry.touches,
      commits: entry.commits.size,
      files: [...entry.files].sort((left, right) => left.localeCompare(right)),
      lastTouchedAt: entry.lastTouchedAt
    }))
    .sort((left, right) => right.touches - left.touches || right.commits - left.commits || left.id.localeCompare(right.id))
    .slice(0, 16);

  const repeatedTouchModules = hotspotModules
    .filter((entry) => entry.touches >= 2 && entry.commits >= 2)
    .slice(0, 12);

  const changeClusters = [...clusterTouches.entries()]
    .map(([id, entry]) => ({
      id,
      commits: entry.commits.size,
      touches: entry.touches,
      files: [...entry.files].sort((left, right) => left.localeCompare(right)),
      modules: [...entry.modules].sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => right.touches - left.touches || right.commits - left.commits || left.id.localeCompare(right.id))
    .slice(0, 16);

  return {
    artifactType: "kiwi-control/history-graph",
    version: 1,
    generatedAt,
    commitWindow: HISTORY_COMMIT_WINDOW,
    gitHistoryAvailable: commits.length > 0,
    commitsAnalyzed: commits.length,
    recentCommits: commits.slice(0, 12).map((commit) => ({
      sha: commit.sha,
      authoredAt: commit.authoredAt,
      subject: commit.subject,
      files: commit.files,
      modules: uniqueStrings(commit.files.map((file) => recordByFile.get(file)?.moduleGroup ?? deriveImpactClusterId(file)))
    })),
    hotspotFiles,
    hotspotModules,
    repeatedTouchModules,
    changeClusters
  };
}

function buildReviewGraph(
  options: {
    repoMap: RepoMapState;
    impactMap: ImpactMapState;
    decisionGraph: DecisionGraphState;
    historyGraph: HistoryGraphState;
  },
  generatedAt: string
): ReviewGraphState {
  const entryPoints = new Set(options.repoMap.entryPoints);
  const hubs = new Set(options.repoMap.topReverseDependencyHubs.map((entry) => entry.file));
  const decisionFileCounts = new Map<string, number>();
  const failureFileCounts = new Map<string, number>();
  let blockedDecisionCount = 0;

  for (const decision of options.decisionGraph.importantDecisions) {
    if (decision.status === "blocked" || decision.status === "failed") {
      blockedDecisionCount += 1;
    }
    for (const file of decision.relatedFiles) {
      decisionFileCounts.set(file, (decisionFileCounts.get(file) ?? 0) + 1);
      if (decision.status === "blocked" || decision.status === "failed") {
        failureFileCounts.set(file, (failureFileCounts.get(file) ?? 0) + 1);
      }
    }
  }

  const historyFiles = new Map(options.historyGraph.hotspotFiles.map((entry) => [entry.file, entry] as const));
  const impactFiles = new Map(options.impactMap.rankedFiles.map((entry) => [entry.file, entry] as const));

  const fileRisks = uniqueStrings([
    ...options.impactMap.rankedFiles.map((entry) => entry.file),
    ...options.historyGraph.hotspotFiles.map((entry) => entry.file),
    ...[...decisionFileCounts.keys()]
  ]).map((file) => {
    const impact = impactFiles.get(file);
    const history = historyFiles.get(file);
    const reasons = new Set<string>();
    let score = 0;

    if (impact) {
      score += Math.min(Math.round(impact.score / 2), 90);
      for (const reason of impact.reasons.slice(0, 4)) {
        reasons.add(reason);
      }
    }
    if (history) {
      score += history.touches * 8;
      if (history.commits >= 2) {
        reasons.add("repeated touches");
      }
      reasons.add("history hotspot");
    }
    const failureCount = failureFileCounts.get(file) ?? 0;
    if (failureCount > 0) {
      score += failureCount * 18;
      reasons.add("failure-linked");
    }
    const retryCount = decisionFileCounts.get(file) ?? 0;
    if (retryCount > 1) {
      score += (retryCount - 1) * 6;
      reasons.add("repeated decision attention");
    }
    if (entryPoints.has(file)) {
      score += 12;
      reasons.add("entry point");
    }
    if (hubs.has(file)) {
      score += 10;
      reasons.add("dependency hub");
    }

    return {
      file,
      moduleGroup: impact?.moduleGroup ?? history?.moduleGroup ?? deriveImpactClusterId(file),
      score,
      reasons: [...reasons].sort((left, right) => left.localeCompare(right)),
      touches: history?.touches ?? 0,
      failures: failureCount,
      retries: retryCount > 0 ? retryCount - 1 : 0,
      entryPoint: entryPoints.has(file),
      reverseDependencyHub: hubs.has(file)
    };
  }).filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
    .slice(0, 24);

  const moduleRisks = options.historyGraph.hotspotModules
    .map((entry) => {
      const moduleImpact = options.impactMap.rankedModules.find((item) => item.id === entry.id);
      const failures = fileRisks.filter((file) => file.moduleGroup === entry.id).reduce((total, file) => total + file.failures, 0);
      const score = entry.touches * 10 + (moduleImpact?.score ?? 0) + failures * 15 + entry.commits * 4;
      const reasons = new Set<string>();
      if (entry.touches >= 2) reasons.add("repeated touches");
      if ((moduleImpact?.changedFiles.length ?? 0) > 0) reasons.add("active change cluster");
      if (failures > 0) reasons.add("failure-linked");
      if (entry.files.some((file) => entryPoints.has(file))) reasons.add("contains entry point");
      return {
        id: entry.id,
        score,
        reasons: [...reasons].sort((left, right) => left.localeCompare(right)),
        touches: entry.touches,
        failures,
        entryPoints: entry.files.filter((file) => entryPoints.has(file)),
        files: entry.files.slice(0, 8)
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 16);

  const globalSignals: ReviewGraphState["globalSignals"] = [];
  if (blockedDecisionCount > 0) {
    globalSignals.push({
      signal: "blocked decisions",
      detail: `${blockedDecisionCount} recent decision(s) are blocked or failed.`,
      severity: "high"
    });
  }
  if (options.historyGraph.repeatedTouchModules.length > 0) {
    globalSignals.push({
      signal: "repeated-touch modules",
      detail: `${options.historyGraph.repeatedTouchModules.length} module(s) have repeated recent touches.`,
      severity: "warn"
    });
  }
  if (options.decisionGraph.importantDecisions.some((entry) => entry.kind === "open-risk")) {
    globalSignals.push({
      signal: "open risks",
      detail: "Repo-local open risks are present in continuity state.",
      severity: "warn"
    });
  }

  const reviewAttention = [
    ...fileRisks.slice(0, 8).map((entry) => ({
      kind: "file" as const,
      target: entry.file,
      score: entry.score,
      reasons: entry.reasons
    })),
    ...moduleRisks.slice(0, 6).map((entry) => ({
      kind: "module" as const,
      target: entry.id,
      score: entry.score,
      reasons: entry.reasons
    })),
    ...options.decisionGraph.importantDecisions
      .filter((entry) => entry.status === "blocked" || entry.status === "failed")
      .slice(0, 4)
      .map((entry) => ({
        kind: "decision" as const,
        target: entry.label,
        score: 90,
        reasons: [entry.status ?? "attention", entry.summary]
      }))
  ].sort((left, right) => right.score - left.score || left.target.localeCompare(right.target))
    .slice(0, 16);

  return {
    artifactType: "kiwi-control/review-graph",
    version: 1,
    generatedAt,
    status: reviewAttention.length > 0 ? "attention" : "clear",
    globalSignals,
    fileRisks,
    moduleRisks,
    reviewAttention
  };
}

export function buildReviewContextPack(options: {
  targetRoot: string;
  decisionGraph: DecisionGraphState;
  historyGraph: HistoryGraphState;
  reviewGraph: ReviewGraphState;
  task?: string | null;
}): ReviewContextPack {
  return {
    artifactType: "kiwi-control/review-context-pack",
    version: 1,
    generatedAt: new Date().toISOString(),
    summary:
      options.reviewGraph.reviewAttention.length > 0
        ? `Review attention is concentrated in ${options.reviewGraph.reviewAttention[0]?.target ?? "recent changes"} with ${options.reviewGraph.reviewAttention.length} ranked targets.`
        : "No elevated review targets are currently ranked.",
    currentTask: options.task ?? options.decisionGraph.currentTask,
    readFirst: [
      ".agent/state/decision-graph.json",
      ".agent/state/history-graph.json",
      ".agent/state/review-graph.json",
      ".agent/state/checkpoints/latest.json",
      ".agent/memory/current-focus.json",
      ".agent/state/execution-state.json",
      ".agent/state/execution-events.ndjson"
    ],
    decisions: options.decisionGraph.importantDecisions.slice(0, 8),
    hotspots: [
      ...options.historyGraph.hotspotFiles.slice(0, 4).map((entry) => ({
        kind: "file" as const,
        target: entry.file,
        touches: entry.touches,
        commits: entry.commits
      })),
      ...options.historyGraph.hotspotModules.slice(0, 4).map((entry) => ({
        kind: "module" as const,
        target: entry.id,
        touches: entry.touches,
        commits: entry.commits
      }))
    ],
    reviewAttention: options.reviewGraph.reviewAttention.slice(0, 10),
    globalSignals: options.reviewGraph.globalSignals
  };
}

export function buildAgentPack(options: {
  repoMap: RepoMapState;
  decisionGraph: DecisionGraphState;
  historyGraph: HistoryGraphState;
  reviewGraph: ReviewGraphState;
  compactContextPack?: CompactContextPack | null;
  reviewContextPack?: ReviewContextPack | null;
}): AgentPackState {
  return {
    artifactType: "kiwi-control/agent-pack",
    version: 1,
    generatedAt: new Date().toISOString(),
    summary:
      `${options.repoMap.summary} Start with runtime truth, then use the task or review pack instead of the full graph when you do not need global repo exploration.`,
    readFirst: [
      ".agent/context/agent-pack.json",
      ".agent/state/execution-state.json",
      ".agent/state/execution-events.ndjson",
      ".agent/context/task-pack.json",
      ".agent/context/review-context-pack.json",
      ".agent/context/repo-map.json"
    ],
    sourceOfTruthNote:
      "Canonical workflow truth remains runtime-backed execution state and execution events. Agent packs are compact read aids, not authority.",
    repo: {
      summary: options.repoMap.summary,
      entryPoints: options.repoMap.entryPoints.slice(0, 12),
      keyModules: options.repoMap.keyModules.slice(0, 6),
      topReverseDependencyHubs: options.repoMap.topReverseDependencyHubs.slice(0, 8)
    },
    decisions: options.decisionGraph.importantDecisions.slice(0, 6),
    hotspots: [
      ...options.historyGraph.hotspotFiles.slice(0, 4).map((entry) => ({
        kind: "file" as const,
        target: entry.file,
        touches: entry.touches,
        commits: entry.commits
      })),
      ...options.historyGraph.hotspotModules.slice(0, 4).map((entry) => ({
        kind: "module" as const,
        target: entry.id,
        touches: entry.touches,
        commits: entry.commits
      }))
    ],
    reviewAttention: options.reviewGraph.reviewAttention.slice(0, 8),
    packPointers: {
      repoMap: ".agent/context/repo-map.json",
      taskPack: options.compactContextPack ? ".agent/context/task-pack.json" : null,
      reviewContextPack: options.reviewContextPack ? ".agent/context/review-context-pack.json" : ".agent/context/review-context-pack.json",
      compactContextPack: options.compactContextPack ? ".agent/context/compact-context-pack.json" : null,
      decisionGraph: ".agent/state/decision-graph.json",
      historyGraph: ".agent/state/history-graph.json",
      reviewGraph: ".agent/state/review-graph.json"
    }
  };
}

export function buildTaskPack(options: {
  compactContextPack: CompactContextPack;
  decisionGraph: DecisionGraphState;
  reviewGraph: ReviewGraphState;
  task?: string | null;
}): TaskPackState {
  const currentTask = options.task ?? options.compactContextPack.task;
  const focusFiles = new Set(options.compactContextPack.files.map((entry) => entry.file));
  const relatedDecisionAttention = options.decisionGraph.importantDecisions.filter((decision) =>
    decision.relatedFiles.some((file) => focusFiles.has(file)) || (currentTask && decision.task === currentTask)
  );
  const reviewAttention = options.reviewGraph.reviewAttention.filter((entry) =>
    entry.kind === "decision"
      ? true
      : focusFiles.has(entry.target) || options.compactContextPack.modules.some((module) => module.id === entry.target)
  );

  return {
    artifactType: "kiwi-control/task-pack",
    version: 1,
    generatedAt: new Date().toISOString(),
    task: currentTask ?? null,
    summary:
      `${options.compactContextPack.summary} Read this first when you are implementing or editing code for the current task.`,
    readFirst: [
      ".agent/context/task-pack.json",
      ".agent/state/execution-state.json",
      ".agent/state/execution-events.ndjson",
      ".agent/memory/current-focus.json",
      ".agent/context/generated-instructions.md",
      ".agent/state/impact-map.json"
    ],
    sourceOfTruthNote:
      "Runtime-backed execution state remains canonical. The task pack narrows context for implementation and should be treated as a compact working set.",
    focus: {
      mode: options.compactContextPack.mode,
      focusFiles: options.compactContextPack.focusFiles,
      missingFocusFiles: options.compactContextPack.missingFocusFiles,
      files: options.compactContextPack.files,
      modules: options.compactContextPack.modules,
      dependencyChains: options.compactContextPack.dependencyChains,
      clusters: options.compactContextPack.clusters
    },
    decisions: relatedDecisionAttention.slice(0, 6),
    reviewAttention: reviewAttention.slice(0, 6)
  };
}

async function readExecutionEvents(targetRoot: string): Promise<ExecutionStateEvent[]> {
  const filePath = path.join(targetRoot, ".agent", "state", "execution-events.ndjson");
  if (!(await pathExists(filePath))) {
    return [];
  }

  const payload = await readText(filePath);
  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as ExecutionStateEvent;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is ExecutionStateEvent => Boolean(entry));
}

async function readRecentGitHistory(targetRoot: string, limit: number): Promise<RepoHistoryCommit[]> {
  if (!(await pathExists(path.join(targetRoot, ".git")))) {
    return [];
  }

  try {
    const { stdout } = await execFile(
      "git",
      [
        "log",
        "--date=iso-strict",
        `-n`,
        String(limit),
        "--name-only",
        "--pretty=format:__COMMIT__%n%H%n%ad%n%s"
      ],
      {
        cwd: targetRoot,
        encoding: "utf8"
      }
    );

    const chunks = stdout.split("__COMMIT__").map((chunk) => chunk.trim()).filter(Boolean);
    return chunks.map((chunk) => {
      const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
      const [sha = "", authoredAt = "", subject = "", ...files] = lines;
      return {
        sha,
        authoredAt,
        subject,
        files: uniqueStrings(files.filter((file) => shouldIncludeHistoryFile(file)))
      };
    }).filter((commit) => commit.sha.length > 0);
  } catch {
    return [];
  }
}

function flattenArtifactFiles(artifacts: Record<string, string[]> | undefined): string[] {
  if (!artifacts) {
    return [];
  }
  return uniqueStrings(Object.values(artifacts).flatMap((items) => items));
}

function extractTaskFromCommand(command: string | null | undefined): string | null {
  if (!command) {
    return null;
  }
  const match = command.match(/"([^"]+)"/);
  return match?.[1] ?? null;
}

function extractCommandFromDecisionNode(
  node: DecisionGraphState["nodes"][number],
  currentFocus: CurrentFocusRecord | null,
  latestCheckpoint: CheckpointRecord | null,
  latestHandoff: HandoffRecord | null,
  latestReconcile: ReconcileReport | null,
  executionState: ExecutionStateRecord | null,
  workflow: WorkflowState | null
): string | null {
  if (node.kind === "focus") {
    return currentFocus?.nextSuggestedCommand ?? null;
  }
  if (node.kind === "checkpoint") {
    return latestCheckpoint?.nextSuggestedCommand ?? null;
  }
  if (node.kind === "handoff") {
    return latestHandoff?.nextCommand ?? null;
  }
  if (node.kind === "reconcile") {
    return latestReconcile?.recommendedNextStep ?? null;
  }
  if (node.kind === "execution-event") {
    return executionState?.nextCommand ?? workflow?.steps.find((step) => step.status === "failed")?.result.retryCommand ?? null;
  }
  return null;
}

function shouldIncludeHistoryFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (!normalized || lower.startsWith(".agent/")) {
    return false;
  }
  if (
    lower.includes("/node_modules/")
    || lower.includes("/dist/")
    || lower.includes("/dist-types/")
    || lower.includes("/build/")
    || lower.includes("/.git.backup-")
    || lower.startsWith(".git.backup-")
    || lower.includes("/target/")
    || lower.includes("/coverage/")
    || lower.includes("/.next/")
    || lower.includes("/.turbo/")
    || lower.includes("/.cache/")
  ) {
    return false;
  }
  if (
    lower.endsWith(".tsbuildinfo")
    || lower.endsWith(".map")
    || lower.endsWith(".log")
    || lower.includes("/._")
    || lower.startsWith("._")
  ) {
    return false;
  }
  return true;
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

function decisionGraphPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "decision-graph.json");
}

function historyGraphPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "history-graph.json");
}

function reviewGraphPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "review-graph.json");
}

function reviewContextPackPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "context", "review-context-pack.json");
}

function agentPackPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "context", "agent-pack.json");
}

function taskPackPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "context", "task-pack.json");
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

export async function persistReviewContextPack(
  targetRoot: string,
  reviewContextPack: ReviewContextPack
): Promise<WriteResult> {
  return writeJsonArtifact(reviewContextPackPath(targetRoot), reviewContextPack);
}

export async function persistAgentPack(
  targetRoot: string,
  agentPack: AgentPackState
): Promise<WriteResult> {
  return writeJsonArtifact(agentPackPath(targetRoot), agentPack);
}

export async function persistTaskPack(
  targetRoot: string,
  taskPack: TaskPackState
): Promise<WriteResult> {
  return writeJsonArtifact(taskPackPath(targetRoot), taskPack);
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
