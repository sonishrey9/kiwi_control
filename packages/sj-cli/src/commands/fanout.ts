import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";
import { writeTaskPackets, summarizeWrites } from "@shrey-junior/sj-core/core/executor.js";
import { buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "@shrey-junior/sj-core/core/guidance.js";
import { buildFanoutPackets } from "@shrey-junior/sj-core/core/planner.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { evaluatePolicyPoint } from "@shrey-junior/sj-core/core/policies.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { assessGoalRisk } from "@shrey-junior/sj-core/core/risk.js";
import { loadLatestReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { PRODUCT_METADATA } from "@shrey-junior/sj-core/core/product.js";
import { loadContinuitySnapshot, updateActiveRoleHints } from "@shrey-junior/sj-core/core/state.js";
import { resolveRoleSpecialists } from "@shrey-junior/sj-core/core/specialists.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface FanoutOptions {
  repoRoot: string;
  targetRoot: string;
  goal: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  logger: Logger;
}

export async function runFanout(options: FanoutOptions): Promise<number> {
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
  const decision = resolveRoutingDecision(config, {
    goal: options.goal,
    profile: selection,
    executionMode,
    riskLevel: risk.level
  });
  const roleTools = {
    planner: selection.profile.routing.task_types.planning ?? config.routing.defaults.planning_tool,
    implementer: selection.profile.routing.task_types.implementation ?? decision.primaryTool,
    reviewer: selection.profile.routing.task_types.review ?? decision.reviewTool,
    tester:
      selection.profile.routing.task_types.testing ??
      (decision.reviewTool === "copilot" ? decision.primaryTool : decision.reviewTool)
  } as const;
  const specialistsByRole = resolveRoleSpecialists({
    config,
    profileName: selection.profileName,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    roleTools
  });
  const plannerSpecialist = specialistsByRole.planner;
  const implementerSpecialist = specialistsByRole.implementer;
  const reviewerSpecialist = specialistsByRole.reviewer;
  const testerSpecialist = specialistsByRole.tester;
  if (!plannerSpecialist || !implementerSpecialist || !reviewerSpecialist || !testerSpecialist) {
    throw new Error("fanout could not resolve the full planner/implementer/reviewer/tester specialist set");
  }
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
    riskLevel: decision.riskLevel
  });
  const contextsByRole = Object.fromEntries(
    await Promise.all(
      (Object.entries(specialistsByRole) as Array<[keyof typeof specialistsByRole, (typeof specialistsByRole)[keyof typeof specialistsByRole]]>).map(
        async ([role, specialist]) => [
          role,
          await compileRepoContext({
            targetRoot: options.targetRoot,
            config,
            profileName: selection.profileName,
            profile: selection.profile,
            overlay,
            executionMode,
            taskType: role === "planner" ? "planning" : role === "reviewer" ? "review" : role === "tester" ? "testing" : decision.taskType,
            fileArea: decision.fileArea,
            changeSize: decision.changeSize,
            riskLevel: decision.riskLevel,
            specialistId: specialist.specialistId
          })
        ]
      )
    )
  );
  const continuity = await loadContinuitySnapshot(options.targetRoot);
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const policy = evaluatePolicyPoint("pre-fanout", {
    config,
    selection,
    overlay,
    compiledContext,
    ...(specialistsByRole.planner ? { specialist: specialistsByRole.planner } : {}),
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    latestPhase: continuity.latestPhase,
    latestDispatch,
    latestCollection,
    latestReconcile
  });
  if (policy.result !== "allowed") {
    options.logger.warn(`pre-fanout policy: ${policy.result}`);
    for (const finding of policy.findings) {
      options.logger.warn(`- ${finding.message}`);
    }
  }
  const packets = await buildFanoutPackets(
    options.repoRoot,
    config,
    context,
    options.goal,
    decision,
    compiledContext,
    continuity,
    specialistsByRole,
    contextsByRole
  );
  const results = await writeTaskPackets(options.targetRoot, packets);
  await updateActiveRoleHints(options.targetRoot, {
    activeRole: plannerSpecialist.specialistId,
    supportingRoles: [
      implementerSpecialist.specialistId,
      reviewerSpecialist.specialistId,
      testerSpecialist.specialistId,
      ...contract.supportingRoles
    ].filter((role, index, items) => Boolean(role) && items.indexOf(role) === index && role !== plannerSpecialist.specialistId),
    authoritySource: selection.source,
    projectType: context.projectType,
    readNext: buildCanonicalReadNext({
      targetRoot: options.targetRoot,
      authorityOrder: compiledContext.authorityOrder,
      promotedAuthorityDocs: compiledContext.promotedAuthorityDocs,
      contract
    }),
    nextFileToRead: chooseNextFileToRead({
      latestTaskPacket: packets.find((packet) => packet.relativePath.endsWith("/planner.md"))?.relativePath ?? packets[0]?.relativePath ?? null
    }),
    nextSuggestedCommand: `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "<milestone>" --target "${options.targetRoot}"`,
    writeTargets: buildWriteTargets(contract, packets.map((packet) => packet.relativePath)),
    checksToRun: buildChecksToRun(compiledContext.validationSteps),
    stopConditions: buildStopConditions({
      riskLevel: decision.riskLevel,
      taskType: decision.taskType
    }),
    nextAction: "Read the planner packet first, then work through the implementer, reviewer, and tester packets in that order.",
    searchGuidance: buildSearchGuidance({
      taskType: decision.taskType,
      fileArea: decision.fileArea
    })
  });
  options.logger.info(summarizeWrites(results, options.targetRoot));
  return 0;
}
