import { loadCanonicalConfig } from "../core/config.js";
import { loadLatestDispatchManifest } from "../core/dispatch.js";
import { assessPushReadiness, inspectGitState } from "../core/git.js";
import { loadProjectOverlay, resolveProfileSelection } from "../core/profiles.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { loadCurrentPhase } from "../core/state.js";
import type { Logger } from "../core/logger.js";

export interface PushCheckOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  logger: Logger;
}

export async function runPushCheck(options: PushCheckOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  await resolveProfileSelection(options.targetRoot, config, options.profileName);
  await loadProjectOverlay(options.targetRoot);
  const latestPhase = await loadCurrentPhase(options.targetRoot);
  const gitState = await inspectGitState(options.targetRoot);
  const latestDispatch = await loadLatestDispatchManifest(options.targetRoot);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot, latestDispatch?.dispatchId);
  const assessment = assessPushReadiness(gitState, latestPhase);
  const reasons = [...assessment.reasons];
  let result = assessment.result;
  if (result !== "not-applicable" && latestReconcile?.status === "blocked") {
    result = "blocked";
    reasons.push("latest reconcile report is blocked");
  } else if (result !== "not-applicable" && latestReconcile?.status === "review-required" && result === "allowed") {
    result = "review-required";
    reasons.push("latest reconcile report still requires review");
  }

  const lines = [
    `result: ${result}`,
    ...reasons.map((reason) => `- ${reason}`),
    gitState.isGitRepo
      ? `git summary: branch=${gitState.branch ?? "detached"} staged=${gitState.stagedCount} unstaged=${gitState.unstagedCount} untracked=${gitState.untrackedCount}`
      : "git summary: target is not a git repository",
    latestDispatch ? `latest dispatch: ${latestDispatch.dispatchId} [${latestDispatch.status}]` : "latest dispatch: none recorded",
    latestReconcile ? `latest reconcile: ${latestReconcile.status}` : "latest reconcile: none recorded",
    `phase completed: ${assessment.pushPlan.phaseCompleted}`,
    "major changes:",
    ...(assessment.pushPlan.majorChanges.length > 0 ? assessment.pushPlan.majorChanges.map((filePath) => `- ${filePath}`) : ["- none recorded"]),
    "validations run:",
    ...(assessment.pushPlan.validationsRun.length > 0 ? assessment.pushPlan.validationsRun.map((item) => `- ${item}`) : ["- none recorded"]),
    "known risks:",
    ...(assessment.pushPlan.knownRisks.length > 0 ? assessment.pushPlan.knownRisks.map((item) => `- ${item}`) : ["- none recorded"]),
    `recommended note: ${assessment.pushPlan.recommendedNote}`
  ];

  options.logger.info(lines.join("\n"));
  return result === "blocked" ? 1 : 0;
}
