import path from "node:path";
import { pathExists, readJson, writeText } from "../utils/fs.js";

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";
export type WorkflowStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowTokenUsage {
  source: "measured" | "estimated" | "mixed" | "none";
  measuredTokens: number | null;
  estimatedTokens: number | null;
  note: string;
}

export interface WorkflowStep {
  stepId: string;
  action: string;
  status: WorkflowStepStatus;
  input: string | null;
  expectedOutput: string | null;
  output: string | null;
  validation: string | null;
  failureReason: string | null;
  attemptCount: number;
  retryCount: number;
  files: string[];
  skillsApplied: string[];
  tokenUsage: WorkflowTokenUsage;
  updatedAt: string | null;
}

export interface WorkflowState {
  artifactType: "kiwi-control/workflow";
  version: 2;
  timestamp: string;
  task: string | null;
  status: WorkflowStatus;
  currentStepId: string | null;
  steps: WorkflowStep[];
}

export interface WorkflowProgressEntry {
  task: string | null;
  eventType: string;
  status: "ok" | "warn" | "error";
  summary: string;
  input?: string | null;
  expectedOutput?: string | null;
  validation?: string | null;
  failureReason?: string | null;
  files?: string[];
  skillsApplied?: string[];
  measuredTokens?: number | null;
  estimatedTokens?: number | null;
}

export interface WorkflowExecutionOptions<Result> {
  task: string | null;
  stepId: WorkflowStep["stepId"];
  input: string | null;
  expectedOutput: string | null;
  run: () => Promise<Result>;
  validate: (result: Result) => {
    ok: boolean;
    validation: string;
    failureReason?: string | null;
  };
  summarize: (result: Result) => {
    summary: string;
    files?: string[];
    skillsApplied?: string[];
    measuredTokens?: number | null;
    estimatedTokens?: number | null;
  };
}

const WORKFLOW_STEPS = [
  {
    stepId: "prepare-context",
    action: "Prepare context",
    eventTypes: ["prepare_completed"],
    expectedOutput: "Prepared scope and generated instructions are ready.",
    validation: "Prepared scope exists and selected files are bounded."
  },
  {
    stepId: "generate-run-packets",
    action: "Generate run packets",
    eventTypes: ["packets_generated"],
    expectedOutput: "One or more run packets are written for execution.",
    validation: "Packet output exists and at least one packet was generated."
  },
  {
    stepId: "checkpoint-progress",
    action: "Checkpoint progress",
    eventTypes: ["validation_checkpoint", "checkpoint_recorded"],
    expectedOutput: "Checkpoint artifacts are written and continuity is updated.",
    validation: "Checkpoint JSON exists and prepared scope remains valid."
  },
  {
    stepId: "handoff-work",
    action: "Handoff work",
    eventTypes: ["handoff_recorded"],
    expectedOutput: "Handoff artifacts are written for the next specialist/tool.",
    validation: "Handoff JSON exists and target specialist/tool is recorded."
  }
] as const;

function workflowPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "workflow.json");
}

function createWorkflow(task: string | null): WorkflowState {
  return {
    artifactType: "kiwi-control/workflow",
    version: 2,
    timestamp: new Date().toISOString(),
    task,
    status: "pending",
    currentStepId: WORKFLOW_STEPS[0]?.stepId ?? null,
    steps: WORKFLOW_STEPS.map((step) => ({
      stepId: step.stepId,
      action: step.action,
      status: "pending",
      input: null,
      expectedOutput: step.expectedOutput,
      output: null,
      validation: step.validation,
      failureReason: null,
      attemptCount: 0,
      retryCount: 0,
      files: [],
      skillsApplied: [],
      tokenUsage: {
        source: "none",
        measuredTokens: null,
        estimatedTokens: null,
        note: "No token usage has been recorded for this step yet."
      },
      updatedAt: null
    }))
  };
}

export async function loadWorkflowState(targetRoot: string): Promise<WorkflowState> {
  const outputPath = workflowPath(targetRoot);
  if (!(await pathExists(outputPath))) {
    return createWorkflow(null);
  }

  try {
    const state = await readJson<WorkflowState>(outputPath);
    if (state.artifactType !== "kiwi-control/workflow") {
      return createWorkflow(null);
    }
    if (state.version !== 2) {
      return migrateWorkflowState(state);
    }
    return state;
  } catch {
    return createWorkflow(null);
  }
}

export async function initializeWorkflow(
  targetRoot: string,
  task: string | null
): Promise<WorkflowState> {
  const current = await loadWorkflowState(targetRoot);
  if (current.task === task && current.steps.length > 0) {
    return current;
  }

  const next = createWorkflow(task);
  await persistWorkflowState(targetRoot, next);
  return next;
}

export async function startWorkflowStep(
  targetRoot: string,
  options: {
    task: string | null;
    stepId: WorkflowStep["stepId"];
    input: string | null;
    expectedOutput?: string | null;
  }
): Promise<WorkflowState> {
  const current = await initializeWorkflow(targetRoot, options.task);
  const next = cloneWorkflowState(current);
  const step = next.steps.find((candidate) => candidate.stepId === options.stepId);
  if (!step) {
    return current;
  }

  const now = new Date().toISOString();
  const retry = step.status === "failed";
  step.status = "running";
  step.input = options.input;
  if (options.expectedOutput !== undefined) {
    step.expectedOutput = options.expectedOutput;
  }
  step.output = null;
  step.failureReason = null;
  step.attemptCount += 1;
  if (retry) {
    step.retryCount += 1;
  }
  step.updatedAt = now;

  next.timestamp = now;
  next.currentStepId = step.stepId;
  next.status = "running";
  await persistWorkflowState(targetRoot, next);
  return next;
}

export async function completeWorkflowStep(
  targetRoot: string,
  options: {
    task: string | null;
    stepId: WorkflowStep["stepId"];
    output: string;
    validation: string;
    files?: string[];
    skillsApplied?: string[];
    measuredTokens?: number | null;
    estimatedTokens?: number | null;
  }
): Promise<WorkflowState> {
  const current = await initializeWorkflow(targetRoot, options.task);
  const next = cloneWorkflowState(current);
  const step = next.steps.find((candidate) => candidate.stepId === options.stepId);
  if (!step) {
    return current;
  }

  const now = new Date().toISOString();
  step.status = "completed";
  step.output = options.output;
  step.validation = options.validation;
  step.failureReason = null;
  step.files = [...new Set(options.files ?? step.files)];
  step.skillsApplied = [...new Set(options.skillsApplied ?? step.skillsApplied)];
  step.tokenUsage = buildWorkflowTokenUsage({
    task: options.task,
    eventType: step.stepId,
    status: "ok",
    summary: options.output,
    validation: options.validation,
    ...(options.measuredTokens !== undefined ? { measuredTokens: options.measuredTokens } : {}),
    ...(options.estimatedTokens !== undefined ? { estimatedTokens: options.estimatedTokens } : {})
  });
  step.updatedAt = now;

  next.timestamp = now;
  next.currentStepId = findNextPendingStepId(next.steps, step.stepId);
  next.status = next.steps.every((candidate) => candidate.status === "completed")
    ? "completed"
    : "running";
  await persistWorkflowState(targetRoot, next);
  return next;
}

export async function failWorkflowStep(
  targetRoot: string,
  options: {
    task: string | null;
    stepId: WorkflowStep["stepId"];
    failureReason: string;
    validation: string;
    files?: string[];
    skillsApplied?: string[];
    measuredTokens?: number | null;
    estimatedTokens?: number | null;
  }
): Promise<WorkflowState> {
  const current = await initializeWorkflow(targetRoot, options.task);
  const next = cloneWorkflowState(current);
  const step = next.steps.find((candidate) => candidate.stepId === options.stepId);
  if (!step) {
    return current;
  }

  const now = new Date().toISOString();
  step.status = "failed";
  step.output = null;
  step.validation = options.validation;
  step.failureReason = options.failureReason;
  step.files = [...new Set(options.files ?? step.files)];
  step.skillsApplied = [...new Set(options.skillsApplied ?? step.skillsApplied)];
  step.tokenUsage = buildWorkflowTokenUsage({
    task: options.task,
    eventType: step.stepId,
    status: "error",
    summary: options.failureReason,
    validation: options.validation,
    failureReason: options.failureReason,
    ...(options.measuredTokens !== undefined ? { measuredTokens: options.measuredTokens } : {}),
    ...(options.estimatedTokens !== undefined ? { estimatedTokens: options.estimatedTokens } : {})
  });
  step.updatedAt = now;

  next.timestamp = now;
  next.currentStepId = step.stepId;
  next.status = "failed";
  await persistWorkflowState(targetRoot, next);
  return next;
}

export async function executeWorkflowStep<Result>(
  targetRoot: string,
  options: WorkflowExecutionOptions<Result>
): Promise<{
  ok: boolean;
  result: Result | null;
  state: WorkflowState;
  validation: string;
  failureReason: string | null;
}> {
  await startWorkflowStep(targetRoot, {
    task: options.task,
    stepId: options.stepId,
    input: options.input,
    expectedOutput: options.expectedOutput
  });

  try {
    const result = await options.run();
    const validation = options.validate(result);
    const summary = options.summarize(result);

    const state = validation.ok
      ? await completeWorkflowStep(targetRoot, {
          task: options.task,
          stepId: options.stepId,
          output: summary.summary,
          validation: validation.validation,
          ...(summary.files ? { files: summary.files } : {}),
          ...(summary.skillsApplied ? { skillsApplied: summary.skillsApplied } : {}),
          ...(summary.measuredTokens !== undefined ? { measuredTokens: summary.measuredTokens } : {}),
          ...(summary.estimatedTokens !== undefined ? { estimatedTokens: summary.estimatedTokens } : {})
        })
      : await failWorkflowStep(targetRoot, {
          task: options.task,
          stepId: options.stepId,
          failureReason: validation.failureReason ?? validation.validation,
          validation: validation.validation,
          ...(summary.files ? { files: summary.files } : {}),
          ...(summary.skillsApplied ? { skillsApplied: summary.skillsApplied } : {}),
          ...(summary.measuredTokens !== undefined ? { measuredTokens: summary.measuredTokens } : {}),
          ...(summary.estimatedTokens !== undefined ? { estimatedTokens: summary.estimatedTokens } : {})
        });

    return {
      ok: validation.ok,
      result,
      state,
      validation: validation.validation,
      failureReason: validation.ok ? null : (validation.failureReason ?? validation.validation)
    };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    const state = await failWorkflowStep(targetRoot, {
      task: options.task,
      stepId: options.stepId,
      failureReason,
      validation: "Step execution threw before validation completed."
    });
    return {
      ok: false,
      result: null,
      state,
      validation: "Step execution threw before validation completed.",
      failureReason
    };
  }
}

export async function recordWorkflowProgress(
  targetRoot: string,
  entry: WorkflowProgressEntry
): Promise<WorkflowState> {
  const current = await initializeWorkflow(targetRoot, entry.task);
  const stepTemplate = WORKFLOW_STEPS.find((candidate) =>
    candidate.eventTypes.some((eventType) => eventType === entry.eventType)
  );
  if (!stepTemplate) {
    return current;
  }

  if (entry.status === "error") {
    return failWorkflowStep(targetRoot, {
      task: entry.task,
      stepId: stepTemplate.stepId,
      failureReason: entry.failureReason ?? entry.summary,
      validation: entry.validation ?? stepTemplate.validation,
      ...(entry.files ? { files: entry.files } : {}),
      ...(entry.skillsApplied ? { skillsApplied: entry.skillsApplied } : {}),
      ...(entry.measuredTokens !== undefined ? { measuredTokens: entry.measuredTokens } : {}),
      ...(entry.estimatedTokens !== undefined ? { estimatedTokens: entry.estimatedTokens } : {})
    });
  }

  return completeWorkflowStep(targetRoot, {
    task: entry.task,
    stepId: stepTemplate.stepId,
    output: entry.summary,
    validation: entry.validation ?? stepTemplate.validation,
    ...(entry.files ? { files: entry.files } : {}),
    ...(entry.skillsApplied ? { skillsApplied: entry.skillsApplied } : {}),
    ...(entry.measuredTokens !== undefined ? { measuredTokens: entry.measuredTokens } : {}),
    ...(entry.estimatedTokens !== undefined ? { estimatedTokens: entry.estimatedTokens } : {})
  });
}

export async function persistWorkflowState(targetRoot: string, state: WorkflowState): Promise<string> {
  const outputPath = workflowPath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(state, null, 2)}\n`);
  return outputPath;
}

function buildWorkflowTokenUsage(entry: WorkflowProgressEntry): WorkflowTokenUsage {
  const measured = entry.measuredTokens ?? null;
  const estimated = entry.estimatedTokens ?? null;
  if (measured != null && estimated != null) {
    return {
      source: "mixed",
      measuredTokens: measured,
      estimatedTokens: estimated,
      note: "This step has both measured and estimated token context."
    };
  }
  if (measured != null) {
    return {
      source: "measured",
      measuredTokens: measured,
      estimatedTokens: null,
      note: "This step recorded measured token usage."
    };
  }
  if (estimated != null) {
    return {
      source: "estimated",
      measuredTokens: null,
      estimatedTokens: estimated,
      note: "This step only has an estimated token total."
    };
  }
  return {
    source: "none",
    measuredTokens: null,
    estimatedTokens: null,
    note: "No token usage was recorded for this step."
  };
}

function findNextPendingStepId(
  steps: WorkflowStep[],
  currentStepId: WorkflowStep["stepId"]
): string | null {
  const currentIndex = steps.findIndex((step) => step.stepId === currentStepId);
  for (const step of steps.slice(currentIndex + 1)) {
    if (step.status !== "completed") {
      return step.stepId;
    }
  }
  return null;
}

function cloneWorkflowState(state: WorkflowState): WorkflowState {
  return {
    ...state,
    steps: state.steps.map((step) => ({
      ...step,
      files: [...step.files],
      skillsApplied: [...step.skillsApplied],
      tokenUsage: { ...step.tokenUsage }
    }))
  };
}

function migrateWorkflowState(state: WorkflowState): WorkflowState {
  const migrated = createWorkflow(state.task ?? null);
  const byId = new Map(state.steps.map((step) => [step.stepId, step] as const));

  for (const step of migrated.steps) {
    const existing = byId.get(step.stepId);
    if (!existing) {
      continue;
    }
    step.status = existing.status;
    step.input = existing.input;
    step.output = existing.output;
    step.validation = existing.validation;
    step.files = existing.files;
    step.skillsApplied = existing.skillsApplied;
    step.tokenUsage = existing.tokenUsage;
    step.updatedAt = existing.updatedAt;
  }

  migrated.status = state.status;
  migrated.currentStepId = state.currentStepId;
  migrated.timestamp = state.timestamp;
  return migrated;
}
