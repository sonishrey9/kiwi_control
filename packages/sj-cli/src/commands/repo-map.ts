import path from "node:path";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import {
  buildAgentPack,
  buildCompactContextPack,
  buildRepoIntelligenceArtifacts,
  buildReviewContextPack,
  buildTaskPack,
  persistAgentPack,
  persistCompactContextPack,
  persistRepoIntelligenceArtifacts,
  persistReviewContextPack,
  persistTaskPack
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
  task?: string;
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
    targetRoot: options.targetRoot,
    tree: state,
    view,
    index
  });
  await persistRepoIntelligenceArtifacts(options.targetRoot, artifacts);

  const focusFiles = normalizeFocusFiles(options.targetRoot, options.focus);
  const compactContextPack = buildCompactContextPack({
    index,
    repoMap: artifacts.repoMap,
    impactMap: artifacts.impactMap,
    ...(options.changed ? { focusTargets: index.lastImpact.changedFiles, mode: "changed" as const } : focusFiles.length > 0 ? { focusTargets: focusFiles, mode: "focus" as const } : { mode: "overview" as const }),
    ...(options.task ? { task: options.task } : {}),
    ...(typeof options.limit === "number" ? { limit: options.limit } : {})
  });
  await persistCompactContextPack(options.targetRoot, compactContextPack);
  const reviewContextPack = buildReviewContextPack({
    targetRoot: options.targetRoot,
    decisionGraph: artifacts.decisionGraph,
    historyGraph: artifacts.historyGraph,
    reviewGraph: artifacts.reviewGraph,
    ...(options.task ? { task: options.task } : {})
  });
  await persistReviewContextPack(options.targetRoot, reviewContextPack);
  const taskPack = buildTaskPack({
    compactContextPack,
    decisionGraph: artifacts.decisionGraph,
    reviewGraph: artifacts.reviewGraph,
    ...(options.task ? { task: options.task } : {})
  });
  await persistTaskPack(options.targetRoot, taskPack);
  const agentPack = buildAgentPack({
    repoMap: artifacts.repoMap,
    decisionGraph: artifacts.decisionGraph,
    historyGraph: artifacts.historyGraph,
    reviewGraph: artifacts.reviewGraph,
    compactContextPack,
    reviewContextPack
  });
  await persistAgentPack(options.targetRoot, agentPack);

  const payload = {
    artifactPaths: {
      agentPack: ".agent/context/agent-pack.json",
      taskPack: ".agent/context/task-pack.json",
      repoMap: ".agent/context/repo-map.json",
      symbolIndex: ".agent/state/symbol-index.json",
      dependencyGraph: ".agent/state/dependency-graph.json",
      impactMap: ".agent/state/impact-map.json",
      decisionGraph: ".agent/state/decision-graph.json",
      historyGraph: ".agent/state/history-graph.json",
      reviewGraph: ".agent/state/review-graph.json",
      compactContextPack: ".agent/context/compact-context-pack.json",
      reviewContextPack: ".agent/context/review-context-pack.json",
      contextTree: ".agent/context/context-tree.json"
    },
    repoMap: artifacts.repoMap,
    symbolIndex: artifacts.symbolIndex,
    dependencyGraph: artifacts.dependencyGraph,
    impactMap: artifacts.impactMap,
    decisionGraph: artifacts.decisionGraph,
    historyGraph: artifacts.historyGraph,
    reviewGraph: artifacts.reviewGraph,
    agentPack,
    taskPack,
    compactContextPack,
    reviewContextPack
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
  if (options.task) {
    options.logger.info(`task: ${options.task}`);
  }
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
