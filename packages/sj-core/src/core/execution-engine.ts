import path from "node:path";
import { assessGoalRisk, type RiskLevel } from "./risk.js";
import { inspectGitState } from "./git.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "./prepared-scope.js";
import { deriveModuleGroup } from "./context-index.js";
import { loadCurrentPhase, loadLatestCheckpoint, loadLatestHandoff, loadActiveRoleHints } from "./state.js";
import { PRODUCT_METADATA } from "./product.js";
import { classifyFileArea, deriveTaskCategory, deriveTaskArea, parseTaskIntent, type ParsedTaskIntent } from "./task-intent.js";
import { summarizeEval, type EvalSummary } from "./eval.js";
import { pathExists, readJson } from "../utils/fs.js";
import type { ValidationIssue } from "./validator.js";
import type { ContextSelectionState } from "./context-selector.js";
import type { RepoContextTreeState } from "./context-tree.js";
import type { WorkflowState } from "./workflow-engine.js";
import { loadWorkflowState } from "./workflow-engine.js";
import type { ExecutionStateRecord } from "./execution-state.js";
import { loadExecutionState } from "./execution-state.js";
import { persistRuntimeDerivedOutput } from "../runtime/client.js";

export type ExecutionEngineState =
  | "idle"
  | "planning"
  | "ready"
  | "executing"
  | "validating"
  | "failed"
  | "retrying"
  | "blocked"
  | "completed";

export type ExecutionPlanStepId = "prepare" | "expand-context" | "analyze" | "trace" | "locate" | "execute" | "validate" | "checkpoint" | "handoff";
export type ExecutionPlanStepStatus = "pending" | "running" | "success" | "failed";
export type ExecutionErrorType = "context_error" | "logic_error" | "environment_error";
export type RetryStrategy = "expand" | "narrow" | "re-plan";

export interface ExecutionExpectedOutcome {
  expectedFiles: string[];
  expectedChanges: string[];
}

export interface ExecutionPlanStep {
  id: ExecutionPlanStepId;
  description: string;
  command: string;
  expectedOutput: string;
  expectedOutcome: ExecutionExpectedOutcome;
  validation: string;
  status: ExecutionPlanStepStatus;
  workflowStepId: WorkflowState["steps"][number]["stepId"] | null;
  result: {
    ok: boolean | null;
    summary: string | null;
    validation: string | null;
    failureReason: string | null;
    suggestedFix: string | null;
  };
  fixCommand: string | null;
  retryCommand: string | null;
}

export interface ExecutionPlanError {
  errorType: ExecutionErrorType;
  retryStrategy: RetryStrategy;
  reason: string;
  fixCommand: string;
  retryCommand: string;
}

export interface ExecutionPlanContextSnapshot {
  selectedFiles: string[];
  selectedModuleGroups: string[];
  confidence: string | null;
  contextTreePath: string | null;
  dependencyChains: Record<string, string[]>;
  forwardDependencies: string[];
  reverseDependencies: string[];
}

export interface ExecutionPlanHierarchy {
  goal: string | null;
  subtasks: Array<{
    id: string;
    title: string;
    stepIds: ExecutionPlanStepId[];
  }>;
}

export interface ExecutionImpactPreview {
  likelyFiles: string[];
  moduleGroups: string[];
}

export interface ExecutionPlanState {
  artifactType: "kiwi-control/execution-plan";
  version: 2;
  task: string | null;
  intent: ParsedTaskIntent | null;
  hierarchy: ExecutionPlanHierarchy;
  state: ExecutionEngineState;
  currentStepIndex: number;
  confidence: string | null;
  risk: RiskLevel;
  blocked: boolean;
  summary: string;
  steps: ExecutionPlanStep[];
  nextCommands: string[];
  lastError: ExecutionPlanError | null;
  contextSnapshot: ExecutionPlanContextSnapshot;
  impactPreview: ExecutionImpactPreview;
  verificationLayers: Array<{
    id: "syntax" | "behavioral" | "regression";
    description: string;
  }>;
  partialResults: Array<{
    stepId: ExecutionPlanStepId;
    summary: string;
  }>;
  evalSummary: EvalSummary | null;
  updatedAt: string;
}

export interface FinalValidationResult {
  ok: boolean;
  summary: string;
  validation: string;
  errorType: ExecutionErrorType | null;
  reason: string | null;
  fixCommand: string | null;
  retryCommand: string | null;
}

const PRIMARY = PRODUCT_METADATA.cli.primaryCommand;

export async function loadExecutionPlan(targetRoot: string): Promise<ExecutionPlanState | null> {
  const outputPath = executionPlanPath(targetRoot);
  if (!(await pathExists(outputPath))) {
    return null;
  }
  try {
    const state = await readJson<ExecutionPlanState>(outputPath);
    if (state.artifactType !== "kiwi-control/execution-plan") {
      return null;
    }
    return state.version === 2 ? state : migrateExecutionPlan(state);
  } catch {
    return null;
  }
}

export async function persistExecutionPlan(
  targetRoot: string,
  plan: ExecutionPlanState
): Promise<string> {
  const outputPath = executionPlanPath(targetRoot);
  await persistRuntimeDerivedOutput({
    targetRoot,
    outputName: "execution-plan",
    payload: plan
  });
  return outputPath;
}

export async function recordPlanStepResult(
  targetRoot: string,
  options: {
    stepId: ExecutionPlanStepId;
    status: ExecutionPlanStepStatus;
    summary: string | null;
    validation: string | null;
    failureReason?: string | null;
    suggestedFix?: string | null;
  }
): Promise<ExecutionPlanState | null> {
  const plan = await loadExecutionPlan(targetRoot);
  if (!plan) {
    return null;
  }
  const stepIndex = plan.steps.findIndex((step) => step.id === options.stepId);
  if (stepIndex < 0) {
    return plan;
  }
  const step = plan.steps[stepIndex];
  if (!step) {
    return plan;
  }
  plan.steps[stepIndex] = {
    ...step,
    status: options.status,
    result: {
      ok: options.status === "success" ? true : options.status === "failed" ? false : null,
      summary: options.summary,
      validation: options.validation,
      failureReason: options.failureReason ?? null,
      suggestedFix: options.suggestedFix ?? null
    },
    fixCommand: options.status === "failed" ? (options.suggestedFix ? commandFromSuggestedFix(options.suggestedFix, step.command) : step.command) : step.fixCommand,
    retryCommand: step.retryCommand ?? step.command
  };
  const updatedStep = plan.steps[stepIndex];
  if (!updatedStep) {
    return plan;
  }

  if (options.status === "success") {
    const nextPending = plan.steps.findIndex((candidate) => candidate.status !== "success");
    plan.currentStepIndex = nextPending >= 0 ? nextPending : Math.max(plan.steps.length - 1, 0);
  } else if (options.status === "failed") {
    plan.currentStepIndex = stepIndex;
    const errorType = classifyExecutionError(updatedStep, null, null);
    const retryStrategy = deriveRetryStrategy(errorType, plan.confidence);
    plan.lastError = {
      errorType,
      retryStrategy,
      reason: options.failureReason ?? `${options.stepId} failed.`,
      fixCommand: updatedStep.fixCommand ?? buildRetryCommand(retryStrategy, plan.task, step.command),
      retryCommand: updatedStep.retryCommand ?? buildRetryCommand(retryStrategy, plan.task, step.command)
    };
    plan.state = "failed";
    plan.blocked = true;
  }

  if (options.status === "success" && plan.steps.every((candidate) => candidate.status === "success")) {
    plan.state = "completed";
    plan.blocked = false;
    plan.lastError = null;
  } else if (options.status === "success") {
    const current = plan.steps[plan.currentStepIndex] ?? null;
    plan.state = current?.id === "validate" ? "validating" : current?.id === "execute" ? "executing" : "ready";
    plan.blocked = false;
    if (plan.lastError?.retryCommand === updatedStep.retryCommand) {
      plan.lastError = null;
    }
  }

  plan.updatedAt = new Date().toISOString();
  plan.summary = buildExecutionPlanSummary(plan.state, plan.steps[plan.currentStepIndex] ?? null, plan.lastError, plan.task);
  await persistExecutionPlan(targetRoot, plan);
  return plan;
}

export async function syncExecutionPlan(
  targetRoot: string,
  options?: {
    task?: string | null;
    validationIssues?: ValidationIssue[];
    forceState?: ExecutionEngineState | null;
    persist?: boolean;
  }
): Promise<ExecutionPlanState> {
  const existingPlan = await loadExecutionPlan(targetRoot);
  const [workflow, preparedScope, currentPhase, latestCheckpoint, latestHandoff, activeRoleHints, gitState, selection, contextTree, executionState] = await Promise.all([
    loadWorkflowState(targetRoot),
    loadPreparedScope(targetRoot),
    loadCurrentPhase(targetRoot),
    loadLatestCheckpoint(targetRoot),
    loadLatestHandoff(targetRoot),
    loadActiveRoleHints(targetRoot),
    inspectGitState(targetRoot),
    loadContextSelection(targetRoot),
    loadContextTree(targetRoot),
    loadExecutionState(targetRoot, { allowLegacyFallback: false }).catch(() => null)
  ]);
  const effectiveWorkflow = shouldPreferExecutionStateWorkflow(executionState, workflow)
    ? synthesizeWorkflowFromExecutionState(workflow, executionState)
    : workflow;

  const task =
    options?.task ??
    executionState?.task ??
    existingPlan?.task ??
    preparedScope?.task ??
    effectiveWorkflow.task ??
    currentPhase?.goal ??
    null;
  const intent = task ? parseTaskIntent(task, selection?.confidence ?? null) : null;
  const risk = assessGoalRisk(task ?? "").level;
  const prepareStep = effectiveWorkflow.steps.find((step) => step.stepId === "prepare-context") ?? null;
  const shouldEnforcePreparedScope =
    Boolean(preparedScope) &&
    Boolean(task) &&
    normalizeTaskKey(preparedScope?.task) === normalizeTaskKey(task) &&
    prepareStep?.status === "success";
  const contextSnapshot: ExecutionPlanContextSnapshot = {
    selectedFiles: selection?.include ?? preparedScope?.allowedFiles ?? [],
    selectedModuleGroups: [...new Set((selection?.include ?? preparedScope?.allowedFiles ?? []).map((file) => deriveModuleGroup(file)))].sort((left, right) => left.localeCompare(right)),
    confidence: selection?.confidence ?? null,
    contextTreePath: contextTree ? ".agent/context/context-tree.json" : null,
    dependencyChains: selection?.signals.dependencyChains ?? {},
    forwardDependencies: selection?.signals.forwardDependencies ?? [],
    reverseDependencies: selection?.signals.reverseDependencies ?? []
  };
  const nextSpecialist = activeRoleHints?.nextRecommendedSpecialist ?? "qa-specialist";
  const evalSummary = await summarizeEval(targetRoot).catch(() => null);
  const impactPreview = buildImpactPreview(contextSnapshot);

  const steps = buildExecutionSteps({
    task,
    intent,
    workflow: effectiveWorkflow,
    latestCheckpointExists: Boolean(latestCheckpoint),
    latestHandoffExists: Boolean(latestHandoff),
    contextSnapshot,
    nextSpecialist,
    existingPlan,
    evalSummary
  });

  const validationIssues = options?.validationIssues ?? [];
  const scopeValidation = preparedScope
    ? validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, gitState.changedFiles)
    : null;
  const lastError = deriveLastError({
    task,
    workflow: effectiveWorkflow,
    steps,
    selection,
    preparedScope,
    validationIssues,
    scopeValidation: shouldEnforcePreparedScope ? scopeValidation : null
  });
  const currentStepIndex = deriveCurrentStepIndex(steps);
  const state =
    options?.forceState ??
    deriveExecutionState({
      steps,
      workflow: effectiveWorkflow,
      currentStepIndex,
      lastError,
      task,
      selection,
      preparedScope
    });
  const nextCommands = steps
    .slice(currentStepIndex)
    .map((step) => step.command)
    .filter((command, index, all) => Boolean(command) && all.indexOf(command) === index)
    .slice(0, 3);

  const plan: ExecutionPlanState = {
    artifactType: "kiwi-control/execution-plan",
    version: 2,
    task,
    intent,
    hierarchy: buildPlanHierarchy(task, steps),
    state,
    currentStepIndex,
    confidence: contextSnapshot.confidence,
    risk,
    blocked: state === "blocked" || state === "failed",
    summary: buildExecutionPlanSummary(state, steps[currentStepIndex] ?? null, lastError, task),
    steps,
    nextCommands,
    lastError,
    contextSnapshot,
    impactPreview,
    verificationLayers: buildVerificationLayers(intent),
    partialResults: steps
      .filter((step) => step.status === "success" && step.result.summary)
      .map((step) => ({ stepId: step.id, summary: step.result.summary as string })),
    evalSummary,
    updatedAt: new Date().toISOString()
  };
  if (options?.persist !== false) {
    await persistExecutionPlan(targetRoot, plan);
  }
  return plan;
}

function shouldPreferExecutionStateWorkflow(
  executionState: ExecutionStateRecord | null,
  workflow: WorkflowState
): boolean {
  if (!executionState?.lastUpdatedAt) {
    return false;
  }
  if (executionState.task && workflow.task && executionState.task !== workflow.task) {
    return true;
  }

  const executionTimestamp = Date.parse(executionState.lastUpdatedAt);
  const workflowTimestamp = Date.parse(workflow.timestamp);
  if (!Number.isFinite(executionTimestamp) || !Number.isFinite(workflowTimestamp)) {
    return false;
  }

  return (
    executionTimestamp > workflowTimestamp
    && executionState.lifecycle !== "blocked"
    && executionState.lifecycle !== "failed"
  );
}

function synthesizeWorkflowFromExecutionState(
  workflow: WorkflowState,
  executionState: ExecutionStateRecord | null
): WorkflowState {
  if (!executionState) {
    return workflow;
  }

  const steps: WorkflowState["steps"] = workflow.steps.map((step): WorkflowState["steps"][number] => ({
    ...step,
    status: "pending" as const,
    output: null,
    failureReason: null,
    attemptCount: 0,
    retryCount: 0,
    files: [],
    skillsApplied: [],
    tokenUsage: {
      source: "none" as const,
      measuredTokens: null,
      estimatedTokens: null,
      note: "No token usage has been recorded for this step yet."
    },
    result: {
      ok: null,
      summary: null,
      validation: null,
      failureReason: null,
      suggestedFix: null,
      retryCommand: null
    },
    updatedAt: null
  }));
  const setStep = (
    stepId: WorkflowState["steps"][number]["stepId"],
    status: WorkflowState["steps"][number]["status"],
    summary?: string | null
  ): void => {
    const step = steps.find((candidate) => candidate.stepId === stepId);
    if (!step) {
      return;
    }
    step.status = status;
    step.updatedAt = executionState.lastUpdatedAt;
    if (summary) {
      step.output = summary;
      step.result.summary = summary;
    }
    if (status === "success") {
      step.result.ok = true;
    }
    if (status === "failed") {
      step.failureReason = executionState.reason;
      step.result.ok = false;
      step.result.failureReason = executionState.reason;
      step.result.retryCommand = executionState.nextCommand;
    }
  };

  switch (executionState.lifecycle) {
    case "idle":
      break;
    case "packet-created":
      setStep("prepare-context", "success", executionState.reason);
      break;
    case "queued":
      setStep("prepare-context", "success");
      setStep("generate-run-packets", "success", executionState.reason);
      break;
    case "running":
      setStep("prepare-context", "success");
      if (executionState.sourceCommand?.includes("validate")) {
        setStep("generate-run-packets", "success");
        setStep("validate-outcome", "running", executionState.reason);
      } else if (executionState.sourceCommand?.includes("run")) {
        setStep("generate-run-packets", "running", executionState.reason);
      } else {
        setStep("prepare-context", "running", executionState.reason);
      }
      break;
    case "blocked":
    case "failed":
      setStep("prepare-context", "success");
      if (executionState.sourceCommand?.includes("prepare")) {
        setStep("prepare-context", "failed", executionState.reason);
      } else if (executionState.sourceCommand?.includes("run")) {
        setStep("generate-run-packets", "failed", executionState.reason);
      } else {
        setStep("generate-run-packets", "success");
        setStep("validate-outcome", "failed", executionState.reason);
      }
      break;
    case "completed":
      setStep("prepare-context", "success");
      setStep("generate-run-packets", "success");
      setStep("validate-outcome", "success", executionState.reason);
      break;
  }

  const currentStep = steps.find((step) => step.status === "running") ?? null;
  const failedStep = steps.find((step) => step.status === "failed") ?? null;
  return {
    ...workflow,
    task: executionState.task ?? workflow.task,
    status: failedStep
      ? "failed"
      : currentStep
        ? "running"
        : steps.every((step) => step.status === "success")
          ? "success"
          : "pending",
    currentStepId: currentStep?.stepId ?? failedStep?.stepId ?? null,
    timestamp: executionState.lastUpdatedAt ?? workflow.timestamp,
    steps
  };
}

export function deriveCompatibilityNextActions(plan: ExecutionPlanState): Array<{
  action: string;
  file: string | null;
  command: string | null;
  reason: string;
  priority: "critical" | "high" | "normal" | "low";
}> {
  const currentStep = plan.steps[plan.currentStepIndex] ?? null;
  if (plan.lastError) {
    return [{
      action: "Fix the blocking execution issue",
      file: null,
      command: plan.lastError.fixCommand,
      reason: plan.lastError.reason,
      priority: "critical"
    }];
  }
  if (!currentStep) {
    return [];
  }
  return [{
    action: currentStep.description,
    file: plan.contextSnapshot.selectedFiles[0] ?? null,
    command: currentStep.command,
    reason: currentStep.validation,
    priority: currentStep.id === "prepare" ? "high" : "normal"
  }];
}

export function getCurrentExecutionStep(plan: ExecutionPlanState): ExecutionPlanStep | null {
  return plan.steps[plan.currentStepIndex] ?? null;
}

export function getFailedExecutionStep(plan: ExecutionPlanState): ExecutionPlanStep | null {
  return plan.steps.find((step) => step.status === "failed") ?? null;
}

export async function evaluateFinalValidation(
  targetRoot: string,
  task?: string | null
): Promise<FinalValidationResult> {
  const [selection, preparedScope, gitState] = await Promise.all([
    loadContextSelection(targetRoot),
    loadPreparedScope(targetRoot),
    inspectGitState(targetRoot)
  ]);
  const resolvedTask = task ?? preparedScope?.task ?? null;
  const retryCommand = `${PRIMARY} validate${resolvedTask ? ` "${resolvedTask}"` : ""}`;

  if (!preparedScope || !selection) {
    return {
      ok: false,
      summary: "Validation failed because prepared context is missing.",
      validation: "Prepared scope and selected context must exist before final validation can run.",
      errorType: "context_error",
      reason: "Prepared scope or context selection is missing.",
      fixCommand: `${PRIMARY} prepare "${resolvedTask ?? "describe your task"}"`,
      retryCommand
    };
  }

  const touchedFiles = gitState.changedFiles;
  const scopeValidation = validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, touchedFiles);
  if (!scopeValidation.ok) {
    return {
      ok: false,
      summary: "Validation failed because the working tree drifted outside prepared scope.",
      validation: "Touched files must remain inside the prepared scope.",
      errorType: "logic_error",
      reason: `Prepared scope violated by touched files: ${scopeValidation.outOfScopeFiles.slice(0, 5).join(", ")}`,
      fixCommand: `${PRIMARY} prepare "${preparedScope.task}"`,
      retryCommand
    };
  }

  if (touchedFiles.length === 0) {
    return {
      ok: false,
      summary: "Validation failed because no expected files changed.",
      validation: `Expected files: ${(selection.include.slice(0, 6)).join(", ") || "selected scope"}.`,
      errorType: "logic_error",
      reason: "No repository files changed after execution.",
      fixCommand: `${PRIMARY} run "${preparedScope.task}"`,
      retryCommand
    };
  }

  const selectedFiles = new Set(selection.include);
  const selectedModuleGroups = new Set(selection.include.map((file) => deriveModuleGroup(file)));
  const meaningfulOverlap = touchedFiles.some((file) => selectedFiles.has(file) || selectedModuleGroups.has(deriveModuleGroup(file)));
  if (!meaningfulOverlap) {
    return {
      ok: false,
      summary: "Validation failed because changed files do not overlap the selected context.",
      validation: `Expected files or module groups: ${selection.include.slice(0, 6).join(", ") || "selected scope"}.`,
      errorType: "logic_error",
      reason: "Execution changed files outside the selected files and selected module groups.",
      fixCommand: `${PRIMARY} explain`,
      retryCommand
    };
  }

  const taskCategory = deriveTaskCategory(preparedScope.task);
  const goalMatched =
    taskCategory === "docs"
      ? touchedFiles.some((file) => classifyFileArea(file) === "docs" || deriveModuleGroup(file) === "docs")
      : touchedFiles.some((file) => classifyFileArea(file) !== "docs" && (selectedFiles.has(file) || selectedModuleGroups.has(deriveModuleGroup(file))));
  if (!goalMatched) {
    return {
      ok: false,
      summary: "Validation failed because the touched files do not match the task goal heuristic.",
      validation: `Expected changes: ${deriveExpectedChanges(preparedScope.task, selection.include).join("; ")}`,
      errorType: "logic_error",
      reason: "Touched files do not satisfy the task-category goal heuristic.",
      fixCommand: `${PRIMARY} explain`,
      retryCommand
    };
  }

  return {
    ok: true,
    summary: `Validation passed for "${preparedScope.task}".`,
    validation: "Expected files changed, scope stayed bounded, and the task goal heuristic passed.",
    errorType: null,
    reason: null,
    fixCommand: null,
    retryCommand
  };
}

function buildExecutionSteps(options: {
  task: string | null;
  intent: ParsedTaskIntent | null;
  workflow: WorkflowState;
  latestCheckpointExists: boolean;
  latestHandoffExists: boolean;
  contextSnapshot: ExecutionPlanContextSnapshot;
  nextSpecialist: string;
  existingPlan: ExecutionPlanState | null;
  evalSummary: EvalSummary | null;
}): ExecutionPlanStep[] {
  const task = options.task ?? "describe your task";
  const workflowSteps = new Map(options.workflow.steps.map((step) => [step.stepId, step] as const));
  const template = selectPlanTemplate(task, options.contextSnapshot.confidence);
  const previousPlanStepMap = new Map((options.existingPlan?.steps ?? []).map((step) => [step.id, step] as const));
  const steps: ExecutionPlanStep[] = [];

  for (const stepSpec of template) {
    const previousPlanStep = previousPlanStepMap.get(stepSpec.id) ?? null;
    if (stepSpec.id === "prepare") {
      steps.push(buildPlanStep("prepare", stepSpec.description, `${PRIMARY} prepare "${task}"`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "prepare"), stepSpec.validation, "prepare-context", workflowSteps.get("prepare-context") ?? null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "expand-context") {
      steps.push(buildPlanStep("expand-context", stepSpec.description, `${PRIMARY} prepare "${task}" --expand`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "expand-context"), stepSpec.validation, null, null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "analyze") {
      steps.push(buildPlanStep("analyze", stepSpec.description, `${PRIMARY} explain`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "analyze"), stepSpec.validation, null, null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "trace") {
      steps.push(buildPlanStep("trace", stepSpec.description, `${PRIMARY} trace`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "trace"), stepSpec.validation, null, null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "locate") {
      steps.push(buildPlanStep("locate", stepSpec.description, `${PRIMARY} explain`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "locate"), stepSpec.validation, null, null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "execute") {
      steps.push(buildPlanStep("execute", stepSpec.description, `${PRIMARY} run "${task}"`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "execute"), stepSpec.validation, "generate-run-packets", workflowSteps.get("generate-run-packets") ?? null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "validate") {
      steps.push(buildPlanStep("validate", stepSpec.description, `${PRIMARY} validate "${task}"`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "validate"), stepSpec.validation, "validate-outcome", workflowSteps.get("validate-outcome") ?? null, false, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "checkpoint") {
      steps.push(buildPlanStep("checkpoint", stepSpec.description, `${PRIMARY} checkpoint "validated-progress"`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "checkpoint"), stepSpec.validation, "checkpoint-progress", workflowSteps.get("checkpoint-progress") ?? null, options.latestCheckpointExists, previousPlanStep));
      continue;
    }
    if (stepSpec.id === "handoff") {
      steps.push(buildPlanStep("handoff", stepSpec.description, `${PRIMARY} handoff --to ${options.nextSpecialist}`, stepSpec.expectedOutput, buildExpectedOutcome(task, options.intent, options.contextSnapshot, "handoff"), stepSpec.validation, "handoff-work", workflowSteps.get("handoff-work") ?? null, options.latestHandoffExists, previousPlanStep));
    }
  }

  return steps;
}

function buildPlanStep(
  id: ExecutionPlanStepId,
  description: string,
  command: string,
  expectedOutput: string,
  expectedOutcome: ExecutionExpectedOutcome,
  validation: string,
  workflowStepId: WorkflowState["steps"][number]["stepId"] | null,
  workflowStep: WorkflowState["steps"][number] | null,
  artifactExists = false,
  previousPlanStep: ExecutionPlanStep | null = null
): ExecutionPlanStep {
  const status =
    workflowStep
      ? workflowStep.status
      : previousPlanStep?.status ?? (artifactExists ? "success" : "pending");
  return {
    id,
    description,
    command,
    expectedOutput,
    expectedOutcome,
    validation,
    status,
    workflowStepId,
    result: workflowStep?.result ?? previousPlanStep?.result ?? {
      ok: artifactExists ? true : null,
      summary: workflowStep?.output ?? null,
      validation: workflowStep?.validation ?? null,
      failureReason: workflowStep?.failureReason ?? null,
      suggestedFix: workflowStep?.result?.suggestedFix ?? null
    },
    fixCommand: workflowStep?.result?.suggestedFix
      ? commandFromSuggestedFix(workflowStep.result.suggestedFix, command)
      : previousPlanStep?.fixCommand ?? (status === "failed" ? command : null),
    retryCommand: workflowStep?.result?.retryCommand ?? previousPlanStep?.retryCommand ?? command
  };
}

function deriveCurrentStepIndex(steps: ExecutionPlanStep[]): number {
  const running = steps.findIndex((step) => step.status === "running");
  if (running >= 0) {
    return running;
  }
  const failed = steps.findIndex((step) => step.status === "failed");
  if (failed >= 0) {
    return failed;
  }
  const pending = steps.findIndex((step) => step.status !== "success");
  return pending >= 0 ? pending : Math.max(steps.length - 1, 0);
}

function buildExpectedOutcome(
  task: string,
  intent: ParsedTaskIntent | null,
  contextSnapshot: ExecutionPlanContextSnapshot,
  stepId: ExecutionPlanStepId
): ExecutionExpectedOutcome {
  const expectedFiles = contextSnapshot.selectedFiles.slice(0, stepId === "prepare" ? 8 : 12);
  const expectedChanges =
    stepId === "prepare"
      ? ["Prepared scope is written", "Instructions are generated", "Token state is recorded"]
      : stepId === "validate"
        ? [
            `Selected files remain bounded to: ${expectedFiles.slice(0, 6).join(", ") || "selected scope"}`,
            ...deriveExpectedChanges(task, expectedFiles)
          ]
        : stepId === "execute"
          ? deriveExpectedChanges(task, expectedFiles)
          : [`${intent?.expectedOutcome ?? "Task outcome remains inside the selected scope."}`];

  return {
    expectedFiles,
    expectedChanges
  };
}

function deriveExpectedChanges(task: string, expectedFiles: string[]): string[] {
  const category = deriveTaskCategory(task);
  if (category === "docs") {
    return ["Documentation changes land in selected docs files.", `Expected files: ${expectedFiles.slice(0, 6).join(", ") || "docs scope"}`];
  }
  if (category === "testing") {
    return ["Tests or assertions change in the selected scope.", `Expected files: ${expectedFiles.slice(0, 6).join(", ") || "test scope"}`];
  }
  if (category === "config") {
    return ["Configuration or build files change in the selected scope.", `Expected files: ${expectedFiles.slice(0, 6).join(", ") || "config scope"}`];
  }
  return ["Implementation changes land in selected source files or module groups.", `Expected files: ${expectedFiles.slice(0, 6).join(", ") || "selected scope"}`];
}

function buildPlanHierarchy(task: string | null, steps: ExecutionPlanStep[]): ExecutionPlanHierarchy {
  const goal = task;
  const subtasks: ExecutionPlanHierarchy["subtasks"] = [
    {
      id: "scope",
      title: "Scope the work",
      stepIds: steps.filter((step) => ["prepare", "expand-context", "analyze", "trace", "locate"].includes(step.id)).map((step) => step.id)
    },
    {
      id: "change",
      title: "Make the change",
      stepIds: steps.filter((step) => step.id === "execute").map((step) => step.id)
    },
    {
      id: "verify",
      title: "Verify and checkpoint",
      stepIds: steps.filter((step) => ["validate", "checkpoint", "handoff"].includes(step.id)).map((step) => step.id)
    }
  ].filter((subtask) => subtask.stepIds.length > 0);

  return {
    goal,
    subtasks
  };
}

function buildImpactPreview(contextSnapshot: ExecutionPlanContextSnapshot): ExecutionImpactPreview {
  const likelyFiles = [
    ...contextSnapshot.selectedFiles,
    ...Object.keys(contextSnapshot.dependencyChains)
  ].filter((file, index, items) => items.indexOf(file) === index).slice(0, 12);

  return {
    likelyFiles,
    moduleGroups: contextSnapshot.selectedModuleGroups.slice(0, 8)
  };
}

function deriveExecutionState(options: {
  steps: ExecutionPlanStep[];
  workflow: WorkflowState;
  currentStepIndex: number;
  lastError: ExecutionPlanError | null;
  task: string | null;
  selection: ContextSelectionState | null;
  preparedScope: Awaited<ReturnType<typeof loadPreparedScope>>;
}): ExecutionEngineState {
  if (!options.task) {
    return "idle";
  }
  if (options.lastError) {
    return options.lastError.errorType === "context_error" || options.lastError.errorType === "logic_error"
      ? "blocked"
      : "failed";
  }
  const currentStep = options.steps[options.currentStepIndex];
  if (!currentStep) {
    return "idle";
  }
  if (currentStep.status === "running") {
    if (currentStep.id === "prepare") return "planning";
    if (currentStep.id === "execute") return "executing";
    if (currentStep.id === "validate") return "validating";
    return "executing";
  }
  if (options.steps.every((step) => step.status === "success")) {
    return "completed";
  }
  if (currentStep.id === "prepare") {
    return options.preparedScope ? "ready" : "planning";
  }
  if (currentStep.id === "expand-context") {
    return "planning";
  }
  if (currentStep.id === "analyze" || currentStep.id === "trace" || currentStep.id === "locate") {
    return "planning";
  }
  if (currentStep.id === "execute") {
    return "ready";
  }
  if (currentStep.id === "validate") {
    return "validating";
  }
  return "ready";
}

function deriveLastError(options: {
  task: string | null;
  workflow: WorkflowState;
  steps: ExecutionPlanStep[];
  selection: ContextSelectionState | null;
  preparedScope: Awaited<ReturnType<typeof loadPreparedScope>>;
  validationIssues: ValidationIssue[];
  scopeValidation: ReturnType<typeof validateTouchedFilesAgainstAllowedFiles> | null;
}): ExecutionPlanError | null {
  if (options.scopeValidation && !options.scopeValidation.ok) {
    const retryStrategy = deriveRetryStrategy("logic_error", options.selection?.confidence ?? null);
    const resolvedTask = options.preparedScope?.task ?? options.task ?? "describe your task";
    return {
      errorType: "logic_error",
      retryStrategy,
      reason: `Prepared scope violated by touched files: ${options.scopeValidation.outOfScopeFiles.slice(0, 5).join(", ")}`,
      fixCommand: retryStrategy === "expand"
        ? `${PRIMARY} prepare "${resolvedTask}" --expand`
        : `${PRIMARY} prepare "${resolvedTask}"`,
      retryCommand: `${PRIMARY} validate "${resolvedTask}"`
    };
  }

  const failedStep = options.steps.find((step) => step.status === "failed");
  if (failedStep) {
    const reason = failedStep.result.failureReason ?? failedStep.result.validation ?? `${failedStep.description} failed.`;
    const errorType = classifyExecutionError(failedStep, options.selection, options.preparedScope);
    const retryStrategy = deriveRetryStrategy(errorType, options.selection?.confidence ?? null);
    return {
      errorType,
      retryStrategy,
      reason,
      fixCommand: failedStep.fixCommand ?? buildRetryCommand(retryStrategy, options.task, failedStep.command),
      retryCommand: failedStep.retryCommand ?? buildRetryCommand(retryStrategy, options.task, failedStep.command)
    };
  }

  const blockingIssue = options.validationIssues.find((issue) => issue.level === "error");
  if (blockingIssue) {
    const retryStrategy = deriveRetryStrategy("environment_error", options.selection?.confidence ?? null);
    return {
      errorType: "environment_error",
      retryStrategy,
      reason: blockingIssue.message,
      fixCommand: `${PRIMARY} doctor`,
      retryCommand: buildRetryCommand(retryStrategy, options.task, `${PRIMARY} next`)
    };
  }

  return null;
}

function classifyExecutionError(
  step: ExecutionPlanStep,
  selection: ContextSelectionState | null,
  preparedScope: Awaited<ReturnType<typeof loadPreparedScope>>
): ExecutionErrorType {
  if (!selection || !preparedScope) {
    return "context_error";
  }
  if (step.id === "validate" || /scope|validation|expected/i.test(step.result.failureReason ?? "")) {
    return "logic_error";
  }
  if (/threw|missing|invalid/i.test(step.result.failureReason ?? "")) {
    return "environment_error";
  }
  return "logic_error";
}

function deriveRetryStrategy(errorType: ExecutionErrorType, confidence: string | null): RetryStrategy {
  if (confidence === "low") {
    return "expand";
  }
  if (errorType === "context_error") {
    return "expand";
  }
  if (errorType === "environment_error") {
    return "re-plan";
  }
  return "narrow";
}

function buildRetryCommand(strategy: RetryStrategy, task: string | null, fallback: string): string {
  const resolvedTask = task ?? "describe your task";
  switch (strategy) {
    case "expand":
      return `${PRIMARY} prepare "${resolvedTask}" --expand`;
    case "narrow":
      return `${PRIMARY} explain`;
    case "re-plan":
      return `${PRIMARY} plan "${resolvedTask}"`;
    default:
      return fallback;
  }
}

function buildExecutionPlanSummary(
  state: ExecutionEngineState,
  currentStep: ExecutionPlanStep | null,
  lastError: ExecutionPlanError | null,
  task: string | null
): string {
  if (lastError) {
    return `${lastError.errorType}: ${lastError.reason}`;
  }
  if (!currentStep) {
    return "No execution plan is active.";
  }
  return `${state}: ${currentStep.description}${task ? ` for "${task}"` : ""}.`;
}

function commandFromSuggestedFix(suggestedFix: string, fallback: string): string {
  const match = suggestedFix.match(/(kiwi-control [^.,\n]+|kc [^.,\n]+)/);
  return match?.[1] ?? fallback;
}

function executionPlanPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "execution-plan.json");
}

async function loadContextSelection(targetRoot: string): Promise<ContextSelectionState | null> {
  const selectionPath = path.join(targetRoot, ".agent", "state", "context-selection.json");
  if (!(await pathExists(selectionPath))) {
    return null;
  }
  try {
    return await readJson<ContextSelectionState>(selectionPath);
  } catch {
    return null;
  }
}

async function loadContextTree(targetRoot: string): Promise<RepoContextTreeState | null> {
  const contextTreePath = path.join(targetRoot, ".agent", "state", "context-tree.json");
  if (!(await pathExists(contextTreePath))) {
    return null;
  }
  try {
    return await readJson<RepoContextTreeState>(contextTreePath);
  } catch {
    return null;
  }
}

function migrateExecutionPlan(plan: ExecutionPlanState): ExecutionPlanState {
  const normalizedConfidence =
    plan.confidence === "low" || plan.confidence === "medium" || plan.confidence === "high"
      ? plan.confidence
      : null;
  return {
    ...plan,
    version: 2,
    intent: plan.intent ?? (plan.task ? parseTaskIntent(plan.task, normalizedConfidence) : null),
    hierarchy: plan.hierarchy ?? buildPlanHierarchy(plan.task ?? null, plan.steps),
    state: plan.state ?? "idle",
    currentStepIndex: plan.currentStepIndex ?? 0,
    confidence: plan.confidence ?? null,
    risk: plan.risk ?? "low",
    blocked: plan.blocked ?? false,
    lastError: plan.lastError ?? null,
    contextSnapshot: plan.contextSnapshot ?? {
      selectedFiles: [],
      selectedModuleGroups: [],
      confidence: null,
      contextTreePath: null,
      dependencyChains: {},
      forwardDependencies: [],
      reverseDependencies: []
    },
    impactPreview: plan.impactPreview ?? buildImpactPreview(plan.contextSnapshot ?? {
      selectedFiles: [],
      selectedModuleGroups: [],
      confidence: null,
      contextTreePath: null,
      dependencyChains: {},
      forwardDependencies: [],
      reverseDependencies: []
    }),
    verificationLayers: plan.verificationLayers ?? buildVerificationLayers(plan.intent ?? null),
    partialResults: plan.partialResults ?? [],
    evalSummary: plan.evalSummary ?? null,
    updatedAt: plan.updatedAt ?? new Date().toISOString()
  };
}

function buildVerificationLayers(intent: ParsedTaskIntent | null): ExecutionPlanState["verificationLayers"] {
  const layers: ExecutionPlanState["verificationLayers"] = [
    {
      id: "syntax",
      description: "Syntax and shape validation for the selected scope."
    }
  ];
  if (intent && intent.type !== "docs" && intent.type !== "config") {
    layers.push({
      id: "behavioral",
      description: "Behavioral validation for the intended task outcome."
    });
    layers.push({
      id: "regression",
      description: "Regression check against adjacent selected scope and module groups."
    });
  }
  return layers;
}

function normalizeTaskKey(task: string | null | undefined): string {
  return (task ?? "").trim().toLowerCase();
}

function selectPlanTemplate(
  task: string,
  confidence: string | null
): Array<{
  id: ExecutionPlanStepId;
  description: string;
  expectedOutput: string;
  validation: string;
}> {
  const normalized = task.toLowerCase();
  const category = deriveTaskCategory(task);
  const steps: Array<{
    id: ExecutionPlanStepId;
    description: string;
    expectedOutput: string;
    validation: string;
  }> = [];

  steps.push({
    id: "prepare",
    description: "Prepare bounded context",
    expectedOutput: "Prepared scope, instructions, token state, and context snapshot are ready.",
    validation: "Context selection and prepared scope must be recorded before execution."
  });

  if (confidence === "low") {
    steps.push({
      id: "expand-context",
      description: "Expand weak context coverage",
      expectedOutput: "Prepared context is widened because the initial confidence was weak.",
      validation: "Expanded context should increase confidence or widen graph-connected file coverage."
    });
  }

  if (/\bdebug|bug|trace|error|failure|issue|broken|stack\b/.test(normalized)) {
    steps.push({
      id: "trace",
      description: "Trace execution signals",
      expectedOutput: "Execution traces and prior failures are visible.",
      validation: "Trace output should reveal relevant failing steps or affected files."
    });
    steps.push({
      id: "locate",
      description: "Locate the likely issue surface",
      expectedOutput: "Selected files and dependency chains narrow the likely bug area.",
      validation: "Explain output should surface the likely issue files before modification."
    });
  } else if (/\brefactor|rename|cleanup|restructure|simplify|extract\b/.test(normalized) || category === "implementation" && /\bdependency|dependencies\b/.test(normalized)) {
    steps.push({
      id: "analyze",
      description: "Analyze dependencies before modification",
      expectedOutput: "Dependency chains and related files are reviewed before changes.",
      validation: "Explain output should show structural neighbors or dependency chains."
    });
  }

  steps.push({
    id: "execute",
    description: /\bdebug|bug|trace|error|failure|issue|broken\b/.test(normalized) ? "Apply the fix" : "Modify the selected files",
    expectedOutput: "Run packets or equivalent execution artifacts are ready.",
    validation: "Execution must produce packet/output artifacts inside the prepared scope."
  });
  steps.push({
    id: "validate",
    description: "Validate the task outcome",
    expectedOutput: "Final validation confirms scope and outcome correctness.",
    validation: "Validation must confirm expected files changed, scope remained bounded, and the task goal was achieved."
  });
  steps.push({
    id: "checkpoint",
    description: "Checkpoint the validated work",
    expectedOutput: "Checkpoint artifacts record validated progress.",
    validation: "Checkpointing is allowed only after validation passes."
  });
  steps.push({
    id: "handoff",
    description: "Handoff the work",
    expectedOutput: "Handoff artifacts are written for the next specialist/tool.",
    validation: "Handoff should happen after checkpoint captures validated progress."
  });
  return steps;
}
