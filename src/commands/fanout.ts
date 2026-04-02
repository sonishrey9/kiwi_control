import { loadCanonicalConfig } from "../core/config.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "../core/dispatch.js";
import { writeTaskPackets, summarizeWrites } from "../core/executor.js";
import { buildFanoutPackets } from "../core/planner.js";
import { compileRepoContext } from "../core/context.js";
import { evaluatePolicyPoint } from "../core/policies.js";
import { buildTemplateContext, resolveRoutingDecision } from "../core/router.js";
import { assessGoalRisk } from "../core/risk.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import { loadContinuitySnapshot } from "../core/state.js";
import { resolveRoleSpecialists } from "../core/specialists.js";
import type { Logger } from "../core/logger.js";

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
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode);
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: selection.profileName,
    executionMode
  });
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
  options.logger.info(summarizeWrites(results, options.targetRoot));
  return 0;
}
