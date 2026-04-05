import { getCurrentExecutionStep, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { runExecutionPlanStep } from "./execution-step-runner.js";

export interface RunAutoOptions {
  repoRoot: string;
  targetRoot: string;
  task?: string;
  logger: Logger;
}

export async function runAuto(options: RunAutoOptions): Promise<number> {
  let plan = await syncExecutionPlan(options.targetRoot, {
    ...(options.task ? { task: options.task } : {})
  });

  for (let index = 0; index < 12; index += 1) {
    if (plan.lastError) {
      options.logger.error(plan.lastError.reason);
      options.logger.info(`fix command: ${plan.lastError.fixCommand}`);
      options.logger.info(`retry command: ${plan.lastError.retryCommand}`);
      return 1;
    }

    if (plan.state === "completed") {
      options.logger.info("auto run completed");
      return 0;
    }

    const currentStep = getCurrentExecutionStep(plan);
    if (!currentStep) {
      options.logger.info("next command: kiwi-control next");
      return 0;
    }

    if (plan.intent?.confidenceAction === "expand" && currentStep.id === "prepare") {
      options.logger.info('auto strategy: low confidence -> expand context first');
    } else if (plan.intent?.confidenceAction === "guarded") {
      options.logger.info("auto strategy: medium confidence -> guarded execution");
    } else if (plan.intent?.confidenceAction === "auto") {
      options.logger.info("auto strategy: high confidence -> continue auto-run");
    }

    options.logger.info(`auto step: ${currentStep.id}`);
    options.logger.info(`command: ${currentStep.command}`);
    const code = await runExecutionPlanStep(currentStep.id, {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      logger: options.logger
    });
    if (code !== 0) {
      return code;
    }

    const nextPlan = await syncExecutionPlan(options.targetRoot, {
      ...(options.task ? { task: options.task } : {})
    });
    if (nextPlan.currentStepIndex === plan.currentStepIndex && nextPlan.state === plan.state) {
      options.logger.info(`next command: ${nextPlan.nextCommands[0] ?? "kiwi-control next"}`);
      return 0;
    }
    plan = nextPlan;
  }

  options.logger.error("run --auto stopped because the execution plan did not converge within 12 steps.");
  options.logger.info("fix command: kiwi-control trace");
  return 1;
}
