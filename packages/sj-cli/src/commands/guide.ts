import { getCurrentExecutionStep, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { loadPreparedScope } from "@shrey-junior/sj-core/core/prepared-scope.js";
import { runtimeDecisionFromSnapshot } from "@shrey-junior/sj-core/core/runtime-decision.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { getRuntimeSnapshot } from "@shrey-junior/sj-core/runtime/client.js";
import { buildReadyRepoSubstrate } from "@shrey-junior/sj-core/core/ready-substrate.js";
import { createSpinner, printSection, success, warn } from "../utils/cli-output.js";
import { buildPlanRecoveryWorkflow, selectPrimaryPlanCommand } from "./execution-plan-recovery.js";

export interface GuideOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runGuide(options: GuideOptions): Promise<number> {
  const spinner = options.json ? null : await createSpinner(`Loading guide state for ${options.targetRoot}`);
  const [plan, preparedScope, runtimeSnapshot] = await Promise.all([
    syncExecutionPlan(options.targetRoot, { persist: false }),
    loadPreparedScope(options.targetRoot),
    getRuntimeSnapshot(options.targetRoot)
  ]);
  const readySubstrate = await buildReadyRepoSubstrate(options.targetRoot, runtimeSnapshot);
  spinner?.succeed(`Guide ready for ${options.targetRoot}`);
  const runtimeDecision = runtimeDecisionFromSnapshot(runtimeSnapshot);
  const step = getCurrentExecutionStep(plan);
  const nextCommand =
    !runtimeDecision.recovery && !plan.lastError && plan.confidence === "high" && step?.id === "execute" && plan.task
      ? `kiwi-control run --auto "${plan.task}"`
      : runtimeDecision.recovery?.fixCommand
        ?? runtimeDecision.nextCommand
        ?? selectPrimaryPlanCommand(plan, "kiwi-control next");

  const payload = {
    targetRoot: options.targetRoot,
    task: plan.task,
    intent: plan.intent,
    goal: plan.hierarchy.goal,
    subtasks: plan.hierarchy.subtasks,
    currentStep: runtimeDecision.currentStepId ?? step?.id ?? null,
    validationStatus: step?.validation ?? preparedScope?.task ?? null,
    impactPreview: plan.impactPreview,
    readySubstrate: {
      status: readySubstrate.status,
      ready: readySubstrate.ready,
      readFirst: readySubstrate.readFirst,
      toolEntry: readySubstrate.toolEntry,
      missingRequired: readySubstrate.missingRequired
    },
    ...(runtimeDecision.recovery || plan.lastError
      ? {
          blockingIssue: {
            type: runtimeDecision.recovery?.kind ?? plan.lastError?.errorType ?? "blocked",
            strategy: plan.lastError?.retryStrategy ?? "runtime",
            reason: runtimeDecision.recovery?.reason ?? plan.lastError?.reason ?? runtimeDecision.readinessDetail
          },
          fixCommand: runtimeDecision.recovery?.fixCommand ?? plan.lastError?.fixCommand,
          retryCommand: runtimeDecision.recovery?.retryCommand ?? plan.lastError?.retryCommand,
          blockedWorkflow: runtimeDecision.recovery ? [] : buildPlanRecoveryWorkflow(plan)
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
  options.logger.info(`current step: ${runtimeDecision.currentStepId ?? step?.id ?? "none"}`);
  if (runtimeDecision.recovery || plan.lastError) {
    options.logger.info(`${warn("blocking issue")}: ${runtimeDecision.recovery?.kind ?? plan.lastError?.errorType ?? "blocked"} (${plan.lastError?.retryStrategy ?? "runtime"})`);
    options.logger.info(`reason: ${runtimeDecision.recovery?.reason ?? plan.lastError?.reason ?? runtimeDecision.readinessDetail}`);
    if (runtimeDecision.recovery?.fixCommand ?? plan.lastError?.fixCommand) {
      options.logger.info(`fix command: ${runtimeDecision.recovery?.fixCommand ?? plan.lastError?.fixCommand}`);
    }
    if (runtimeDecision.recovery?.retryCommand ?? plan.lastError?.retryCommand) {
      options.logger.info(`retry command: ${runtimeDecision.recovery?.retryCommand ?? plan.lastError?.retryCommand}`);
    }
    if (!runtimeDecision.recovery) {
      for (const [index, entry] of buildPlanRecoveryWorkflow(plan).entries()) {
        options.logger.info(`${index + 1}. ${entry.title}: ${entry.command}`);
        options.logger.info(`   ${entry.detail}`);
      }
    }
  }
  if (plan.hierarchy.subtasks.length > 0) {
    options.logger.info(`subtasks: ${plan.hierarchy.subtasks.map((entry) => entry.title).join(" -> ")}`);
  }
  options.logger.info(`impact preview: ${plan.impactPreview.likelyFiles.slice(0, 8).join(", ") || "none"}`);
  options.logger.info(`ready substrate: ${readySubstrate.status} — ${readySubstrate.toolEntry.path}`);
  options.logger.info(`${success("next command")}: ${nextCommand}`);
  return 0;
}
