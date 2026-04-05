import { loadExecutionPlan, persistExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { runExecutionPlanStep } from "./execution-step-runner.js";

export interface RetryOptions {
  repoRoot: string;
  targetRoot: string;
  logger: Logger;
}

export async function runRetry(options: RetryOptions): Promise<number> {
  const plan = await loadExecutionPlan(options.targetRoot);
  const failedStep = plan?.steps.find((step) => step.status === "failed") ?? null;
  if (!plan || !failedStep) {
    options.logger.info("next command: kiwi-control next");
    return 0;
  }
  await persistExecutionPlan(options.targetRoot, {
    ...plan,
    state: "retrying",
    updatedAt: new Date().toISOString()
  });
  if (plan.lastError) {
    options.logger.info(`retry strategy: ${plan.lastError.retryStrategy}`);
    options.logger.info(`fix command: ${plan.lastError.fixCommand}`);
  }
  options.logger.info(`retry command: ${failedStep.retryCommand ?? failedStep.command}`);
  return runExecutionPlanStep(failedStep.id, options);
}
