import path from "node:path";
import { deriveCompatibilityNextActions, getCurrentExecutionStep, syncExecutionPlan } from "./execution-plan.js";
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

  const plan = await syncExecutionPlan(targetRoot, {
    validationIssues,
    persist: options.persist !== false
  });
  const nextActions = deriveCompatibilityNextActions(plan);
  const currentStep = getCurrentExecutionStep(plan);
  const summary = nextActions[0]
    ? `${nextActions[0].action}: ${nextActions[0].reason}`
    : plan.summary;

  return finalizeDecisionOutput(
    targetRoot,
    nextActions,
    summary,
    [
      `execution state: ${plan.state}`,
      `current step index: ${plan.currentStepIndex}`,
      `risk: ${plan.risk}`,
      ...(plan.confidence ? [`confidence: ${plan.confidence}`] : []),
      `${validationIssues.length} validation issue(s)`
    ],
    [
      "ExecutionPlan is the canonical source of truth for next-step decisions.",
      currentStep ? `The active plan step is ${currentStep.id}.` : "There is no active plan step.",
      ...(plan.lastError ? [`A classified plan error exists: ${plan.lastError.errorType}.`] : [])
    ],
    plan.lastError ? ["Ignored generic continuity hints because a classified plan error is active."] : [],
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
