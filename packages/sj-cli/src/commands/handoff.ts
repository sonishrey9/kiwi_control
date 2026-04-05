import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "@shrey-junior/sj-core/core/guidance.js";
import { inspectGitState } from "@shrey-junior/sj-core/core/git.js";
import { buildHandoffBaseName, buildHandoffRecord, renderHandoffBrief, renderHandoffMarkdown } from "@shrey-junior/sj-core/core/handoff.js";
import { writeOpenRisksRecord } from "@shrey-junior/sj-core/core/memory.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "@shrey-junior/sj-core/core/prepared-scope.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { PRODUCT_METADATA } from "@shrey-junior/sj-core/core/product.js";
import { recommendMcpPack } from "@shrey-junior/sj-core/core/recommendations.js";
import { isKnownSpecialistId, normalizeSpecialistId, recommendNextSpecialist } from "@shrey-junior/sj-core/core/specialists.js";
import { loadActiveRoleHints, loadCurrentPhase, loadLatestCheckpoint, updateActiveRoleHints, writeHandoffArtifacts } from "@shrey-junior/sj-core/core/state.js";
import { buildTemplateContext, selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { recordPreparedScopeCompletion } from "@shrey-junior/sj-core/core/execution-log.js";
import { syncExecutionPlan } from "@shrey-junior/sj-core/core/execution-plan.js";
import { recordRuntimeProgress } from "@shrey-junior/sj-core/core/runtime-lifecycle.js";
import { executeWorkflowStep } from "@shrey-junior/sj-core/core/workflow-engine.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import type { ToolName } from "@shrey-junior/sj-core/core/config.js";
import { pathExists } from "@shrey-junior/sj-core/utils/fs.js";

export interface HandoffOptions {
  repoRoot: string;
  targetRoot: string;
  toRole: string;
  toTool?: ToolName;
  profileName?: string;
  logger: Logger;
}

export async function runHandoff(options: HandoffOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const currentPhase = await loadCurrentPhase(options.targetRoot);
  const executionMode = resolveExecutionMode(config, selection, overlay, currentPhase?.mode);
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: currentPhase?.routingSummary.taskType ?? config.global.defaults.default_task_type,
    fileArea: currentPhase?.routingSummary.fileArea ?? "application",
    changeSize: currentPhase?.routingSummary.changeSize ?? config.global.defaults.default_change_size,
    riskLevel: currentPhase?.routingSummary.riskLevel ?? "medium"
  });
  const gitState = await inspectGitState(options.targetRoot);
  const preparedScope = await loadPreparedScope(options.targetRoot);
  const scopeValidation = preparedScope
    ? validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, gitState.changedFiles)
    : null;
  const scopeFailure = scopeValidation && !scopeValidation.ok
    ? `Prepared scope violated by touched files: ${scopeValidation.outOfScopeFiles.slice(0, 5).join(", ")}`
    : null;
  const activeRoleHints = await loadActiveRoleHints(options.targetRoot);
  const latestCheckpoint = await loadLatestCheckpoint(options.targetRoot);
  const nextRecommendedSpecialist = recommendNextSpecialist({
    config,
    profileName: selection.profileName,
    projectType: overlay?.bootstrap?.project_type ?? "generic",
    taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType,
    fileArea: currentPhase?.routingSummary.fileArea ?? compiledContext.fileArea,
    ...(activeRoleHints?.nextRecommendedSpecialist || activeRoleHints?.activeRole
      ? { activeSpecialistId: activeRoleHints?.nextRecommendedSpecialist ?? activeRoleHints?.activeRole }
      : {})
  }).specialistId;
  const targetSpecialistId = normalizeSpecialistId(config, options.toRole, nextRecommendedSpecialist);
  if (!targetSpecialistId || !isKnownSpecialistId(config, targetSpecialistId)) {
    throw new Error(`unknown specialist: ${options.toRole}`);
  }

  const handoffTool =
    options.toTool ??
    currentPhase?.routingSummary.reviewTool ??
    currentPhase?.routingSummary.primaryTool ??
    config.routing.defaults.review_tool;
  const nextSuggestedMcpPack = recommendMcpPack({
    projectType: overlay?.bootstrap?.project_type ?? "generic",
    taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType,
    fileArea: currentPhase?.routingSummary.fileArea ?? compiledContext.fileArea,
    authorityFiles: compiledContext.authorityOrder
  });
  const baseHandoff = buildHandoffRecord({
    toTool: handoffTool,
    toRole: targetSpecialistId,
    currentPhase,
    context: compiledContext,
    gitState,
    activeRoleHints,
    latestCheckpoint,
    recommendedSpecialistId: nextRecommendedSpecialist,
    recommendedMcpPack: nextSuggestedMcpPack
  });
  const handoff = scopeFailure
    ? {
        ...baseHandoff,
        checksFailed: [...baseHandoff.checksFailed, scopeFailure],
        risks: [...baseHandoff.risks, scopeFailure],
        risksRemaining: [...baseHandoff.risksRemaining, scopeFailure],
        nextCommand: `${PRODUCT_METADATA.cli.primaryCommand} prepare "${preparedScope?.task ?? currentPhase?.goal ?? "describe your task"}"`,
        nextStep: "Refresh the prepared scope before handing this work to another specialist.",
        status: "blocked" as const
      }
    : baseHandoff;
  const baseName = buildHandoffBaseName(handoff);
  const contract = selectPortableContract(
    config,
    buildTemplateContext(options.targetRoot, config, {
      profileName: selection.profileName,
      executionMode,
      projectType: overlay?.bootstrap?.project_type ?? "generic",
      profileSource: selection.source
    })
  );
  const workflowExecution = await executeWorkflowStep(options.targetRoot, {
    task: currentPhase?.goal ?? null,
    stepId: "handoff-work",
    input: `--to ${targetSpecialistId} --tool ${handoffTool}`,
    expectedOutput: "Handoff artifacts are written for the next specialist/tool.",
    run: async () => {
      await recordPreparedScopeCompletion(options.targetRoot, {
        completionSource: "handoff",
        tool: PRODUCT_METADATA.cli.primaryCommand
      }).catch(() => null);
      const artifacts = await writeHandoffArtifacts(
        options.targetRoot,
        baseName,
        handoff,
        renderHandoffMarkdown(handoff),
        renderHandoffBrief(handoff)
      );
      await updateActiveRoleHints(options.targetRoot, {
        activeRole: contract.activeRole,
        supportingRoles: contract.supportingRoles,
        authoritySource: selection.source,
        projectType: overlay?.bootstrap?.project_type ?? "generic",
        readNext: buildCanonicalReadNext({
          targetRoot: options.targetRoot,
          authorityOrder: compiledContext.authorityOrder,
          promotedAuthorityDocs: compiledContext.promotedAuthorityDocs,
          contract
        }),
        nextFileToRead: chooseNextFileToRead({
          latestHandoff: ".agent/state/handoff/latest.json"
        }),
        nextSuggestedCommand: handoff.nextCommand,
        writeTargets: buildWriteTargets(contract, handoff.whatChanged.length > 0 ? handoff.whatChanged : [".agent/state/handoff/latest.json"]),
        checksToRun: buildChecksToRun(compiledContext.validationSteps),
        stopConditions: buildStopConditions({
          riskLevel: currentPhase?.routingSummary.riskLevel ?? compiledContext.riskLevel,
          taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType
        }),
        nextRecommendedSpecialist: targetSpecialistId,
        nextSuggestedMcpPack,
        nextAction: handoff.nextStep,
        searchGuidance: buildSearchGuidance({
          taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType,
          fileArea: currentPhase?.routingSummary.fileArea ?? compiledContext.fileArea
        })
      });
      await writeOpenRisksRecord(options.targetRoot, "handoff", handoff.risks);
      return {
        artifacts,
        handoff,
        targetSpecialistId
      };
    },
    validate: async (result) => {
      const artifactsWritten =
        await pathExists(result.artifacts.markdownPath) &&
        await pathExists(result.artifacts.jsonPath) &&
        await pathExists(result.artifacts.briefPath);
      const ok = result.handoff.status !== "blocked" && artifactsWritten;
      return {
        ok,
        validation: ok
          ? "Handoff artifacts were written and the next specialist/tool was recorded."
          : result.handoff.status === "blocked"
            ? "Handoff was blocked because the prepared scope no longer matches the touched files."
            : "Handoff artifacts were not fully written.",
        ...(ok
          ? {}
          : {
              failureReason: result.handoff.status === "blocked"
                ? (scopeFailure ?? `Handoff to ${result.targetSpecialistId} is blocked.`)
                : "Handoff artifacts were not fully written.",
              suggestedFix: result.handoff.status === "blocked"
                ? `Refresh the prepared scope with ${result.handoff.nextCommand} before retrying this handoff.`
                : `Retry kiwi-control handoff --to ${targetSpecialistId} --tool ${handoffTool} after fixing the artifact write failure.`
            })
      };
    },
    summarize: (result) => ({
      summary: result.handoff.status === "blocked"
        ? `Handoff to ${result.targetSpecialistId} blocked by scope drift.`
        : `Handoff to ${result.targetSpecialistId} recorded successfully.`,
      files: gitState.changedFiles.slice(0, 12)
    })
  });

  await recordRuntimeProgress(options.targetRoot, {
    type: workflowExecution.ok ? "handoff_recorded" : "validation_checkpoint",
    stage: workflowExecution.ok ? "handed-off" : "blocked",
    status: workflowExecution.ok ? "ok" : "error",
    summary: workflowExecution.ok
      ? `Handoff to ${targetSpecialistId} recorded successfully.`
      : workflowExecution.failureReason ?? `Handoff to ${targetSpecialistId} failed.`,
    task: currentPhase?.goal ?? null,
    command: workflowExecution.ok ? handoff.nextCommand : workflowExecution.retryCommand,
    files: gitState.changedFiles.slice(0, 12),
    validation: workflowExecution.validation,
    ...(workflowExecution.failureReason ? { failureReason: workflowExecution.failureReason } : {}),
    validationStatus: workflowExecution.ok ? "ok" : "error",
    nextSuggestedCommand: workflowExecution.ok ? handoff.nextCommand : workflowExecution.retryCommand,
    nextRecommendedAction: workflowExecution.ok ? handoff.nextStep : (workflowExecution.suggestedFix ?? workflowExecution.validation)
  }).catch(() => null);
  await syncExecutionPlan(options.targetRoot, {
    task: currentPhase?.goal ?? null,
    forceState: workflowExecution.ok ? "completed" : "blocked"
  }).catch(() => null);
  if (!workflowExecution.ok || !workflowExecution.result) {
    options.logger.error(workflowExecution.failureReason ?? `Handoff to ${targetSpecialistId} failed.`);
    return 1;
  }
  options.logger.info(`handoff markdown: ${workflowExecution.result.artifacts.markdownPath}`);
  options.logger.info(`handoff json: ${workflowExecution.result.artifacts.jsonPath}`);
  options.logger.info(`handoff brief: ${workflowExecution.result.artifacts.briefPath}`);
  return 0;
}
