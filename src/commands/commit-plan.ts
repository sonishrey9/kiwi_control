import { inspectGitState } from "../core/git.js";
import { loadLatestReconcileReport } from "../core/reconcile.js";
import { buildCommitPlan } from "../core/release.js";
import { loadCurrentPhase } from "../core/state.js";
import type { Logger } from "../core/logger.js";
import { renderDisplayPath } from "../utils/fs.js";

export interface CommitPlanOptions {
  targetRoot: string;
  logger: Logger;
}

export async function runCommitPlan(options: CommitPlanOptions): Promise<number> {
  const latestPhase = await loadCurrentPhase(options.targetRoot);
  const latestReconcile = await loadLatestReconcileReport(options.targetRoot);
  const gitState = await inspectGitState(options.targetRoot);
  const plan = buildCommitPlan({
    targetRoot: options.targetRoot,
    gitState,
    latestPhase,
    latestReconcile
  });

  options.logger.info(
    [
      `phase: ${plan.phaseLabel}`,
      `git repo: ${gitState.isGitRepo}`,
      "groups:",
      ...(plan.groups.length > 0
        ? plan.groups.map(
            (group) =>
              `- ${group.title}: ${group.rationale} [${group.files.map((filePath) => renderDisplayPath(options.targetRoot, filePath)).join(", ")}]`
          )
        : ["- none recorded"]),
      "validations run:",
      ...(plan.validationsRun.length > 0 ? plan.validationsRun.map((item) => `- ${item}`) : ["- none recorded"]),
      "warnings:",
      ...(plan.warnings.length > 0 ? plan.warnings.map((item) => `- ${item}`) : ["- none recorded"]),
      "suggested commit notes:",
      ...(plan.suggestedCommitNotes.length > 0 ? plan.suggestedCommitNotes.map((item) => `- ${item}`) : ["- none recorded"])
    ].join("\n")
  );
  return 0;
}
