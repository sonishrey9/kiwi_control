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
