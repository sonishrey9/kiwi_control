import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "../core/dispatch.js";
import { evaluatePolicyPoint } from "../core/policies.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { buildPhaseCloseRecord, writePhaseCloseArtifacts } from "../core/release.js";
import { loadContinuitySnapshot } from "../core/state.js";
import { recommendNextSpecialist, resolveSpecialist } from "../core/specialists.js";
import type { Logger } from "../core/logger.js";

export interface PhaseCloseOptions {
  repoRoot: string;
  targetRoot: string;
  label: string;
  goal?: string;
  tool?: "codex" | "claude" | "copilot";
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  nextTool?: "codex" | "claude" | "copilot";
  nextSpecialistId?: string;
  logger: Logger;
}

export async function runPhaseClose(options: PhaseCloseOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const continuity = await loadContinuitySnapshot(options.targetRoot, options.nextTool);
  if (!continuity.latestPhase) {
    throw new Error("phase-close requires an existing checkpoint");
  }

  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode ?? continuity.latestPhase.mode);
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: continuity.latestPhase.routingSummary.taskType,
    fileArea: continuity.latestPhase.routingSummary.fileArea,
    changeSize: continuity.latestPhase.routingSummary.changeSize,
    riskLevel: continuity.latestPhase.routingSummary.riskLevel
  });
  const nextSpecialist =
    options.nextSpecialistId
      ? resolveSpecialist({
          config,
          profileName: selection.profileName,
          taskType: continuity.latestPhase.routingSummary.taskType,
          fileArea: continuity.latestPhase.routingSummary.fileArea,
          ...(options.nextTool ? { tool: options.nextTool } : {}),
          explicitSpecialistId: options.nextSpecialistId
        })
      : recommendNextSpecialist({
          config,
          profileName: selection.profileName,
          taskType: continuity.latestPhase.routingSummary.taskType,
          fileArea: continuity.latestPhase.routingSummary.fileArea,
          blocked: latestReconcile?.status === "blocked"
        });
  const policyEvaluations = [
    evaluatePolicyPoint("pre-handoff", {
      config,
      selection,
      overlay,
      compiledContext,
      specialist: nextSpecialist,
      latestPhase: continuity.latestPhase,
      latestDispatch,
      latestCollection,
      latestReconcile
    }),
    evaluatePolicyPoint("pre-release-check", {
      config,
      selection,
      overlay,
      compiledContext,
      specialist: nextSpecialist,
      latestPhase: continuity.latestPhase,
      latestDispatch,
      latestCollection,
      latestReconcile
    })
  ];
  const record = buildPhaseCloseRecord({
    label: options.label,
    goal: options.goal ?? continuity.latestPhase.goal,
    profileName: selection.profileName,
    executionMode,
    ...(options.tool ? { tool: options.tool } : continuity.latestPhase.tool ? { tool: continuity.latestPhase.tool } : {}),
    checkpointPath: `${options.targetRoot}/.agent/state/current-phase.json`,
    latestReconcile,
    policyEvaluations,
    nextSpecialist,
    ...(options.nextTool ? { nextTool: options.nextTool } : {})
  });
  const artifacts = await writePhaseCloseArtifacts(options.targetRoot, record);

  options.logger.info(
    [
      `status: ${record.status}`,
      `policy result: ${record.policyResult}`,
      ...(options.nextTool ? [`next tool: ${options.nextTool}`] : []),
      `next specialist: ${nextSpecialist.specialistId}`,
      continuity.latestHandoff || !options.nextTool
        ? `handoff: ${continuity.latestHandoff ? continuity.latestHandoff.toTool : "not requested"}`
        : `handoff: missing current handoff to ${options.nextTool}`,
      `phase-close json: ${artifacts.jsonPath}`,
      `phase-close markdown: ${artifacts.markdownPath}`
    ].join("\n")
  );
  return record.status === "blocked" ? 1 : 0;
}
