import path from "node:path";
import { readJson, pathExists } from "@shrey-junior/sj-core/utils/fs.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { runtimeDecisionFromSnapshot } from "@shrey-junior/sj-core/core/runtime-decision.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { getRuntimeSnapshot } from "@shrey-junior/sj-core/runtime/client.js";
import type { ContextTraceState } from "@shrey-junior/sj-core/core/context-trace.js";
import { buildPlanRecoveryWorkflow, selectPrimaryPlanCommand } from "./execution-plan-recovery.js";

export interface ExplainOptions {
  repoRoot: string;
  targetRoot: string;
  json?: boolean;
  logger: Logger;
}

export async function runExplain(options: ExplainOptions): Promise<number> {
  const [plan, runtimeSnapshot] = await Promise.all([
    syncExecutionPlan(options.targetRoot, { persist: false }),
    getRuntimeSnapshot(options.targetRoot)
  ]);
  const runtimeDecision = runtimeDecisionFromSnapshot(runtimeSnapshot);
  const tracePath = path.join(options.targetRoot, ".agent", "state", "context-trace.json");
  const trace = await loadTrace(tracePath);
  const payload = {
    task: plan.task,
    selectedFiles: trace?.fileAnalysis.selected ?? [],
    excludedFiles: trace?.fileAnalysis.excluded ?? [],
    dependencyChains: plan.contextSnapshot.dependencyChains,
    forwardDependencies: plan.contextSnapshot.forwardDependencies,
    reverseDependencies: plan.contextSnapshot.reverseDependencies,
    reasoning: trace?.expansionSteps ?? [],
    nextCommand: runtimeDecision.recovery?.fixCommand ?? runtimeDecision.nextCommand ?? selectPrimaryPlanCommand(plan, "kiwi-control next"),
    ...(runtimeDecision.recovery || plan.lastError
      ? {
          fixCommand: runtimeDecision.recovery?.fixCommand ?? plan.lastError?.fixCommand,
          retryCommand: runtimeDecision.recovery?.retryCommand ?? plan.lastError?.retryCommand,
          blockedWorkflow: runtimeDecision.recovery ? [] : buildPlanRecoveryWorkflow(plan)
        }
      : {})
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    options.logger.info(`task: ${plan.task ?? "unknown"}`);
    for (const entry of payload.selectedFiles.slice(0, 20)) {
      options.logger.info(`selected: ${entry.file}`);
      options.logger.info(`why: ${entry.selectionWhy ?? entry.reasons.join(", ")}`);
      if (entry.dependencyChain?.length) {
        options.logger.info(`dependency chain: ${entry.dependencyChain.join(" -> ")}`);
      }
    }
    if (payload.reverseDependencies.length > 0) {
      options.logger.info(`reverse dependencies: ${payload.reverseDependencies.slice(0, 10).join(", ")}`);
    }
    if (payload.forwardDependencies.length > 0) {
      options.logger.info(`forward dependencies: ${payload.forwardDependencies.slice(0, 10).join(", ")}`);
    }
    if (runtimeDecision.recovery || plan.lastError) {
      options.logger.info(`blocking issue: ${runtimeDecision.recovery?.kind ?? plan.lastError?.errorType ?? "blocked"} (${plan.lastError?.retryStrategy ?? "runtime"})`);
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
    options.logger.info(`next command: ${payload.nextCommand ?? "kiwi-control next"}`);
  }

  return 0;
}

async function loadTrace(tracePath: string): Promise<ContextTraceState | null> {
  if (!(await pathExists(tracePath))) {
    return null;
  }
  try {
    return await readJson<ContextTraceState>(tracePath);
  } catch {
    return null;
  }
}
