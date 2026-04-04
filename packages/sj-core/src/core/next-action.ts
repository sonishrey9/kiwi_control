import path from "node:path";
import { inspectGitState } from "./git.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "./prepared-scope.js";
import { PRODUCT_METADATA } from "./product.js";
import { loadContinuitySnapshot } from "./state.js";
import type { ValidationIssue } from "./validator.js";
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

export async function nextActionEngine(
  targetRoot: string,
  validationIssues: ValidationIssue[] = []
): Promise<DecisionEngineOutput> {
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
  const liveValidationAction = buildLiveValidationAction(validationIssues, targetRoot, primaryCommand);
  const hasLiveValidationIssues = validationIssues.length > 0;
  const hasBlockingValidationIssue = validationIssues.some((issue) => issue.level === "error");
  const nextSuggestedCommand =
    continuity.currentFocus?.nextSuggestedCommand ??
    continuity.latestCheckpoint?.nextSuggestedCommand ??
    null;
  const nextFileToRead = continuity.currentFocus?.nextFileToRead ?? null;
  const recordedAction =
    continuity.latestPhase?.nextRecommendedStep ??
    continuity.currentFocus?.currentFocus ??
    "repo-local continuity already points to the next step";

  if (liveValidationAction) {
    actions.push(liveValidationAction);
  }

  if (!preparedScope && !hasBlockingValidationIssue) {
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

  if (preparedScope && (!hasInstructions || !hasTokenUsage) && !hasBlockingValidationIssue) {
    actions.push({
      action: "Rebuild prepared artifacts",
      file: null,
      command: `${primaryCommand} prepare "${preparedScope.task}"`,
      reason: "The prepared task scope exists, but generated instructions or token state are missing.",
      priority: "high"
    });
  }

  if (!hasLiveValidationIssues && gitState.changedFiles.length > 0 && typeof nextSuggestedCommand === "string" && nextSuggestedCommand.length > 0) {
    actions.push({
      action: "Continue the active repo task",
      file: nextFileToRead,
      command: nextSuggestedCommand,
      reason: `There are ${gitState.changedFiles.length} changed file(s) in the current working tree, and ${recordedAction.toLowerCase()}.`,
      priority: actions.length === 0 ? "high" : "normal"
    });
  } else if (!hasLiveValidationIssues && gitState.changedFiles.length > 0) {
    actions.push({
      action: "Capture current progress",
      file: null,
      command: `${primaryCommand} checkpoint "milestone"`,
      reason: `There are ${gitState.changedFiles.length} changed file(s), but no stronger repo-local next step is recorded.`,
      priority: "normal"
    });
  } else if (!hasLiveValidationIssues && typeof nextSuggestedCommand === "string" && nextSuggestedCommand.length > 0) {
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

function buildLiveValidationAction(
  validationIssues: ValidationIssue[],
  targetRoot: string,
  primaryCommand: string
): NextAction | null {
  if (validationIssues.length === 0) {
    return null;
  }

  const topIssue = [...validationIssues].sort((left, right) => {
    const leftSeverity = left.level === "error" ? 0 : 1;
    const rightSeverity = right.level === "error" ? 0 : 1;
    if (leftSeverity !== rightSeverity) {
      return leftSeverity - rightSeverity;
    }

    const leftIsTargetIssue = left.filePath?.startsWith(targetRoot) ? 0 : 1;
    const rightIsTargetIssue = right.filePath?.startsWith(targetRoot) ? 0 : 1;
    return leftIsTargetIssue - rightIsTargetIssue;
  })[0] ?? null;

  if (!topIssue) {
    return null;
  }

  const target = formatValidationTarget(topIssue.filePath, targetRoot);
  const action = buildValidationActionLabel(topIssue, target);

  return {
    action,
    file: topIssue.filePath ?? null,
    command: `${primaryCommand} check`,
    reason: target ? `${target}: ${topIssue.message}.` : `${topIssue.message}.`,
    priority: topIssue.level === "error" ? "critical" : "high"
  };
}

function formatValidationTarget(filePath: string | undefined, targetRoot: string): string | null {
  if (!filePath) {
    return null;
  }

  if (filePath.startsWith(targetRoot)) {
    return path.relative(targetRoot, filePath) || path.basename(filePath);
  }

  return path.basename(filePath);
}

function buildValidationActionLabel(issue: ValidationIssue, target: string | null): string {
  const subject = target ?? "repo validation issue";
  if (issue.message === "generated repo-local state missing" || issue.message === "native repo surface missing" || issue.message === "required file missing") {
    return `Restore ${subject}`;
  }

  if (issue.message === "managed markers are unbalanced" || issue.message.startsWith("invalid JSON") || issue.message.startsWith("invalid YAML")) {
    return `Repair ${subject}`;
  }

  if (issue.level === "warn") {
    return `Review ${subject}`;
  }

  return `Fix ${subject}`;
}
