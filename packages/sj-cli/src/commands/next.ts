import { getCurrentExecutionStep, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface NextOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runNext(options: NextOptions): Promise<number> {
  const plan = await syncExecutionPlan(options.targetRoot);
  const step = getCurrentExecutionStep(plan);
  const payload = {
    state: plan.state,
    currentStepIndex: plan.currentStepIndex,
    currentStep: step?.id ?? null,
    impactPreview: plan.impactPreview,
    nextCommand: plan.nextCommands[0] ?? null,
    ...(plan.lastError ? { fixCommand: plan.lastError.fixCommand, retryCommand: plan.lastError.retryCommand, errorType: plan.lastError.errorType, retryStrategy: plan.lastError.retryStrategy } : {})
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    options.logger.info(`state: ${plan.state}`);
    options.logger.info(`current step: ${step?.id ?? "none"}`);
    options.logger.info(`impact preview: ${plan.impactPreview.likelyFiles.slice(0, 6).join(", ") || "none"}`);
    if (plan.lastError) {
      options.logger.info(`retry strategy: ${plan.lastError.retryStrategy}`);
      options.logger.info(`fix command: ${plan.lastError.fixCommand}`);
      options.logger.info(`retry command: ${plan.lastError.retryCommand}`);
    } else {
      options.logger.info(`next command: ${plan.nextCommands[0] ?? "kiwi-control status"}`);
    }
  }

  return 0;
}
