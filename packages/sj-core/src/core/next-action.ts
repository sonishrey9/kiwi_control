import path from "node:path";
import { inspectGitState } from "./git.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "./prepared-scope.js";
import { PRODUCT_METADATA } from "./product.js";
import { loadRuntimeLifecycle } from "./runtime-lifecycle.js";
import { loadContinuitySnapshot } from "./state.js";
import type { ValidationIssue } from "./validator.js";
import { pathExists, writeText } from "../utils/fs.js";

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
  decisionLogic: DecisionLogicState;
}

export interface DecisionLogicState {
  artifactType: "kiwi-control/decision-logic";
  version: 1;
  timestamp: string;
  summary: string;
  decisionPriority: NextAction["priority"];
  inputSignals: string[];
  reasoningChain: string[];
  ignoredSignals: string[];
}

export async function nextActionEngine(
  targetRoot: string,
  validationIssues: ValidationIssue[] = []
): Promise<DecisionEngineOutput> {
  const primaryCommand = PRODUCT_METADATA.cli.primaryCommand;
  const agentDir = path.join(targetRoot, ".agent");
  const inputSignals: string[] = [];
  const reasoningChain: string[] = [];
  const ignoredSignals: string[] = [];

  if (!(await pathExists(agentDir))) {
    const action: NextAction = {
      action: "Initialize this repo",
      file: null,
      command: `${primaryCommand} init`,
      reason: "Kiwi Control has not been initialized in this folder yet.",
      priority: "critical"
    };
    inputSignals.push("repo not initialized");
    reasoningChain.push("Initialization is the first priority because no repo-local control plane exists yet.");
    return finalizeDecisionOutput(targetRoot, [action], `${action.action}: ${action.reason}`, inputSignals, reasoningChain, ignoredSignals);
  }

  const [gitState, continuity, preparedScope, hasInstructions, hasTokenUsage, runtimeLifecycle] = await Promise.all([
    inspectGitState(targetRoot),
    loadContinuitySnapshot(targetRoot),
    loadPreparedScope(targetRoot),
    pathExists(path.join(targetRoot, ".agent", "context", "generated-instructions.md")),
    pathExists(path.join(targetRoot, ".agent", "state", "token-usage.json")),
    loadRuntimeLifecycle(targetRoot)
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
  inputSignals.push(`${validationIssues.length} validation issue(s)`);
  inputSignals.push(preparedScope ? "prepared scope present" : "prepared scope missing");
  inputSignals.push(`${gitState.changedFiles.length} changed file(s)`);
  inputSignals.push(nextSuggestedCommand ? "continuity next command recorded" : "no continuity command recorded");
  inputSignals.push(`runtime lifecycle: ${runtimeLifecycle.currentStage}`);

  if (liveValidationAction) {
    actions.push(liveValidationAction);
    reasoningChain.push("A live validation issue exists, so repo correctness outranks continuity guidance.");
    if (nextSuggestedCommand) {
      ignoredSignals.push("Ignored recorded continue/resume guidance until the validation issue is fixed.");
    }
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
    reasoningChain.push("Preparation is required before Kiwi can make bounded, trustworthy file decisions.");
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
    inputSignals.push(`${scopeValidation.outOfScopeFiles.length} out-of-scope file(s)`);
    reasoningChain.push("Prepared scope drift was detected, so refreshing scope takes priority over continuing the task.");
    if (nextSuggestedCommand) {
      ignoredSignals.push("Ignored recorded next-step continuity because the working tree drifted outside the prepared scope.");
    }
  }

  if (preparedScope && (!hasInstructions || !hasTokenUsage) && !hasBlockingValidationIssue) {
    actions.push({
      action: "Rebuild prepared artifacts",
      file: null,
      command: `${primaryCommand} prepare "${preparedScope.task}"`,
      reason: "The prepared task scope exists, but generated instructions or token state are missing.",
      priority: "high"
    });
    reasoningChain.push("Prepared artifacts are incomplete, so Kiwi should rebuild instructions and token state before continuing.");
  }

  if (
    preparedScope &&
    hasInstructions &&
    hasTokenUsage &&
    gitState.changedFiles.length === 0 &&
    !hasLiveValidationIssues &&
    runtimeLifecycle.currentStage === "prepared"
  ) {
    actions.push({
      action: "Start the prepared task",
      file: preparedScope.allowedFiles[0] ?? null,
      command: null,
      reason: "The prepared scope, instructions, and token estimate are ready. Begin work inside the selected files before widening scope.",
      priority: actions.length === 0 ? "high" : "normal"
    });
    reasoningChain.push("A prepared task with no working-tree changes should start from the bounded instructions instead of falling back to generic status guidance.");
  }

  if (
    gitState.changedFiles.length === 0 &&
    !hasLiveValidationIssues &&
    runtimeLifecycle.currentStage === "packetized"
  ) {
    actions.push({
      action: "Execute the generated run packet",
      file: nextFileToRead,
      command: nextSuggestedCommand,
      reason: runtimeLifecycle.nextRecommendedAction ?? "Run packets are written and ready for the assigned execution flow.",
      priority: actions.length === 0 ? "high" : "normal"
    });
    reasoningChain.push("Packet generation already happened, so the next helpful step is execution rather than another planning pass.");
  }

  if (!hasLiveValidationIssues && gitState.changedFiles.length > 0 && typeof nextSuggestedCommand === "string" && nextSuggestedCommand.length > 0) {
    actions.push({
      action: "Continue the active repo task",
      file: nextFileToRead,
      command: nextSuggestedCommand,
      reason: `There are ${gitState.changedFiles.length} changed file(s) in the current working tree, and ${recordedAction.toLowerCase()}.`,
      priority: actions.length === 0 ? "high" : "normal"
    });
    reasoningChain.push("Changed work plus a recorded next command makes continuation the strongest non-corrective action.");
  } else if (!hasLiveValidationIssues && gitState.changedFiles.length > 0) {
    actions.push({
      action: "Capture current progress",
      file: null,
      command: `${primaryCommand} checkpoint "milestone"`,
      reason: `There are ${gitState.changedFiles.length} changed file(s), but no stronger repo-local next step is recorded.`,
      priority: "normal"
    });
    reasoningChain.push("Changed work exists, but continuity is weak, so capturing progress is the safest recommendation.");
  } else if (!hasLiveValidationIssues && typeof nextSuggestedCommand === "string" && nextSuggestedCommand.length > 0) {
    actions.push({
      action: "Resume the recorded focus",
      file: nextFileToRead,
      command: nextSuggestedCommand,
      reason: "The working tree is clean, and repo-local continuity already records the next recommended command.",
      priority: actions.length === 0 ? "normal" : "low"
    });
    reasoningChain.push("With a clean tree and a recorded next command, resume guidance is safe but lower-priority than corrective actions.");
  }

  if (actions.length === 0) {
    actions.push({
      action: "Review repo state",
      file: null,
      command: `${primaryCommand} status`,
      reason: "Repo-local state is present and there is no higher-priority corrective action.",
      priority: "low"
    });
    reasoningChain.push("No corrective or continuity signal dominated, so the system falls back to status review.");
  }

  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  actions.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);

  const topAction = actions[0];
  return finalizeDecisionOutput(
    targetRoot,
    actions,
    topAction ? `${topAction.action}: ${topAction.reason}` : "No next action available.",
    inputSignals,
    reasoningChain,
    ignoredSignals
  );
}

async function finalizeDecisionOutput(
  targetRoot: string,
  nextActions: NextAction[],
  summary: string,
  inputSignals: string[],
  reasoningChain: string[],
  ignoredSignals: string[]
): Promise<DecisionEngineOutput> {
  const topPriority = nextActions[0]?.priority ?? "low";
  const decisionLogic: DecisionLogicState = {
    artifactType: "kiwi-control/decision-logic",
    version: 1,
    timestamp: new Date().toISOString(),
    summary,
    decisionPriority: topPriority,
    inputSignals,
    reasoningChain,
    ignoredSignals
  };

  await persistDecisionLogic(targetRoot, decisionLogic).catch(() => null);
  return { nextActions, summary, decisionLogic };
}

async function persistDecisionLogic(
  targetRoot: string,
  logic: DecisionLogicState
): Promise<string> {
  const statePath = path.join(targetRoot, ".agent", "state", "decision-logic.json");
  await writeText(statePath, `${JSON.stringify(logic, null, 2)}\n`);
  return statePath;
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
