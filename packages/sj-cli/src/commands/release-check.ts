import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";
import { assessPushReadiness, inspectGitState } from "@shrey-junior/sj-core/core/git.js";
import { evaluatePolicyPoint } from "@shrey-junior/sj-core/core/policies.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "@shrey-junior/sj-core/core/profiles.js";
import { loadLatestReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";
import { buildReleaseCheckReport, writeReleaseCheckArtifacts } from "@shrey-junior/sj-core/core/release.js";
import { loadContinuitySnapshot } from "@shrey-junior/sj-core/core/state.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface ReleaseCheckOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  mode?: "assisted" | "guarded" | "inline";
  logger: Logger;
}

export async function runReleaseCheck(options: ReleaseCheckOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const continuity = await loadContinuitySnapshot(options.targetRoot);
  const executionMode = resolveExecutionMode(config, selection, overlay, options.mode ?? continuity.latestPhase?.mode);
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestCollection = await loadLatestDispatchCollection(options.targetRoot, latestDispatch?.dispatchId);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const gitState = await inspectGitState(options.targetRoot);
  const pushAssessment = assessPushReadiness(gitState, continuity.latestPhase);
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
    riskLevel: continuity.latestPhase?.routingSummary.riskLevel ?? "medium"
  });
  const policy = evaluatePolicyPoint("pre-release-check", {
    config,
    selection,
    overlay,
    compiledContext,
    latestPhase: continuity.latestPhase,
    latestDispatch,
    latestCollection,
    latestReconcile,
    gitState,
    pushAssessment
  });
  const report = buildReleaseCheckReport({
    profileName: selection.profileName,
    executionMode,
    latestPhase: continuity.latestPhase,
    latestDispatch,
    latestCollection,
    latestReconcile,
    pushAssessment,
    policyEvaluation: policy
  });
  const artifacts = await writeReleaseCheckArtifacts(options.targetRoot, report);

  options.logger.info(
    [
      `status: ${report.status}`,
      `phase: ${report.phaseLabel}`,
      `push suitability: ${report.pushSuitability}`,
      `policy result: ${report.policyResult}`,
      ...(report.reconcileStatus ? [`reconcile: ${report.reconcileStatus}`] : []),
      `active specialists: ${report.activeSpecialists.join(", ") || "none recorded"}`,
      `missing validations: ${report.missingValidations.join("; ") || "none recorded"}`,
      `unresolved risks: ${report.unresolvedRisks.join("; ") || "none recorded"}`,
      `release json: ${artifacts.jsonPath}`,
      `release markdown: ${artifacts.markdownPath}`
    ].join("\n")
  );
  return report.status === "blocked" ? 1 : 0;
}
