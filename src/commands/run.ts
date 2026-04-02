import { loadCanonicalConfig } from "../core/config.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "../core/dispatch.js";
import { writeTaskPackets, summarizeWrites } from "../core/executor.js";
import { buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets } from "../core/guidance.js";
import { buildRunPackets } from "../core/planner.js";
import { compileRepoContext } from "../core/context.js";
import { evaluatePolicyPoint } from "../core/policies.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract } from "../core/router.js";
import { assessGoalRisk } from "../core/risk.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { loadProjectOverlay, resolveExecutionMode, resolvePrimaryToolOverride, resolveProfileSelection } from "../core/profiles.js";
import { inspectBootstrapTarget } from "../core/project-detect.js";
import { loadContinuitySnapshot, updateActiveRoleHints } from "../core/state.js";
import { resolveSpecialist } from "../core/specialists.js";
import type { Logger } from "../core/logger.js";

export interface RunOptions {
  repoRoot: string;
  targetRoot: string;
  goal: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  tool?: "codex" | "claude" | "copilot";
  logger: Logger;
}

export async function runRun(options: RunOptions): Promise<number> {
  const risk = assessGoalRisk(options.goal);
  if (risk.level === "high") {
    options.logger.warn(`high-risk goal detected: ${risk.reasons.join(", ")}`);
  }

  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const inspection = await inspectBootstrapTarget(options.targetRoot, config);
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode);
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    profileSource: selection.source
  });
  const contract = selectPortableContract(config, context);
  const explicitTool = resolvePrimaryToolOverride(overlay, options.tool);
  const decision = resolveRoutingDecision(config, {
    goal: options.goal,
    profile: selection,
    executionMode,
    riskLevel: risk.level,
    ...(explicitTool ? { explicitTool } : {})
  });
  const specialist = resolveSpecialist({
    config,
    profileName: selection.profileName,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    tool: explicitTool ?? decision.primaryTool
  });
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    changeSize: decision.changeSize,
    riskLevel: decision.riskLevel,
    specialistId: specialist.specialistId
  });
  const continuity = await loadContinuitySnapshot(options.targetRoot, decision.primaryTool);
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const policy = evaluatePolicyPoint("pre-run", {
    config,
    selection,
    overlay,
    compiledContext,
    specialist,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    tool: decision.primaryTool,
    latestPhase: continuity.latestPhase,
    latestDispatch,
    latestCollection,
    latestReconcile
  });
  if (policy.result !== "allowed") {
    options.logger.warn(`pre-run policy: ${policy.result}`);
    for (const finding of policy.findings) {
      options.logger.warn(`- ${finding.message}`);
    }
  }
  const packets = await buildRunPackets(options.repoRoot, config, context, options.goal, decision, compiledContext, continuity, specialist);
  const results = await writeTaskPackets(options.targetRoot, packets);
  await updateActiveRoleHints(options.targetRoot, {
    activeRole: specialist?.specialistId ?? contract.activeRole,
    supportingRoles:
      specialist?.specialistId && specialist.specialistId !== contract.activeRole
        ? [...new Set([contract.activeRole, ...contract.supportingRoles].filter((role) => role !== specialist.specialistId))]
        : contract.supportingRoles,
    authoritySource: selection.source,
    projectType: context.projectType,
    readNext: buildCanonicalReadNext({
      targetRoot: options.targetRoot,
      authorityOrder: compiledContext.authorityOrder,
      promotedAuthorityDocs: compiledContext.promotedAuthorityDocs,
      contract
    }),
    writeTargets: buildWriteTargets(contract, packets.map((packet) => packet.relativePath)),
    checksToRun: buildChecksToRun(compiledContext.validationSteps),
    stopConditions: buildStopConditions({
      riskLevel: decision.riskLevel,
      taskType: decision.taskType
    }),
    nextAction: `Open .agent/state/latest-task-packets.json and execute the ${decision.primaryTool} run packet before expanding scope.`,
    searchGuidance: buildSearchGuidance({
      taskType: decision.taskType,
      fileArea: decision.fileArea
    })
  });
  options.logger.info(summarizeWrites(results, options.targetRoot));
  return 0;
}
