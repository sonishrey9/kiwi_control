import { loadExecutionPlan, recordPlanStepResult, syncExecutionPlan, type ExecutionPlanStepId } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { runPrepare } from "./prepare.js";
import { runRun } from "./run.js";
import { runValidate } from "./validate.js";
import { runCheckpoint } from "./checkpoint.js";
import { runHandoff } from "./handoff.js";
import { runExplain } from "./explain.js";
import { runTrace } from "./trace.js";

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
    case "expand-context": {
      const code = await runPrepare({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        task,
        expand: true,
        logger: options.logger
      });
      await recordPlanStepResult(options.targetRoot, {
        stepId,
        status: code === 0 ? "success" : "failed",
        summary: code === 0 ? "Expanded prepared context for a weak initial scope." : null,
        validation: "Expanded context should increase confidence or widen graph-connected file coverage.",
        ...(code === 0 ? {} : { failureReason: "Failed to expand context.", suggestedFix: `Run kiwi-control prepare "${task}" --expand manually.` })
      }).catch(() => null);
      return code;
    }
    case "analyze": {
      const code = await runExplain({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        logger: options.logger
      });
      await recordPlanStepResult(options.targetRoot, {
        stepId,
        status: code === 0 ? "success" : "failed",
        summary: code === 0 ? "Dependency reasoning and selected files were reviewed." : null,
        validation: "Explain output should show structural neighbors or dependency chains.",
        ...(code === 0 ? {} : { failureReason: "Failed to analyze dependencies.", suggestedFix: "Run kiwi-control explain manually." })
      }).catch(() => null);
      return code;
    }
    case "trace": {
      const code = await runTrace({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        logger: options.logger
      });
      await recordPlanStepResult(options.targetRoot, {
        stepId,
        status: code === 0 ? "success" : "failed",
        summary: code === 0 ? "Execution trace and workflow results were reviewed." : null,
        validation: "Trace output should reveal relevant failing steps or affected files.",
        ...(code === 0 ? {} : { failureReason: "Failed to gather trace output.", suggestedFix: "Run kiwi-control trace manually." })
      }).catch(() => null);
      return code;
    }
    case "locate": {
      const code = await runExplain({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        logger: options.logger
      });
      await recordPlanStepResult(options.targetRoot, {
        stepId,
        status: code === 0 ? "success" : "failed",
        summary: code === 0 ? "Likely issue surfaces were narrowed from selection reasoning." : null,
        validation: "Explain output should surface the likely issue files before modification.",
        ...(code === 0 ? {} : { failureReason: "Failed to locate likely issue surfaces.", suggestedFix: "Run kiwi-control explain manually." })
      }).catch(() => null);
      return code;
    }
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
