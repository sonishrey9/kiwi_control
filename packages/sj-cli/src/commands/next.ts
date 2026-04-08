import { getCurrentExecutionStep, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { runtimeDecisionFromSnapshot } from "@shrey-junior/sj-core/core/runtime-decision.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { getRuntimeSnapshot } from "@shrey-junior/sj-core/runtime/client.js";
import { selectPrimaryPlanCommand } from "./execution-plan-recovery.js";

export interface NextOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runNext(options: NextOptions): Promise<number> {
  const [plan, runtimeSnapshot] = await Promise.all([
    syncExecutionPlan(options.targetRoot, { persist: false }),
    getRuntimeSnapshot(options.targetRoot)
  ]);
  const runtimeDecision = runtimeDecisionFromSnapshot(runtimeSnapshot);
  const fallbackFixCommand =
    runtimeDecision.recovery?.fixCommand
    ?? plan.lastError?.fixCommand
    ?? (plan.state === "blocked" || plan.state === "failed"
      ? selectPrimaryPlanCommand(plan, "kiwi-control status")
      : null);
  const fallbackRetryCommand =
    runtimeDecision.recovery?.retryCommand
    ?? plan.lastError?.retryCommand
    ?? null;
  const step = getCurrentExecutionStep(plan);
  const payload = {
    state: runtimeSnapshot.lifecycle,
    currentStepIndex: plan.currentStepIndex,
    currentStep: runtimeDecision.currentStepId ?? step?.id ?? null,
    impactPreview: plan.impactPreview,
    nextCommand: fallbackFixCommand ?? runtimeDecision.nextCommand ?? selectPrimaryPlanCommand(plan, "kiwi-control status"),
    ...(fallbackFixCommand
      ? {
          fixCommand: fallbackFixCommand,
          ...(fallbackRetryCommand ? { retryCommand: fallbackRetryCommand } : {}),
          errorType: runtimeDecision.recovery?.kind ?? plan.lastError?.errorType ?? "blocked",
          retryStrategy: runtimeDecision.recovery ? "runtime" : plan.lastError?.retryStrategy ?? "compatibility"
        }
      : {})
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    options.logger.info(`state: ${runtimeSnapshot.lifecycle}`);
    options.logger.info(`current step: ${runtimeDecision.currentStepId ?? step?.id ?? "none"}`);
    options.logger.info(`impact preview: ${plan.impactPreview.likelyFiles.slice(0, 6).join(", ") || "none"}`);
    if (fallbackFixCommand) {
      options.logger.info(`retry strategy: ${runtimeDecision.recovery ? "runtime" : plan.lastError?.retryStrategy ?? "compatibility"}`);
      options.logger.info(`fix command: ${fallbackFixCommand}`);
      if (fallbackRetryCommand) {
        options.logger.info(`retry command: ${fallbackRetryCommand}`);
      }
      options.logger.info(`next command: ${payload.nextCommand}`);
    } else {
      options.logger.info(`next command: ${runtimeDecision.nextCommand ?? plan.nextCommands[0] ?? "kiwi-control status"}`);
    }
  }

  return 0;
}
