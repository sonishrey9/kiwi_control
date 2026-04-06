import type { ExecutionPlanState } from "@shrey-junior/sj-core/core/execution-plan.js";

export interface PlanRecoveryWorkflowEntry {
  title: string;
  command: string;
  detail: string;
}

export function selectPrimaryPlanCommand(
  plan: Pick<ExecutionPlanState, "lastError" | "nextCommands">,
  fallback: string
): string {
  return plan.lastError?.fixCommand ?? plan.nextCommands[0] ?? fallback;
}

export function buildPlanRecoveryWorkflow(
  plan: Pick<ExecutionPlanState, "blocked" | "currentStepIndex" | "steps" | "lastError" | "nextCommands">
): PlanRecoveryWorkflowEntry[] {
  if (!plan.blocked && !plan.lastError) {
    return [];
  }

  const entries: PlanRecoveryWorkflowEntry[] = [];
  const seen = new Set<string>();
  const failedStep = plan.steps.find((step) => step.status === "failed") ?? plan.steps[plan.currentStepIndex] ?? null;

  const pushEntry = (title: string, command: string | null | undefined, detail: string) => {
    const normalized = command?.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    entries.push({ title, command: normalized, detail });
  };

  pushEntry(
    describeRecoveryTitle(plan.lastError?.fixCommand),
    plan.lastError?.fixCommand,
    plan.lastError?.reason ?? "Inspect the current workflow blocker before continuing."
  );

  if (failedStep) {
    pushEntry(
      failedStep.status === "failed" ? `Re-run ${failedStep.id}` : `Run ${failedStep.id}`,
      failedStep.command,
      failedStep.validation
    );
  }

  pushEntry(
    "Then retry",
    plan.lastError?.retryCommand,
    "Use this after the blocking issue is cleared."
  );

  for (const [index, command] of plan.nextCommands.entries()) {
    pushEntry(
      index === 0 ? "Next planned command" : `Next planned command ${index + 1}`,
      command,
      "Continue the execution plan after the blocker is resolved."
    );
  }

  return entries;
}

function describeRecoveryTitle(command: string | undefined): string {
  if (!command) {
    return "Inspect the blocker";
  }
  if (/\bprepare\b/i.test(command)) {
    return "Refresh the prepared scope";
  }
  if (/\bdoctor\b/i.test(command)) {
    return "Check the environment";
  }
  if (/\bexplain\b/i.test(command)) {
    return "Inspect the blocker";
  }
  return "Fix the blocking issue";
}
