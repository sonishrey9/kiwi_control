import path from "node:path";
import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "../core/dispatch.js";
import { buildDispatchManifest, writeDispatchManifest, type DispatchRole } from "../core/dispatch.js";
import { writeTaskPackets, summarizeWrites } from "../core/executor.js";
import { buildFanoutPackets } from "../core/planner.js";
import { evaluatePolicyPoint } from "../core/policies.js";
import { loadContinuitySnapshot } from "../core/state.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import { assessGoalRisk } from "../core/risk.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { buildTemplateContext, resolveRoutingDecision } from "../core/router.js";
import { resolveRoleSpecialists } from "../core/specialists.js";
import type { Logger } from "../core/logger.js";

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
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode);
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode
  });
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
