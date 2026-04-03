import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";
import { buildLaunchPlan } from "@shrey-junior/sj-core/core/launch.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { loadLatestReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";
import { loadContinuitySnapshot } from "@shrey-junior/sj-core/core/state.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface LaunchOptions {
  repoRoot: string;
  targetRoot: string;
  tool: "codex" | "claude" | "copilot";
  role?: string;
  specialistId?: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  logger: Logger;
}

export async function runLaunch(options: LaunchOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const continuity = await loadContinuitySnapshot(options.targetRoot, options.tool);
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode ?? continuity.latestPhase?.mode);
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: continuity.latestPhase?.routingSummary.taskType ?? config.global.defaults.default_task_type,
    fileArea: continuity.latestPhase?.routingSummary.fileArea ?? "application",
    changeSize: continuity.latestPhase?.routingSummary.changeSize ?? config.global.defaults.default_change_size,
    riskLevel: continuity.latestPhase?.routingSummary.riskLevel ?? "medium",
    ...(options.specialistId ? { specialistId: options.specialistId } : {})
  });
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const plan = buildLaunchPlan({
    targetRoot: options.targetRoot,
    config,
    selection,
    overlay,
    compiledContext,
    continuity,
    latestDispatch,
    latestCollection,
    latestReconcile,
    executionMode,
    tool: options.tool,
    ...(options.role ? { role: options.role } : {}),
    ...(options.specialistId ? { explicitSpecialistId: options.specialistId } : {})
  });

  options.logger.info(
    [
      `tool: ${plan.tool}`,
      `role: ${plan.role}`,
      `profile: ${plan.profileName}`,
      `mode: ${plan.mode}`,
      `specialist: ${plan.specialist.specialistId} (${plan.specialist.source})`,
      `policy gate: ${plan.policyPoint} -> ${plan.policy.result}`,
      ...(plan.latestPhaseLabel ? [`latest phase: ${plan.latestPhaseLabel}`] : []),
      ...(plan.latestHandoffSummary ? [`latest handoff: ${plan.latestHandoffSummary}`] : []),
      ...(plan.latestDispatchId ? [`latest dispatch: ${plan.latestDispatchId}`] : []),
      ...(plan.latestReconcileStatus ? [`latest reconcile: ${plan.latestReconcileStatus}`] : []),
      ...(plan.packetPath ? [`packet: ${plan.packetPath}`] : ["packet: none found"]),
      "read first:",
      ...(plan.readFirst.length > 0 ? plan.readFirst.map((item) => `- ${item}`) : ["- none recorded"]),
      "eligible MCP:",
      ...(plan.eligibleMcpReferences.length > 0 ? plan.eligibleMcpReferences.map((item) => `- ${item}`) : ["- none eligible"]),
      ...(plan.warnings.length > 0 ? ["warnings:", ...plan.warnings.map((item) => `- ${item}`)] : []),
      ...(plan.blockers.length > 0 ? ["blockers:", ...plan.blockers.map((item) => `- ${item}`)] : []),
      `recommended action: ${plan.recommendedAction}`
    ].join("\n")
  );
  return plan.policy.result === "blocked" ? 1 : 0;
}
