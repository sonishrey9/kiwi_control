import { loadExecutionPlan, syncExecutionPlan, type ExecutionPlanStepId } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { runPrepare } from "./prepare.js";
import { runRun } from "./run.js";
import { runValidate } from "./validate.js";
import { runCheckpoint } from "./checkpoint.js";
import { runHandoff } from "./handoff.js";

export interface ExecutionStepRunnerOptions {
  repoRoot: string;
  targetRoot: string;
  logger: Logger;
}

export async function runExecutionPlanStep(
  stepId: ExecutionPlanStepId,
  options: ExecutionStepRunnerOptions
): Promise<number> {
  const plan = await syncExecutionPlan(options.targetRoot);
  const task = plan.task ?? "describe your task";
  switch (stepId) {
    case "prepare":
      return runPrepare({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        task,
        logger: options.logger
      });
    case "execute":
      return runRun({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        goal: task,
        logger: options.logger
      });
    case "validate":
      return runValidate({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        task,
        logger: options.logger
      });
    case "checkpoint":
      return runCheckpoint({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        label: "validated-progress",
        goal: task,
        logger: options.logger
      });
    case "handoff":
      return runHandoff({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        toRole: plan.steps.find((step) => step.id === "handoff")?.command.split("--to ")[1]?.split(" ")[0] ?? "qa-specialist",
        logger: options.logger
      });
  }
}

export async function loadCurrentExecutableStep(targetRoot: string): Promise<ExecutionPlanStepId | null> {
  const plan = await loadExecutionPlan(targetRoot);
  if (!plan) {
    return null;
  }
  return plan.steps[plan.currentStepIndex]?.id ?? null;
}
