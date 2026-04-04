import path from "node:path";
import { inspectGitState } from "./git.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "./prepared-scope.js";
import { PRODUCT_METADATA } from "./product.js";
import { loadContinuitySnapshot } from "./state.js";
import { pathExists } from "../utils/fs.js";

export interface NextAction {
  action: string;
  file: string | null;
  command: string | null;
  reason: string;
  priority: "critical" | "high" | "normal" | "low";
}

export interface DecisionEngineOutput {
  nextActions: NextAction[];
  summary: string;
}

export async function nextActionEngine(targetRoot: string): Promise<DecisionEngineOutput> {
  const primaryCommand = PRODUCT_METADATA.cli.primaryCommand;
  const agentDir = path.join(targetRoot, ".agent");

  if (!(await pathExists(agentDir))) {
    const action: NextAction = {
      action: "Initialize this repo",
      file: null,
      command: `${primaryCommand} init`,
      reason: "Kiwi Control has not been initialized in this folder yet.",
      priority: "critical"
    };
    return {
      nextActions: [action],
      summary: `${action.action}: ${action.reason}`
    };
  }

  const [gitState, continuity, preparedScope, hasInstructions, hasTokenUsage] = await Promise.all([
    inspectGitState(targetRoot),
    loadContinuitySnapshot(targetRoot),
    loadPreparedScope(targetRoot),
    pathExists(path.join(targetRoot, ".agent", "context", "generated-instructions.md")),
    pathExists(path.join(targetRoot, ".agent", "state", "token-usage.json"))
  ]);

  const actions: NextAction[] = [];
  const nextSuggestedCommand =
    continuity.currentFocus?.nextSuggestedCommand ??
    continuity.latestCheckpoint?.nextSuggestedCommand ??
    null;
  const nextFileToRead = continuity.currentFocus?.nextFileToRead ?? null;
  const recordedAction =
    continuity.latestPhase?.nextRecommendedStep ??
    continuity.currentFocus?.currentFocus ??
    "repo-local continuity already points to the next step";

  if (!preparedScope) {
    const suggestedTask = continuity.currentFocus?.currentFocus ?? "describe your task";
    actions.push({
      action: "Prepare the current task",
      file: nextFileToRead,
      command: `${primaryCommand} prepare "${suggestedTask}"`,
      reason: "Repo-local state exists, but there is no prepared task scope yet.",
      priority: gitState.changedFiles.length > 0 ? "critical" : "high"
    });
  }

  const scopeValidation = preparedScope
    ? validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, gitState.changedFiles)
    : null;

  if (scopeValidation && !scopeValidation.ok) {
    actions.push({
      action: "Refresh prepared scope",
      file: scopeValidation.outOfScopeFiles[0] ?? null,
      command: `${primaryCommand} prepare "${preparedScope?.task ?? "describe your task"}"`,
      reason: `Changed files drifted outside the prepared scope: ${scopeValidation.outOfScopeFiles.slice(0, 3).join(", ")}.`,
      priority: "critical"
    });
  }

  if (preparedScope && (!hasInstructions || !hasTokenUsage)) {
    actions.push({
      action: "Rebuild prepared artifacts",
      file: null,
      command: `${primaryCommand} prepare "${preparedScope.task}"`,
      reason: "The prepared task scope exists, but generated instructions or token state are missing.",
      priority: "high"
    });
  }

  const failedChecks = continuity.latestCheckpoint?.checksFailed ?? [];
  if (continuity.latestPhase?.status === "blocked" || failedChecks.length > 0) {
    actions.push({
      action: "Resolve repo validation issues",
      file: null,
      command: `${primaryCommand} check`,
      reason:
        failedChecks[0] ??
        continuity.latestPhase?.openIssues[0] ??
        continuity.latestPhase?.warnings[0] ??
        "The latest recorded phase is blocked.",
      priority: "high"
    });
  }

  if (gitState.changedFiles.length > 0 && typeof nextSuggestedCommand === "string" && nextSuggestedCommand.length > 0) {
    actions.push({
      action: "Continue the active repo task",
      file: nextFileToRead,
      command: nextSuggestedCommand,
      reason: `There are ${gitState.changedFiles.length} changed file(s) in the current working tree, and ${recordedAction.toLowerCase()}.`,
      priority: actions.length === 0 ? "high" : "normal"
    });
  } else if (gitState.changedFiles.length > 0) {
    actions.push({
      action: "Capture current progress",
      file: null,
      command: `${primaryCommand} checkpoint "milestone"`,
      reason: `There are ${gitState.changedFiles.length} changed file(s), but no stronger repo-local next step is recorded.`,
      priority: "normal"
    });
  } else if (typeof nextSuggestedCommand === "string" && nextSuggestedCommand.length > 0) {
    actions.push({
      action: "Resume the recorded focus",
      file: nextFileToRead,
      command: nextSuggestedCommand,
      reason: "The working tree is clean, and repo-local continuity already records the next recommended command.",
      priority: actions.length === 0 ? "normal" : "low"
    });
  }

  if (actions.length === 0) {
    actions.push({
      action: "Review repo state",
      file: null,
      command: `${primaryCommand} status`,
      reason: "Repo-local state is present and there is no higher-priority corrective action.",
      priority: "low"
    });
  }

  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  actions.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);

  const topAction = actions[0];
  return {
    nextActions: actions,
    summary: topAction ? `${topAction.action}: ${topAction.reason}` : "No next action available."
  };
}
