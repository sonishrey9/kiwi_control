import { loadExecutionPlan, persistExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { runExecutionPlanStep } from "./execution-step-runner.js";

export interface ResumeOptions {
  repoRoot: string;
  targetRoot: string;
  logger: Logger;
}

export async function runResume(options: ResumeOptions): Promise<number> {
  const plan = await loadExecutionPlan(options.targetRoot);
  const step = plan?.steps[plan.currentStepIndex] ?? null;
  if (!plan || !step) {
    options.logger.info("next command: kiwi-control next");
    return 0;
  }
  await persistExecutionPlan(options.targetRoot, {
    ...plan,
    state: step.status === "failed" ? "retrying" : plan.state,
    updatedAt: new Date().toISOString()
  });
  options.logger.info(`next command: ${step.command}`);
  return runExecutionPlanStep(step.id, options);
}
