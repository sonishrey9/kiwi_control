import path from "node:path";
import type { ValidationIssue } from "./validator.js";
import { pathExists, writeText } from "../utils/fs.js";
import { getRuntimeSnapshot } from "../runtime/client.js";
import { runtimeDecisionFromSnapshot } from "./runtime-decision.js";

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
  validationIssues: ValidationIssue[] = [],
  options: { persist?: boolean } = {}
): Promise<DecisionEngineOutput> {
  const agentDir = path.join(targetRoot, ".agent");
  if (!(await pathExists(agentDir))) {
    const action: NextAction = {
      action: "Initialize this repo",
      file: null,
      command: "kiwi-control init",
      reason: "Kiwi Control has not been initialized in this folder yet.",
      priority: "critical"
    };
    return finalizeDecisionOutput(
      targetRoot,
      [action],
      `${action.action}: ${action.reason}`,
      ["repo not initialized"],
      ["Initialization is the first priority because no repo-local control plane exists yet."],
      [],
      options.persist !== false
    );
  }

  const runtimeSnapshot = await getRuntimeSnapshot(targetRoot);
  const runtimeDecision = runtimeDecisionFromSnapshot(runtimeSnapshot);
  const liveValidationAction = buildLiveValidationAction(validationIssues);
  const nextActions = liveValidationAction
    ? [liveValidationAction]
    : runtimeDecision.nextAction
      ? [{
          ...runtimeDecision.nextAction,
          file: null
        }]
      : [];
  const summary = nextActions[0]
    ? `${nextActions[0].action}: ${nextActions[0].reason}`
    : runtimeDecision.recovery?.reason ?? runtimeDecision.readinessDetail;

  return finalizeDecisionOutput(
    targetRoot,
    nextActions,
    summary,
    [
      `execution lifecycle: ${runtimeSnapshot.lifecycle}`,
      `current step: ${runtimeDecision.currentStepId}`,
      `decision source: ${runtimeDecision.decisionSource}`,
      `${validationIssues.length} validation issue(s)`
    ],
    [
      "Runtime decision state is the canonical source of truth for next-step decisions.",
      ...(liveValidationAction ? ["Live repo validation errors override calm runtime execution state."] : []),
      `The active runtime step is ${runtimeDecision.currentStepId}.`,
      ...(runtimeDecision.recovery ? [`A canonical runtime recovery is active: ${runtimeDecision.recovery.kind}.`] : [])
    ],
    [
      ...(runtimeDecision.recovery ? ["Ignored compatibility plan hints because runtime recovery is active."] : []),
      ...(liveValidationAction ? ["Ignored runtime next-action defaults because repo validation is currently failing."] : [])
    ],
    options.persist !== false
  );
}

async function finalizeDecisionOutput(
  targetRoot: string,
  nextActions: NextAction[],
  summary: string,
  inputSignals: string[],
  reasoningChain: string[],
  ignoredSignals: string[],
  persist: boolean
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

  if (persist) {
    await persistDecisionLogic(targetRoot, decisionLogic).catch(() => null);
  }
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

function buildLiveValidationAction(validationIssues: ValidationIssue[]): NextAction | null {
  const blockingIssue = validationIssues.find((issue) => issue.level === "error");
  if (!blockingIssue) {
    return null;
  }

  return {
    action: "Fix the blocking execution issue",
    file: blockingIssue.filePath ?? null,
    command: "kiwi-control doctor",
    reason: blockingIssue.message,
    priority: "critical"
  };
}
