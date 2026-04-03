import path from "node:path";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";
import { buildDispatchManifest, writeDispatchManifest, type DispatchRole } from "@shrey-junior/sj-core/core/dispatch.js";
import { writeTaskPackets, summarizeWrites } from "@shrey-junior/sj-core/core/executor.js";
import { buildCanonicalReadNext, buildChecksToRun, buildSearchGuidance, buildStopConditions, buildWriteTargets, chooseNextFileToRead } from "@shrey-junior/sj-core/core/guidance.js";
import { buildFanoutPackets } from "@shrey-junior/sj-core/core/planner.js";
import { evaluatePolicyPoint } from "@shrey-junior/sj-core/core/policies.js";
import { PRODUCT_METADATA } from "@shrey-junior/sj-core/core/product.js";
import { loadContinuitySnapshot, updateActiveRoleHints } from "@shrey-junior/sj-core/core/state.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { assessGoalRisk } from "@shrey-junior/sj-core/core/risk.js";
import { loadLatestReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract } from "@shrey-junior/sj-core/core/router.js";
import { resolveRoleSpecialists } from "@shrey-junior/sj-core/core/specialists.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface DispatchOptions {
  repoRoot: string;
  targetRoot: string;
  goal: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  logger: Logger;
}

export async function runDispatch(options: DispatchOptions): Promise<number> {
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
  const risk = assessGoalRisk(options.goal);
  const decision = resolveRoutingDecision(config, {
    goal: options.goal,
    profile: selection,
    executionMode,
    riskLevel: risk.level
  });
  const roleTools = {
    planner: selection.profile.routing.task_types.planning ?? config.routing.defaults.planning_tool,
    implementer: selection.profile.routing.task_types.implementation ?? config.routing.defaults.fallback_tool,
    reviewer: selection.profile.routing.task_types.review ?? decision.reviewTool,
    tester:
      selection.profile.routing.task_types.testing ??
      (decision.reviewTool === "copilot" ? decision.primaryTool : decision.reviewTool)
  } satisfies Record<DispatchRole, "codex" | "claude" | "copilot">;
  const roleSpecialists = resolveRoleSpecialists({
    config,
    profileName: selection.profileName,
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    roleTools
  });
  const plannerSpecialist = roleSpecialists.planner;
  const implementerSpecialist = roleSpecialists.implementer;
  const reviewerSpecialist = roleSpecialists.reviewer;
  const testerSpecialist = roleSpecialists.tester;
  if (!plannerSpecialist || !implementerSpecialist || !reviewerSpecialist || !testerSpecialist) {
    throw new Error("dispatch could not resolve the full planner/implementer/reviewer/tester specialist set");
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
  const continuity = await loadContinuitySnapshot(options.targetRoot);
  const contextsByRole = Object.fromEntries(
    await Promise.all(
      (Object.entries(roleSpecialists) as Array<[DispatchRole, (typeof roleSpecialists)[DispatchRole]]>).map(async ([role, specialist]) => [
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
      ])
    )
  );
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const policy = evaluatePolicyPoint("pre-dispatch", {
    config,
    selection,
    overlay,
    compiledContext,
    ...(roleSpecialists.planner ? { specialist: roleSpecialists.planner } : {}),
    taskType: decision.taskType,
    fileArea: decision.fileArea,
    latestPhase: continuity.latestPhase,
    latestDispatch,
    latestCollection,
    latestReconcile
  });
  if (policy.result !== "allowed") {
    options.logger.warn(`pre-dispatch policy: ${policy.result}`);
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
    roleSpecialists,
    contextsByRole
  );
  const results = await writeTaskPackets(options.targetRoot, packets);
  const packetRelativePaths = mapPacketPaths(packets);
  const manifest = buildDispatchManifest({
    targetRoot: options.targetRoot,
    goal: options.goal,
    createdAt: context.generatedAt,
    profileName: selection.profileName,
    executionMode,
    decision,
    context: compiledContext,
    continuity,
    packetRelativePaths,
    roleTools,
    roleSpecialists: Object.fromEntries(
      (Object.entries(roleSpecialists) as Array<[DispatchRole, (typeof roleSpecialists)[DispatchRole]]>).map(([role, specialist]) => [
        role,
        {
          specialistId: specialist.specialistId,
          reasons: specialist.reasons
        }
      ])
    )
  });
  const dispatchArtifacts = await writeDispatchManifest(options.targetRoot, manifest);
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
      latestDispatchManifest: ".agent/state/dispatch/latest-manifest.json"
    }),
    nextSuggestedCommand: `${PRODUCT_METADATA.cli.primaryCommand} collect --target "${options.targetRoot}"`,
    writeTargets: buildWriteTargets(contract, [
      ...packets.map((packet) => packet.relativePath),
      ".agent/state/dispatch/latest-manifest.json"
    ]),
    checksToRun: buildChecksToRun(compiledContext.validationSteps),
    stopConditions: buildStopConditions({
      riskLevel: decision.riskLevel,
      taskType: decision.taskType
    }),
    nextAction: "Read .agent/state/dispatch/latest-manifest.json, then complete the planner packet before collecting role outputs.",
    searchGuidance: buildSearchGuidance({
      taskType: decision.taskType,
      fileArea: decision.fileArea
    })
  });

  options.logger.info(summarizeWrites(results, options.targetRoot));
  options.logger.info(`dispatch manifest: ${dispatchArtifacts.manifestPath}`);
  options.logger.info(`dispatch brief: ${dispatchArtifacts.markdownPath}`);
  return 0;
}

function mapPacketPaths(packets: Array<{ relativePath: string }>): Record<DispatchRole, string> {
  const result = {
    planner: "",
    implementer: "",
    reviewer: "",
    tester: ""
  } satisfies Record<DispatchRole, string>;
  for (const packet of packets) {
    const role = path.basename(packet.relativePath, ".md");
    if (role === "planner" || role === "implementer" || role === "reviewer" || role === "tester") {
      result[role] = packet.relativePath;
    }
  }
  return result;
}
