import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import { buildCompactContextPack, buildRepoIntelligenceArtifacts, buildReviewContextPack, persistCompactContextPack, persistRepoIntelligenceArtifacts, persistReviewContextPack } from "@shrey-junior/sj-core/core/repo-intelligence.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface PlanOptions {
  repoRoot: string;
  targetRoot: string;
  task: string;
  expand?: boolean;
  json?: boolean;
  logger: Logger;
}

export async function runPlan(options: PlanOptions): Promise<number> {
  await contextSelector(options.task, options.targetRoot, {
    ...(options.expand !== undefined ? { expand: options.expand } : {})
  });
  const config = await loadCanonicalConfig(options.repoRoot);
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
  const { state, view, index } = await buildRepoContextTree(options.targetRoot, inspection.projectType);
  await persistRepoContextTreeArtifacts(options.targetRoot, state, view);
  const intelligenceArtifacts = await buildRepoIntelligenceArtifacts({
    targetRoot: options.targetRoot,
    tree: state,
    view,
    index
  });
  await persistRepoIntelligenceArtifacts(
    options.targetRoot,
    intelligenceArtifacts
  );
  await persistCompactContextPack(
    options.targetRoot,
    buildCompactContextPack({
      index,
      repoMap: intelligenceArtifacts.repoMap,
      impactMap: intelligenceArtifacts.impactMap,
      mode: index.lastImpact.changedFiles.length > 0 ? "changed" : "overview",
      task: options.task
    })
  );
  await persistReviewContextPack(
    options.targetRoot,
    buildReviewContextPack({
      targetRoot: options.targetRoot,
      decisionGraph: intelligenceArtifacts.decisionGraph,
      historyGraph: intelligenceArtifacts.historyGraph,
      reviewGraph: intelligenceArtifacts.reviewGraph,
      task: options.task
    })
  );
  const plan = await syncExecutionPlan(options.targetRoot, {
    task: options.task,
    forceState: "planning"
  });

  if (options.json) {
    options.logger.info(JSON.stringify(plan, null, 2));
  } else {
    options.logger.info(`plan created: ${options.task}${options.expand ? " [expanded]" : ""}`);
    options.logger.info(`state: ${plan.state}`);
    options.logger.info(`current step: ${plan.steps[plan.currentStepIndex]?.id ?? "none"}`);
    options.logger.info(`next command: ${plan.nextCommands[0] ?? "kiwi-control prepare \"describe your task\""}`);
  }

  return 0;
}
