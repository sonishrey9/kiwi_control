import path from "node:path";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import {
  buildCompactContextPack,
  buildRepoIntelligenceArtifacts,
  persistRepoIntelligenceArtifacts
} from "@shrey-junior/sj-core/core/repo-intelligence.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { normalizeRepoPath, relativeFrom } from "@shrey-junior/sj-core/utils/fs.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface RepoMapOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  focus?: string;
  changed?: boolean;
  limit?: number;
  logger: Logger;
}

export async function runRepoMap(options: RepoMapOptions): Promise<number> {
  if (options.changed && options.focus) {
    throw new Error("repo-map accepts either --changed or --focus, not both.");
  }

  const config = await loadCanonicalConfig(options.repoRoot);
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
  const { state, view, index } = await buildRepoContextTree(options.targetRoot, inspection.projectType);
  await persistRepoContextTreeArtifacts(options.targetRoot, state, view);
  const artifacts = await buildRepoIntelligenceArtifacts({
    tree: state,
    view,
    index
  });
  await persistRepoIntelligenceArtifacts(options.targetRoot, artifacts);

  const focusFiles = normalizeFocusFiles(options.targetRoot, options.focus);
  const compactContextPack = buildCompactContextPack({
    index,
    repoMap: artifacts.repoMap,
    ...(options.changed ? { focusFiles: index.lastImpact.changedFiles, mode: "changed" as const } : focusFiles.length > 0 ? { focusFiles, mode: "focus" as const } : { mode: "overview" as const }),
    ...(typeof options.limit === "number" ? { limit: options.limit } : {})
  });

  const payload = {
    artifactPaths: {
      repoMap: ".agent/context/repo-map.json",
      symbolIndex: ".agent/state/symbol-index.json",
      dependencyGraph: ".agent/state/dependency-graph.json",
      impactMap: ".agent/state/impact-map.json",
      contextTree: ".agent/context/context-tree.json"
    },
    repoMap: artifacts.repoMap,
    symbolIndex: artifacts.symbolIndex,
    dependencyGraph: artifacts.dependencyGraph,
    impactMap: artifacts.impactMap,
    compactContextPack
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  options.logger.info(`repo map ready: ${relativeFrom(options.targetRoot, path.join(options.targetRoot, ".agent", "context", "repo-map.json"))}`);
  options.logger.info(`summary: ${artifacts.repoMap.summary}`);
  options.logger.info(`entry points: ${artifacts.repoMap.entryPoints.slice(0, 8).join(", ") || "none"}`);
  options.logger.info(`changed files: ${artifacts.impactMap.changedFiles.slice(0, 8).join(", ") || "none"}`);
  options.logger.info(`impacted files: ${artifacts.impactMap.impactedFiles.slice(0, 8).join(", ") || "none"}`);
  options.logger.info(`compact pack: ${compactContextPack.summary}`);
  if (compactContextPack.files.length > 0) {
    options.logger.info(`focus files: ${compactContextPack.files.map((entry) => entry.file).join(", ")}`);
  }
  if (compactContextPack.missingFocusFiles.length > 0) {
    options.logger.warn(`missing focus files: ${compactContextPack.missingFocusFiles.join(", ")}`);
  }
  return 0;
}

function normalizeFocusFiles(targetRoot: string, focus: string | undefined): string[] {
  if (!focus) {
    return [];
  }

  return focus
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (path.isAbsolute(value)) {
        return normalizeRepoPath(relativeFrom(targetRoot, value));
      }
      return normalizeRepoPath(value);
    });
}
