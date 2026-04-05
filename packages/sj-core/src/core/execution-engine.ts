import path from "node:path";
import { assessGoalRisk, type RiskLevel } from "./risk.js";
import { inspectGitState } from "./git.js";
import { loadPreparedScope, validateTouchedFilesAgainstAllowedFiles } from "./prepared-scope.js";
import { deriveModuleGroup } from "./context-index.js";
import { loadCurrentPhase, loadLatestCheckpoint, loadLatestHandoff, loadActiveRoleHints } from "./state.js";
import { PRODUCT_METADATA } from "./product.js";
import { classifyFileArea, deriveTaskCategory } from "./task-intent.js";
import { pathExists, readJson, writeText } from "../utils/fs.js";
import type { ValidationIssue } from "./validator.js";
import type { ContextSelectionState } from "./context-selector.js";
import type { RepoContextTreeState } from "./context-tree.js";
import type { WorkflowState } from "./workflow-engine.js";
import { loadWorkflowState } from "./workflow-engine.js";

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

export type ExecutionPlanStepId = "prepare" | "execute" | "validate" | "checkpoint" | "handoff";
export type ExecutionPlanStepStatus = "pending" | "running" | "success" | "failed";
export type ExecutionErrorType = "execution_error" | "validation_error" | "system_error" | "context_error";

export interface ExecutionPlanStep {
  id: ExecutionPlanStepId;
  description: string;
  command: string;
  expectedOutput: string;
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
}

export interface ExecutionPlanState {
  artifactType: "kiwi-control/execution-plan";
  version: 2;
  task: string | null;
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
  await writeText(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  return outputPath;
}

export async function syncExecutionPlan(
  targetRoot: string,
  options?: {
    task?: string | null;
    validationIssues?: ValidationIssue[];
    forceState?: ExecutionEngineState | null;
  }
): Promise<ExecutionPlanState> {
  const existingPlan = await loadExecutionPlan(targetRoot);
  const [workflow, preparedScope, currentPhase, latestCheckpoint, latestHandoff, activeRoleHints, gitState, selection, contextTree] = await Promise.all([
    loadWorkflowState(targetRoot),
    loadPreparedScope(targetRoot),
    loadCurrentPhase(targetRoot),
    loadLatestCheckpoint(targetRoot),
    loadLatestHandoff(targetRoot),
    loadActiveRoleHints(targetRoot),
    inspectGitState(targetRoot),
    loadContextSelection(targetRoot),
    loadContextTree(targetRoot)
  ]);

  const task =
    options?.task ??
    existingPlan?.task ??
    preparedScope?.task ??
    workflow.task ??
    currentPhase?.goal ??
    null;
  const risk = assessGoalRisk(task ?? "").level;
  const contextSnapshot: ExecutionPlanContextSnapshot = {
    selectedFiles: selection?.include ?? preparedScope?.allowedFiles ?? [],
    selectedModuleGroups: [...new Set((selection?.include ?? preparedScope?.allowedFiles ?? []).map((file) => deriveModuleGroup(file)))].sort((left, right) => left.localeCompare(right)),
    confidence: selection?.confidence ?? null,
    contextTreePath: contextTree ? ".agent/context/context-tree.json" : null,
    dependencyChains: selection?.signals.dependencyChains ?? {}
  };
  const nextSpecialist = activeRoleHints?.nextRecommendedSpecialist ?? "qa-specialist";

  const steps = buildExecutionSteps({
    task,
    workflow,
    latestCheckpointExists: Boolean(latestCheckpoint),
    latestHandoffExists: Boolean(latestHandoff),
    contextSnapshot,
    nextSpecialist
  });

  const validationIssues = options?.validationIssues ?? [];
  const scopeValidation = preparedScope
    ? validateTouchedFilesAgainstAllowedFiles(preparedScope.allowedFiles, gitState.changedFiles)
    : null;
  const lastError = deriveLastError({
    task,
    workflow,
    steps,
    selection,
    preparedScope,
    validationIssues,
    scopeValidation
  });
  const currentStepIndex = deriveCurrentStepIndex(steps);
  const state =
    options?.forceState ??
    deriveExecutionState({
      steps,
      workflow,
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
    updatedAt: new Date().toISOString()
  };
  await persistExecutionPlan(targetRoot, plan);
  return plan;
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
      errorType: "validation_error",
      reason: `Prepared scope violated by touched files: ${scopeValidation.outOfScopeFiles.slice(0, 5).join(", ")}`,
      fixCommand: `${PRIMARY} prepare "${preparedScope.task}"`,
      retryCommand
    };
  }

  if (touchedFiles.length === 0) {
    return {
      ok: false,
      summary: "Validation failed because no expected files changed.",
      validation: "At least one selected or module-group-related file must change.",
      errorType: "validation_error",
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
      validation: "Touched files must overlap the selected files or their module groups.",
      errorType: "validation_error",
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
      validation: "Task outcome must match the selected scope and task category.",
      errorType: "validation_error",
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
  workflow: WorkflowState;
  latestCheckpointExists: boolean;
  latestHandoffExists: boolean;
  contextSnapshot: ExecutionPlanContextSnapshot;
  nextSpecialist: string;
}): ExecutionPlanStep[] {
  const task = options.task ?? "describe your task";
  const workflowSteps = new Map(options.workflow.steps.map((step) => [step.stepId, step] as const));
  return [
    buildPlanStep("prepare", "Prepare bounded context", `${PRIMARY} prepare "${task}"`, "Prepared scope, instructions, token state, and context snapshot are ready.", "Context selection and prepared scope must be recorded before execution.", "prepare-context", workflowSteps.get("prepare-context") ?? null),
    buildPlanStep("execute", "Execute the bounded task", `${PRIMARY} run "${task}"`, "Run packets or equivalent execution artifacts are ready.", "Execution must produce packet/output artifacts inside the prepared scope.", "generate-run-packets", workflowSteps.get("generate-run-packets") ?? null),
    buildPlanStep("validate", "Validate the task outcome", `${PRIMARY} validate "${task}"`, "Final validation confirms scope and outcome correctness.", "Validation must confirm expected files changed, scope remained bounded, and the task goal was achieved.", "validate-outcome", workflowSteps.get("validate-outcome") ?? null),
    buildPlanStep("checkpoint", "Checkpoint the validated work", `${PRIMARY} checkpoint "validated-progress"`, "Checkpoint artifacts record validated progress.", "Checkpointing is allowed only after validation passes.", "checkpoint-progress", workflowSteps.get("checkpoint-progress") ?? null, options.latestCheckpointExists),
    buildPlanStep("handoff", "Handoff the work", `${PRIMARY} handoff --to ${options.nextSpecialist}`, "Handoff artifacts are written for the next specialist/tool.", "Handoff should happen after checkpoint captures validated progress.", "handoff-work", workflowSteps.get("handoff-work") ?? null, options.latestHandoffExists)
  ];
}

function buildPlanStep(
  id: ExecutionPlanStepId,
  description: string,
  command: string,
  expectedOutput: string,
  validation: string,
  workflowStepId: WorkflowState["steps"][number]["stepId"],
  workflowStep: WorkflowState["steps"][number] | null,
  artifactExists = false
): ExecutionPlanStep {
  const status = workflowStep
    ? workflowStep.status
    : artifactExists
      ? "success"
      : "pending";
  return {
    id,
    description,
    command,
    expectedOutput,
    validation,
    status,
    workflowStepId,
    result: workflowStep?.result ?? {
      ok: artifactExists ? true : null,
      summary: workflowStep?.output ?? null,
      validation: workflowStep?.validation ?? null,
      failureReason: workflowStep?.failureReason ?? null,
      suggestedFix: workflowStep?.result?.suggestedFix ?? null
    },
    fixCommand: workflowStep?.result?.suggestedFix ? commandFromSuggestedFix(workflowStep.result.suggestedFix, command) : (status === "failed" ? command : null),
    retryCommand: workflowStep?.result?.retryCommand ?? command
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
    return options.lastError.errorType === "context_error" || options.lastError.errorType === "validation_error"
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
    return {
      errorType: "validation_error",
      reason: `Prepared scope violated by touched files: ${options.scopeValidation.outOfScopeFiles.slice(0, 5).join(", ")}`,
      fixCommand: `${PRIMARY} prepare "${options.preparedScope?.task ?? options.task ?? "describe your task"}"`,
      retryCommand: `${PRIMARY} validate "${options.preparedScope?.task ?? options.task ?? "describe your task"}"`
    };
  }

  const failedStep = options.steps.find((step) => step.status === "failed");
  if (failedStep) {
    const reason = failedStep.result.failureReason ?? failedStep.result.validation ?? `${failedStep.description} failed.`;
    const errorType = classifyExecutionError(failedStep, options.selection, options.preparedScope);
    return {
      errorType,
      reason,
      fixCommand: failedStep.fixCommand ?? failedStep.command,
      retryCommand: failedStep.retryCommand ?? failedStep.command
    };
  }

  const blockingIssue = options.validationIssues.find((issue) => issue.level === "error");
  if (blockingIssue) {
    return {
      errorType: "system_error",
      reason: blockingIssue.message,
      fixCommand: `${PRIMARY} doctor`,
      retryCommand: `${PRIMARY} next`
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
  if (step.id === "validate" || /scope|validation/i.test(step.result.failureReason ?? "")) {
    return "validation_error";
  }
  if (/threw|missing|invalid/i.test(step.result.failureReason ?? "")) {
    return "system_error";
  }
  return "execution_error";
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
  return {
    ...plan,
    version: 2,
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
      dependencyChains: {}
    },
    updatedAt: plan.updatedAt ?? new Date().toISOString()
  };
}
