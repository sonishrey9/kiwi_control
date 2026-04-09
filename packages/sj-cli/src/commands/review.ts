import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import {
  buildRepoIntelligenceArtifacts,
  persistRepoIntelligenceArtifacts
} from "@shrey-junior/sj-core/core/repo-intelligence.js";
import { buildReviewPack, persistReviewPack, resolveReviewChangedFiles } from "@shrey-junior/sj-core/core/review-pack.js";
import { persistReadyRepoSubstrate } from "@shrey-junior/sj-core/core/ready-substrate.js";
import { getRuntimeSnapshot, transitionRuntimeExecutionState } from "@shrey-junior/sj-core/runtime/client.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface ReviewOptions {
  repoRoot: string;
  targetRoot: string;
  baseRef?: string;
  json?: boolean;
  logger: Logger;
}

export async function runReview(options: ReviewOptions): Promise<number> {
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

  const changed = await resolveReviewChangedFiles(options.targetRoot, options.baseRef);
  const reviewPack = buildReviewPack({
    targetRoot: options.targetRoot,
    artifacts: {
      ...artifacts,
      compactContextPack: null,
      reviewContextPack: null,
      agentPack: null,
      taskPack: null
    },
    changedFiles: changed.changedFiles,
    source: changed.source,
    ...(options.baseRef ? { baseRef: options.baseRef } : {})
  });
  await persistReviewPack(options.targetRoot, reviewPack);
  await recordReviewPackRuntimeEvent(options);
  await persistReadyRepoSubstrate(options.targetRoot).catch(() => null);

  if (options.json) {
    options.logger.info(JSON.stringify(reviewPack, null, 2));
    return 0;
  }

  options.logger.info(`review pack ready: ${reviewPack.generatedAt}`);
  options.logger.info(`changed files: ${reviewPack.changedFiles.join(", ") || "none"}`);
  options.logger.info(`top review target: ${reviewPack.reviewOrder[0]?.target ?? "none"}`);
  return 0;
}

async function recordReviewPackRuntimeEvent(options: ReviewOptions): Promise<void> {
  const snapshot = await getRuntimeSnapshot(options.targetRoot);
  const triggerCommand = options.baseRef
    ? `kiwi-control review --base ${shellQuoteForStatus(options.baseRef)}`
    : "kiwi-control review";

  await transitionRuntimeExecutionState({
    targetRoot: options.targetRoot,
    actor: resolveCommandActor(),
    triggerCommand,
    eventType: "review-pack-generated",
    lifecycle: snapshot.lifecycle,
    task: snapshot.task,
    sourceCommand: snapshot.sourceCommand,
    reason: snapshot.reason,
    nextCommand: snapshot.nextCommand,
    blockedBy: snapshot.blockedBy,
    artifacts: {
      ...snapshot.artifacts,
      reviewPack: [".agent/context/review-pack.json"]
    },
    operationId: snapshot.operationId,
    reuseOperation: snapshot.operationId !== null,
    decision: snapshot.decision ?? null,
    materializeOutputs: ["execution-state", "execution-events"]
  });
}

function resolveCommandActor(): string {
  return (
    process.env.KIWI_CONTROL_COMMAND_SOURCE
    ?? process.env.SHREY_JUNIOR_COMMAND_SOURCE
    ?? "cli"
  );
}

function shellQuoteForStatus(value: string): string {
  return /[\s"']/g.test(value)
    ? JSON.stringify(value)
    : value;
}
