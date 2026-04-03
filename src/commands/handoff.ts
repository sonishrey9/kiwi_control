import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "../core/guidance.js";
import { inspectGitState } from "../core/git.js";
import { buildHandoffBaseName, buildHandoffRecord, renderHandoffBrief, renderHandoffMarkdown } from "../core/handoff.js";
import { writeOpenRisksRecord } from "../core/memory.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import { recommendMcpPack, recommendNextSpecialist } from "../core/recommendations.js";
import { loadActiveRoleHints, loadCurrentPhase, loadLatestCheckpoint, updateActiveRoleHints, writeHandoffArtifacts } from "../core/state.js";
import { buildTemplateContext, selectPortableContract } from "../core/router.js";
import type { Logger } from "../core/logger.js";
import type { ToolName } from "../core/config.js";

export interface HandoffOptions {
  repoRoot: string;
  targetRoot: string;
  toTool: ToolName;
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
  const activeRoleHints = await loadActiveRoleHints(options.targetRoot);
  const latestCheckpoint = await loadLatestCheckpoint(options.targetRoot);
  const handoff = buildHandoffRecord({
    toTool: options.toTool,
    currentPhase,
    context: compiledContext,
    gitState,
    activeRoleHints,
    latestCheckpoint
  });
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
  const nextRecommendedSpecialist = recommendNextSpecialist({
    projectType: overlay?.bootstrap?.project_type ?? "generic",
    taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType,
    fileArea: currentPhase?.routingSummary.fileArea ?? compiledContext.fileArea
  });
  const nextSuggestedMcpPack = recommendMcpPack({
    projectType: overlay?.bootstrap?.project_type ?? "generic",
    taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType,
    fileArea: currentPhase?.routingSummary.fileArea ?? compiledContext.fileArea,
    authorityFiles: compiledContext.authorityOrder
  });
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
    nextSuggestedCommand: `shrey-junior status --target "${options.targetRoot}"`,
    writeTargets: buildWriteTargets(contract, handoff.whatChanged.length > 0 ? handoff.whatChanged : [".agent/state/handoff/latest.json"]),
    checksToRun: buildChecksToRun(compiledContext.validationSteps),
    stopConditions: buildStopConditions({
      riskLevel: currentPhase?.routingSummary.riskLevel ?? compiledContext.riskLevel,
      taskType: currentPhase?.routingSummary.taskType ?? compiledContext.taskType
    }),
    nextRecommendedSpecialist,
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
