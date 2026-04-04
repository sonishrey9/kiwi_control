import path from "node:path";
import type { NextAction } from "./next-action.js";
import type { WorkflowState } from "./workflow-engine.js";
import { PRODUCT_METADATA } from "./product.js";
import { writeText } from "../utils/fs.js";

export type ExecutionPlanStepStatus = "pending" | "running" | "completed" | "failed";

export interface ExecutionPlanStep {
  id: string;
  description: string;
  command: string;
  expectedOutput: string;
  validation: string;
  status: ExecutionPlanStepStatus;
}

export interface ExecutionPlanState {
  artifactType: "kiwi-control/execution-plan";
  version: 1;
  timestamp: string;
  task: string | null;
  blocked: boolean;
  summary: string;
  steps: ExecutionPlanStep[];
  nextCommands: string[];
}

export interface BuildExecutionPlanOptions {
  targetRoot: string;
  task: string | null;
  workflow: WorkflowState;
  nextAction: NextAction | null;
  validationErrors: number;
  hasPreparedScope: boolean;
  hasInstructions: boolean;
  hasTokenUsage: boolean;
  scopeViolation: boolean;
}

const PRIMARY = PRODUCT_METADATA.cli.primaryCommand;

export async function persistExecutionPlan(
  targetRoot: string,
  plan: ExecutionPlanState
): Promise<string> {
  const outputPath = path.join(targetRoot, ".agent", "state", "execution-plan.json");
  await writeText(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  return outputPath;
}

export function buildExecutionPlan(options: BuildExecutionPlanOptions): ExecutionPlanState {
  const task = options.task ?? "describe your task";
  const blocked = options.validationErrors > 0 || options.scopeViolation;
  const correctiveCommand = options.nextAction?.command ?? `${PRIMARY} status`;
  const correctiveReason = options.nextAction?.reason ?? "A corrective action is required before continuing.";

  const workflowPrepare = findWorkflowStep(options.workflow, "prepare-context");
  const workflowExecute = findWorkflowStep(options.workflow, "generate-run-packets");
  const workflowValidate = findWorkflowStep(options.workflow, "checkpoint-progress");

  const steps: ExecutionPlanStep[] = blocked
    ? [
        {
          id: "correct-repo",
          description: "Run the corrective command for the current failure.",
          command: correctiveCommand,
          expectedOutput: options.nextAction?.action ?? "Repo state is corrected.",
          validation: "Run `kiwi-control status` and confirm the corrective action is no longer the top priority.",
          status: options.nextAction ? mapNextActionPriority(options.nextAction.priority) : "running"
        },
        {
          id: "verify-correction",
          description: "Verify the repo is healthy and scope is valid.",
          command: `${PRIMARY} status --json`,
          expectedOutput: "Validation passes and the next step is no longer corrective.",
          validation: "The repo should show no blocking validation issue or prepared-scope drift.",
          status: "pending"
        }
      ]
    : [
        {
          id: "prepare-task",
          description: "Prepare the bounded task scope.",
          command: `${PRIMARY} prepare "${task}"`,
          expectedOutput: "Prepared scope, instructions, and token state are written.",
          validation: "Check that context and scope exist and no corrective action is shown.",
          status: options.hasPreparedScope && options.hasInstructions && options.hasTokenUsage ? "completed" : "pending"
        },
        {
          id: "verify-context",
          description: "Verify context and scope before execution.",
          command: `${PRIMARY} status --json`,
          expectedOutput: "Repo state is healthy and prepared scope is active.",
          validation: "The next action should not be a corrective validation or scope-refresh command.",
          status: options.hasPreparedScope && !options.scopeViolation && options.validationErrors === 0 ? "completed" : "pending"
        },
        {
          id: "execute-task",
          description: "Generate and execute the repo-local run packet.",
          command: `${PRIMARY} run "${task}"`,
          expectedOutput: "Task packets are generated for the active tool flow.",
          validation: "Workflow step `generate-run-packets` completes and the next suggested command becomes checkpoint.",
          status: mapWorkflowStatus(workflowExecute?.status, options.workflow.currentStepId === "generate-run-packets")
        },
        {
          id: "validate-output",
          description: "Record progress and validate the output.",
          command: `${PRIMARY} checkpoint "<milestone>"`,
          expectedOutput: "Checkpoint artifacts are written and continuity is updated.",
          validation: "Workflow step `checkpoint-progress` completes without a failure reason.",
          status: mapWorkflowStatus(workflowValidate?.status, options.workflow.currentStepId === "checkpoint-progress")
        },
        {
          id: "if-failure-correct",
          description: "If a validation or scope failure happens, run the corrective command instead of continuing.",
          command: correctiveCommand,
          expectedOutput: correctiveReason,
          validation: "Do not continue until the corrective command is no longer the top next action.",
          status: "pending"
        }
      ];

  const nextCommands = steps
    .filter((step) => step.status === "pending" || step.status === "running" || step.status === "failed")
    .map((step) => step.command)
    .filter((command, index, all) => all.indexOf(command) === index)
    .slice(0, 3);

  return {
    artifactType: "kiwi-control/execution-plan",
    version: 1,
    timestamp: new Date().toISOString(),
    task: options.task,
    blocked,
    summary: blocked
      ? `Corrective action required first: ${correctiveReason}`
      : `Execute the bounded task flow for "${task}" in order and validate after each command.`,
    steps,
    nextCommands
  };
}

function findWorkflowStep(workflow: WorkflowState, stepId: string) {
  return workflow.steps.find((step) => step.stepId === stepId) ?? null;
}

function mapWorkflowStatus(
  status: WorkflowState["steps"][number]["status"] | undefined,
  isCurrent: boolean
): ExecutionPlanStepStatus {
  if (!status) {
    return "pending";
  }
  if (status === "success") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  return isCurrent ? "running" : "pending";
}

function mapNextActionPriority(priority: NextAction["priority"]): ExecutionPlanStepStatus {
  return priority === "critical" || priority === "high" ? "running" : "pending";
}
