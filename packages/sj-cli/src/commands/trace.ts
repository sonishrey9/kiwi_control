import { loadWorkflowState } from "@shrey-junior/sj-core/core/workflow-engine.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface TraceOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runTrace(options: TraceOptions): Promise<number> {
  const [plan, workflow] = await Promise.all([
    syncExecutionPlan(options.targetRoot),
    loadWorkflowState(options.targetRoot)
  ]);
  const payload = {
    state: plan.state,
    currentStepIndex: plan.currentStepIndex,
    planSteps: plan.steps.map((step) => ({
      id: step.id,
      status: step.status,
      command: step.command,
      fixCommand: step.fixCommand,
      retryCommand: step.retryCommand
    })),
    steps: workflow.steps.map((step) => ({
      stepId: step.stepId,
      status: step.status,
      result: step.result,
      validation: step.validation,
      failureReason: step.failureReason,
      retryCommand: step.result.retryCommand
    })),
    nextCommand: plan.nextCommands[0] ?? null
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    options.logger.info(`state: ${plan.state}`);
    for (const step of payload.planSteps) {
      options.logger.info(`plan ${step.id}: ${step.status} -> ${step.command}`);
    }
    for (const step of payload.steps) {
      options.logger.info(`${step.stepId}: ${step.status}`);
      if (step.result.summary) {
        options.logger.info(`result: ${step.result.summary}`);
      }
      if (step.failureReason) {
        options.logger.info(`failure: ${step.failureReason}`);
      }
      if (step.retryCommand) {
        options.logger.info(`retry command: ${step.retryCommand}`);
      }
    }
    options.logger.info(`next command: ${payload.nextCommand ?? "kiwi-control next"}`);
  }

  return 0;
}
