import { inspectGitState } from "@shrey-junior/sj-core/core/git.js";
import { evaluateFinalValidation, syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { recordEvalEntry } from "@shrey-junior/sj-core/core/eval.js";
import { executeWorkflowStep } from "@shrey-junior/sj-core/core/workflow-engine.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { loadPreparedScope } from "@shrey-junior/sj-core/core/prepared-scope.js";
import { pathExists, readJson } from "@shrey-junior/sj-core/utils/fs.js";
import type { ContextSelectionState } from "@shrey-junior/sj-core/core/context-selector.js";

export interface ValidateOptions {
  repoRoot: string;
  targetRoot: string;
  task?: string;
  json?: boolean;
  logger: Logger;
}

export async function runValidate(options: ValidateOptions): Promise<number> {
  const plan = await syncExecutionPlan(options.targetRoot, {
    ...(options.task ? { task: options.task } : {})
  });
  const task = options.task ?? plan.task ?? "describe your task";
  const [gitState, preparedScope, selection] = await Promise.all([
    inspectGitState(options.targetRoot),
    loadPreparedScope(options.targetRoot),
    loadContextSelection(options.targetRoot)
  ]);

  const execution = await executeWorkflowStep(options.targetRoot, {
    task,
    stepId: "validate-outcome",
    input: task,
    expectedOutput: "The prepared scope, touched files, and task outcome have been validated.",
    run: async () => evaluateFinalValidation(options.targetRoot, task),
    validate: async (result) => ({
      ok: result.ok,
      validation: result.validation,
      ...(result.reason ? { failureReason: result.reason } : {}),
      ...(result.fixCommand ? { suggestedFix: `Run ${result.fixCommand}, then rerun ${result.retryCommand ?? `kiwi-control validate "${task}"`}.` } : {})
    }),
    summarize: (result) => ({
      summary: result.summary,
      files: gitState.changedFiles.slice(0, 12)
    })
  });

  await syncExecutionPlan(options.targetRoot, {
    task,
    ...(execution.ok ? {} : { forceState: execution.failureReason ? "blocked" : "failed" })
  }).catch(() => null);

  await recordRuntimeProgress(options.targetRoot, {
    type: "validation_completed",
    stage: execution.ok ? "validating" : "blocked",
    status: execution.ok ? "ok" : "error",
    summary: execution.ok ? `Validation passed for "${task}".` : (execution.failureReason ?? `Validation failed for "${task}".`),
    task,
    command: execution.ok ? 'kiwi-control checkpoint "validated-progress"' : execution.retryCommand,
    files: gitState.changedFiles.slice(0, 12),
    validation: execution.validation,
    ...(execution.failureReason ? { failureReason: execution.failureReason } : {}),
    validationStatus: execution.ok ? "ok" : "error",
    nextSuggestedCommand: execution.ok ? 'kiwi-control checkpoint "validated-progress"' : execution.retryCommand,
    nextRecommendedAction: execution.ok
      ? "Record a checkpoint now that final validation passed."
      : (execution.suggestedFix ?? execution.validation)
  }).catch(() => null);

  if (preparedScope && selection) {
    const tokenCount = selection.include.length;
    await recordEvalEntry(options.targetRoot, {
      task,
      selectedFiles: selection.include,
      modifiedFiles: gitState.changedFiles,
      success: execution.ok,
      tokenSource: "estimated",
      tokenCount,
      notes: [
        execution.validation,
        ...(execution.failureReason ? [execution.failureReason] : [])
      ]
    }).catch(() => null);
  }

  const payload = {
    ok: execution.ok,
    task,
    validation: execution.validation,
    ...(execution.failureReason ? { failureReason: execution.failureReason } : {}),
    nextCommand: execution.ok ? 'kiwi-control checkpoint "validated-progress"' : execution.retryCommand
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else if (execution.ok) {
    options.logger.info(`validation passed: ${task}`);
    options.logger.info(`next command: kiwi-control checkpoint "validated-progress"`);
  } else {
    options.logger.error(execution.failureReason ?? `Validation failed for "${task}".`);
    if (execution.retryCommand) {
      options.logger.info(`retry command: ${execution.retryCommand}`);
    }
  }

  return execution.ok ? 0 : 1;
}

async function loadContextSelection(targetRoot: string): Promise<ContextSelectionState | null> {
  const selectionPath = `${targetRoot}/.agent/state/context-selection.json`;
  if (!(await pathExists(selectionPath))) {
    return null;
  }
  try {
    return await readJson<ContextSelectionState>(selectionPath);
  } catch {
    return null;
  }
}
