import { getCurrentExecutionStep, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { loadPreparedScope } from "@shrey-junior/sj-core/core/prepared-scope.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { createSpinner, printSection, success, warn } from "../utils/cli-output.js";

export interface GuideOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runGuide(options: GuideOptions): Promise<number> {
  const spinner = await createSpinner(`Loading guide state for ${options.targetRoot}`);
  const [plan, preparedScope] = await Promise.all([
    syncExecutionPlan(options.targetRoot),
    loadPreparedScope(options.targetRoot)
  ]);
  spinner.succeed(`Guide ready for ${options.targetRoot}`);
  const step = getCurrentExecutionStep(plan);
  const nextCommand =
    plan.confidence === "high" && step?.id === "execute" && plan.task
      ? `kiwi-control run --auto "${plan.task}"`
      : plan.nextCommands[0] ?? "kiwi-control next";

  const payload = {
    targetRoot: options.targetRoot,
    task: plan.task,
    intent: plan.intent,
    goal: plan.hierarchy.goal,
    subtasks: plan.hierarchy.subtasks,
    currentStep: step?.id ?? null,
    validationStatus: step?.validation ?? preparedScope?.task ?? null,
    impactPreview: plan.impactPreview,
    ...(plan.lastError
      ? {
          blockingIssue: {
            type: plan.lastError.errorType,
            strategy: plan.lastError.retryStrategy,
            reason: plan.lastError.reason
          }
        }
      : {}),
    nextCommand
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return 0;
  }

  printSection(options.logger, "GUIDE");
  options.logger.info(`target: ${options.targetRoot}`);
  options.logger.info(`goal: ${plan.hierarchy.goal ?? "none"}`);
  options.logger.info(`current step: ${step?.id ?? "none"}`);
  if (plan.lastError) {
    options.logger.info(`${warn("blocking issue")}: ${plan.lastError.errorType} (${plan.lastError.retryStrategy})`);
    options.logger.info(`reason: ${plan.lastError.reason}`);
  }
  if (plan.hierarchy.subtasks.length > 0) {
    options.logger.info(`subtasks: ${plan.hierarchy.subtasks.map((entry) => entry.title).join(" -> ")}`);
  }
  options.logger.info(`impact preview: ${plan.impactPreview.likelyFiles.slice(0, 8).join(", ") || "none"}`);
  options.logger.info(`${success("next command")}: ${nextCommand}`);
  return 0;
}
