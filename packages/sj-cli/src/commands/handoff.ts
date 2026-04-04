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
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import type { ToolName } from "@shrey-junior/sj-core/core/config.js";

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
  await recordPreparedScopeCompletion(options.targetRoot, {
    completionSource: "handoff",
    tool: PRODUCT_METADATA.cli.primaryCommand
  }).catch(() => null);
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
  const artifacts = await writeHandoffArtifacts(
    options.targetRoot,
    baseName,
    handoff,
    renderHandoffMarkdown(handoff),
    renderHandoffBrief(handoff)
  );
  const contract = selectPortableContract(
    config,
    buildTemplateContext(options.targetRoot, config, {
      profileName: selection.profileName,
      executionMode,
      projectType: overlay?.bootstrap?.project_type ?? "generic",
      profileSource: selection.source
    })
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
  options.logger.info(`handoff markdown: ${artifacts.markdownPath}`);
  options.logger.info(`handoff json: ${artifacts.jsonPath}`);
  options.logger.info(`handoff brief: ${artifacts.briefPath}`);
  return handoff.status === "blocked" ? 1 : 0;
}
