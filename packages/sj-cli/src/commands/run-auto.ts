import { getCurrentExecutionStep, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
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
  const task = options.task ?? plan.task ?? "describe your task";
  await recordExecutionState(options.targetRoot, {
    type: "run-auto-queued",
    lifecycle: "queued",
    task,
    sourceCommand: `kiwi-control run "${task}" --auto`,
    reason: "Auto run queued the current execution plan.",
    nextCommand: plan.nextCommands[0] ?? "kiwi-control next",
    blockedBy: [],
    reuseOperation: false
  }).catch(() => null);

  for (let index = 0; index < 12; index += 1) {
    if (plan.lastError) {
      await recordExecutionState(options.targetRoot, {
        type: "run-auto-blocked",
        lifecycle: plan.lastError.errorType === "environment_error" ? "failed" : "blocked",
        task,
        sourceCommand: `kiwi-control run "${task}" --auto`,
        reason: plan.lastError.reason,
        nextCommand: plan.lastError.fixCommand,
        blockedBy: [plan.lastError.reason],
        reuseOperation: true
      }).catch(() => null);
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
    await recordExecutionState(options.targetRoot, {
      type: "run-auto-step-started",
      lifecycle: "running",
      task,
      sourceCommand: currentStep.command,
      reason: `Auto run is executing ${currentStep.id}.`,
      nextCommand: currentStep.command,
      blockedBy: [],
      reuseOperation: true
    }).catch(() => null);
    const code = await runExecutionPlanStep(currentStep.id, {
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      logger: options.logger
    });
    if (code !== 0) {
      const failurePlan = await syncExecutionPlan(options.targetRoot, {
        ...(options.task ? { task: options.task } : {})
      });
      if (failurePlan.lastError) {
        await recordExecutionState(options.targetRoot, {
          type: "run-auto-blocked",
          lifecycle: failurePlan.lastError.errorType === "environment_error" ? "failed" : "blocked",
          task,
          sourceCommand: `kiwi-control run "${task}" --auto`,
          reason: failurePlan.lastError.reason,
          nextCommand: failurePlan.lastError.fixCommand,
          blockedBy: [failurePlan.lastError.reason],
          reuseOperation: true
        }).catch(() => null);
      }
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

  await recordExecutionState(options.targetRoot, {
    type: "run-auto-failed",
    lifecycle: "failed",
    task,
    sourceCommand: `kiwi-control run "${task}" --auto`,
    reason: "Run --auto stopped because the execution plan did not converge within 12 steps.",
    nextCommand: "kiwi-control trace",
    blockedBy: ["Run --auto did not converge within 12 steps."],
    reuseOperation: true
  }).catch(() => null);
  options.logger.error("run --auto stopped because the execution plan did not converge within 12 steps.");
  options.logger.info("fix command: kiwi-control trace");
  return 1;
}
