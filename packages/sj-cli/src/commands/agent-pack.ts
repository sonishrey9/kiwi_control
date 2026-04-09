import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
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
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface AgentPackOptions {
  repoRoot: string;
  targetRoot: string;
  task?: string;
  review?: boolean;
  json?: boolean;
  logger: Logger;
}

export async function runAgentPack(options: AgentPackOptions): Promise<number> {
  if (options.review && options.task) {
    throw new Error("agent-pack accepts either --task or --review, not both.");
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

  const compactContextPack = buildCompactContextPack({
    index,
    repoMap: artifacts.repoMap,
    impactMap: artifacts.impactMap,
    mode: index.lastImpact.changedFiles.length > 0 ? "changed" : "overview",
    ...(options.task ? { task: options.task } : {})
  });
  await persistCompactContextPack(options.targetRoot, compactContextPack);

  const taskPack = buildTaskPack({
    compactContextPack,
    decisionGraph: artifacts.decisionGraph,
    reviewGraph: artifacts.reviewGraph,
    ...(options.task ? { task: options.task } : {})
  });
  await persistTaskPack(options.targetRoot, taskPack);

  const reviewContextPack = buildReviewContextPack({
    targetRoot: options.targetRoot,
    decisionGraph: artifacts.decisionGraph,
    historyGraph: artifacts.historyGraph,
    reviewGraph: artifacts.reviewGraph,
    ...(options.task ? { task: options.task } : {})
  });
  await persistReviewContextPack(options.targetRoot, reviewContextPack);

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
      reviewContextPack: ".agent/context/review-context-pack.json",
      compactContextPack: ".agent/context/compact-context-pack.json",
      repoMap: ".agent/context/repo-map.json"
    },
    ...(options.review
      ? { reviewContextPack }
      : options.task
        ? { taskPack }
        : { agentPack })
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  if (options.review) {
    options.logger.info(`review pack ready: ${reviewContextPack.summary}`);
    return 0;
  }
  if (options.task) {
    options.logger.info(`task pack ready: ${taskPack.summary}`);
    return 0;
  }

  options.logger.info(`agent pack ready: ${agentPack.summary}`);
  return 0;
}
