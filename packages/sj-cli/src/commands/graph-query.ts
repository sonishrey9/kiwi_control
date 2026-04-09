import path from "node:path";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import {
  buildRepoIntelligenceArtifacts,
  loadRepoIntelligenceArtifacts,
  persistRepoIntelligenceArtifacts
} from "@shrey-junior/sj-core/core/repo-intelligence.js";
import {
  queryFileSummary,
  queryImpact,
  queryModuleSummary,
  queryNeighbors,
  querySymbolLookup
} from "@shrey-junior/sj-core/core/graph-query.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { normalizeRepoPath, relativeFrom } from "@shrey-junior/sj-core/utils/fs.js";
import { queryRuntimeRepoGraph, type RepoGraphEdge, type RepoGraphNodeResult } from "@shrey-junior/sj-core/runtime/client.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface GraphQueryOptions {
  repoRoot: string;
  targetRoot: string;
  file?: string;
  symbol?: string;
  neighbors?: string;
  impact?: string;
  module?: string;
  json?: boolean;
  logger: Logger;
}

export async function runGraphQuery(options: GraphQueryOptions): Promise<number> {
  const modes = [
    options.file ? "file" : null,
    options.symbol ? "symbol" : null,
    options.neighbors ? "neighbors" : null,
    options.impact ? "impact" : null,
    options.module ? "module" : null
  ].filter(Boolean);

  if (modes.length !== 1) {
    throw new Error("graph-query requires exactly one of --file, --symbol, --neighbors, --impact, or --module.");
  }

  let artifacts = await loadRepoIntelligenceArtifacts(options.targetRoot);
  if (!artifacts) {
    artifacts = await rebuildRepoIntelligence(options.repoRoot, options.targetRoot);
  }
  if (!artifacts) {
    throw new Error("Repo intelligence artifacts are unavailable.");
  }

  const normalizedFileTarget = (value: string): string => {
    if (path.isAbsolute(value)) {
      return normalizeRepoPath(relativeFrom(options.targetRoot, value));
    }
    return normalizeRepoPath(value);
  };

  const runtimePayload = await tryRuntimeGraphQuery(options, normalizedFileTarget);
  if (runtimePayload) {
    if (options.json) {
      options.logger.info(JSON.stringify(runtimePayload, null, 2));
      return 0;
    }
    options.logger.info(typeof runtimePayload.summary === "string" ? runtimePayload.summary : "graph query complete");
    return 0;
  }

  const runQuery = (bundle: NonNullable<typeof artifacts>) =>
    options.file
      ? queryFileSummary(bundle, normalizedFileTarget(options.file))
      : options.symbol
        ? querySymbolLookup(bundle, options.symbol)
        : options.neighbors
          ? queryNeighbors(bundle, normalizedFileTarget(options.neighbors))
          : options.impact
            ? queryImpact(bundle, normalizedFileTarget(options.impact))
            : queryModuleSummary(bundle, normalizeRepoPath(options.module!));

  let payload;
  try {
    payload = runQuery(artifacts);
  } catch {
    const rebuilt = await rebuildRepoIntelligence(options.repoRoot, options.targetRoot);
    if (!rebuilt) {
      throw new Error("Repo intelligence artifacts are unavailable.");
    }
    payload = runQuery(rebuilt);
  }

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  options.logger.info(payload.summary);
  return 0;
}

async function tryRuntimeGraphQuery(
  options: GraphQueryOptions,
  normalizedFileTarget: (value: string) => string
): Promise<Record<string, unknown> | null> {
  try {
    if (options.file) {
      const file = normalizedFileTarget(options.file);
      return runtimeFilePayload(file, await queryRuntimeRepoGraph(options.targetRoot, "file", { path: file }));
    }
    if (options.symbol) {
      return runtimeSymbolPayload(options.symbol, await queryRuntimeRepoGraph(options.targetRoot, "symbol", { symbol: options.symbol }));
    }
    if (options.module) {
      const module = normalizeRepoPath(options.module);
      return runtimeModulePayload(module, await queryRuntimeRepoGraph(options.targetRoot, "module", { moduleId: module }));
    }
    if (options.neighbors) {
      const target = normalizedFileTarget(options.neighbors);
      return runtimeNeighborsPayload(target, await queryRuntimeRepoGraph(options.targetRoot, "neighbors", target.includes("/") || target.includes(".") ? { path: target } : { moduleId: target }));
    }
    if (options.impact) {
      const target = normalizedFileTarget(options.impact);
      return runtimeImpactPayload(target, await queryRuntimeRepoGraph(options.targetRoot, "impact", target.includes("/") || target.includes(".") ? { path: target } : { moduleId: target }));
    }
  } catch {
    return null;
  }
  return null;
}

function runtimeFilePayload(target: string, result: RepoGraphNodeResult): Record<string, unknown> | null {
  if (!result.node) return null;
  return {
    mode: "file",
    target,
    summary: `File summary for ${target} from normalized runtime graph revision ${result.status.graphRevision}.`,
    file: {
      file: result.node.path ?? target,
      moduleGroup: result.node.moduleId,
      imports: edgeEvidenceStrings(result.outgoing, "imports", "to"),
      importedBy: edgeEvidenceStrings(result.incoming, "imports", "from"),
      relationships: result.outgoing.map((edge) => edge.edgeKind),
      impact: {
        changed: result.outgoing.some((edge) => edge.edgeKind === "impacts"),
        score: result.incoming.filter((edge) => edge.edgeKind === "impacts").length + result.outgoing.filter((edge) => edge.edgeKind === "impacts").length,
        incoming: result.incoming.filter((edge) => edge.edgeKind === "impacts").length,
        outgoing: result.outgoing.filter((edge) => edge.edgeKind === "impacts").length
      }
    },
    graph: graphStatusSummary(result)
  };
}

function runtimeSymbolPayload(symbol: string, result: RepoGraphNodeResult): Record<string, unknown> | null {
  if (result.matches.length === 0) return null;
  return {
    mode: "symbol",
    target: symbol,
    summary: `Found ${result.matches.length} symbol match(es) for "${symbol}" in the normalized runtime graph.`,
    symbol: {
      symbol,
      matches: result.matches.map((node) => ({
        symbol: node.symbol,
        file: node.path,
        moduleGroup: node.moduleId,
        kind: typeof node.attributes === "object" && node.attributes && "kind" in node.attributes
          ? (node.attributes as { kind?: string }).kind
          : node.nodeKind
      }))
    },
    graph: graphStatusSummary(result)
  };
}

function runtimeModulePayload(module: string, result: RepoGraphNodeResult): Record<string, unknown> | null {
  if (result.matches.length === 0) return null;
  return {
    mode: "module",
    target: module,
    summary: `Module summary for ${module} from normalized runtime graph revision ${result.status.graphRevision}.`,
    module: {
      module,
      files: edgeEvidenceStrings(result.outgoing, "contains", "file").length > 0
        ? edgeEvidenceStrings(result.outgoing, "contains", "file")
        : result.matches.filter((node) => node.nodeKind === "file").map((node) => node.path).filter((value): value is string => Boolean(value)),
      imports: edgeEvidenceStrings(result.outgoing, "imports", "toModule"),
      importedBy: edgeEvidenceStrings(result.incoming, "imports", "fromModule"),
      symbols: result.matches.filter((node) => node.nodeKind === "symbol").map((node) => node.symbol).filter(Boolean).slice(0, 40)
    },
    graph: graphStatusSummary(result)
  };
}

function runtimeNeighborsPayload(target: string, result: RepoGraphNodeResult): Record<string, unknown> | null {
  if (!result.node) return null;
  return {
    mode: "neighbors",
    target,
    summary: `Neighbor query for ${target} from normalized runtime graph revision ${result.status.graphRevision}.`,
    neighbors: {
      target,
      targetKind: "file",
      imports: edgeEvidenceStrings(result.outgoing, "imports", "to"),
      importedBy: edgeEvidenceStrings(result.incoming, "imports", "from"),
      outgoing: result.outgoing.map(edgeSummary),
      incoming: result.incoming.map(edgeSummary)
    },
    graph: graphStatusSummary(result)
  };
}

function runtimeImpactPayload(target: string, result: RepoGraphNodeResult): Record<string, unknown> | null {
  if (!result.node) return null;
  return {
    mode: "impact",
    target,
    summary: `Impact query for ${target} from normalized runtime graph revision ${result.status.graphRevision}.`,
    impact: {
      target,
      targetKind: "file",
      rankedFiles: [
        {
          file: result.node.path ?? target,
          score: result.incoming.length + result.outgoing.length
        },
        ...edgeEvidenceStrings(result.outgoing, "impacts", "to").map((file) => ({ file, score: 1 }))
      ],
      incoming: result.incoming.map(edgeSummary),
      outgoing: result.outgoing.map(edgeSummary)
    },
    graph: graphStatusSummary(result)
  };
}

function edgeEvidenceStrings(edges: RepoGraphEdge[], kind: string, key: "from" | "to" | "file" | "fromModule" | "toModule"): string[] {
  return edges
    .filter((edge) => edge.edgeKind === kind)
    .map((edge) => {
      const evidence = edge.evidence as { from?: string; to?: string; file?: string; fromModule?: string; toModule?: string };
      return evidence[key];
    })
    .filter((value): value is string => Boolean(value));
}

function edgeSummary(edge: RepoGraphEdge): Record<string, unknown> {
  return {
    edgeKind: edge.edgeKind,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    weight: edge.weight,
    evidence: edge.evidence
  };
}

function graphStatusSummary(result: RepoGraphNodeResult): Record<string, unknown> {
  return {
    authority: result.status.graphAuthorityKind,
    graphRevision: result.status.graphRevision,
    nodeCount: result.status.nodeCount,
    edgeCount: result.status.edgeCount
  };
}

async function rebuildRepoIntelligence(repoRoot: string, targetRoot: string) {
  const config = await loadCanonicalConfig(repoRoot);
  const inspection = await inspectBootstrapTarget(targetRoot, config);
  const { state, view, index } = await buildRepoContextTree(targetRoot, inspection.projectType);
  await persistRepoContextTreeArtifacts(targetRoot, state, view);
  const built = await buildRepoIntelligenceArtifacts({
    targetRoot,
    tree: state,
    view,
    index
  });
  await persistRepoIntelligenceArtifacts(targetRoot, built);
  return loadRepoIntelligenceArtifacts(targetRoot);
}
