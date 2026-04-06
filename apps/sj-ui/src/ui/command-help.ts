import type {
  BlockedWorkflowEntry,
  ExplainCommandEntry,
  ExplainSelectionEntry,
  RecoveryGuidance,
  RepoControlMode,
  TerminalHelpEntry
} from "./contracts.js";

const REPO_SCOPED_CLI_COMMANDS = new Set([
  "plan",
  "next",
  "retry",
  "resume",
  "guide",
  "prepare",
  "validate",
  "explain",
  "trace",
  "doctor",
  "eval",
  "init",
  "status",
  "check",
  "sync",
  "checkpoint",
  "handoff",
  "run",
  "ui",
  "dispatch",
  "fanout",
  "collect",
  "reconcile",
  "push-check"
]);

export function formatCliCommand(command: string | null | undefined, targetRoot?: string | null): string {
  const raw = command?.trim();
  if (!raw) {
    return "";
  }
  const tokens = tokenizeCommand(raw);
  if (tokens.length === 0) {
    return raw;
  }

  const [binary = "", subcommand = ""] = tokens;
  if (!["kiwi-control", "kc", "shrey-junior", "sj"].includes(binary)) {
    return raw;
  }

  const normalizedTokens = ["kc", ...tokens.slice(1)];
  if (!targetRoot || targetRoot.trim().length === 0 || !REPO_SCOPED_CLI_COMMANDS.has(subcommand) || tokens.includes("--target")) {
    return normalizedTokens.map(shellQuoteCommandToken).join(" ");
  }

  return [...normalizedTokens, "--target", targetRoot].map(shellQuoteCommandToken).join(" ");
}

export function buildTerminalHelpEntries(params: {
  targetRoot: string;
  repoMode: RepoControlMode;
}): TerminalHelpEntry[] {
  const repoRepairCommand = params.repoMode === "repo-not-initialized"
    ? "kc init"
    : "kc sync --dry-run --diff-summary";

  return [
    {
      command: "kc help",
      label: "Full CLI help",
      detail: "Show the full Kiwi Control command surface and examples."
    },
    {
      command: formatCliCommand("kc guide", params.targetRoot),
      label: "Guide this repo",
      detail: "Show the current goal, step, and next recommended action for the loaded repo."
    },
    {
      command: formatCliCommand("kc status", params.targetRoot),
      label: "Inspect repo state",
      detail: "See repo health, next actions, and continuity state."
    },
    {
      command: formatCliCommand(repoRepairCommand, params.targetRoot),
      label: params.repoMode === "repo-not-initialized" ? "Initialize repo control" : "Preview repo repair",
      detail: params.repoMode === "repo-not-initialized"
        ? "Set up the repo-local continuity files Kiwi needs."
        : "Preview repo-local contract writes before applying sync."
    },
    {
      command: formatCliCommand("kc validate", params.targetRoot),
      label: "Validate repo contract",
      detail: "Check repo-local validation state before checkpoint, handoff, or execution."
    },
    {
      command: formatCliCommand("kc ui", params.targetRoot),
      label: "Reopen desktop",
      detail: "Open this exact repo in Kiwi Control again from Terminal."
    }
  ];
}

export function buildExplainSelectionEntries(entries: Array<{
  file: string;
  reasons: string[];
  selectionWhy?: string;
  dependencyChain?: string[];
}>): ExplainSelectionEntry[] {
  return entries.slice(0, 6).map((entry) => ({
    title: entry.file,
    metric: entry.dependencyChain && entry.dependencyChain.length > 1 ? "selected · chained" : "selected",
    note: [
      entry.selectionWhy ?? entry.reasons.join(", "),
      entry.dependencyChain && entry.dependencyChain.length > 1 ? `chain: ${entry.dependencyChain.join(" -> ")}` : null
    ].filter(Boolean).join(" · ")
  }));
}

export function buildExplainCommandEntries(params: {
  targetRoot: string;
  recoveryGuidance: RecoveryGuidance | null;
  executionPlan: {
    lastError: { reason: string; fixCommand: string; retryCommand: string } | null;
    nextCommands: string[];
  };
}): ExplainCommandEntry[] {
  return [
    params.recoveryGuidance?.nextCommand
      ? {
          command: formatCliCommand(params.recoveryGuidance.nextCommand, params.targetRoot),
          label: params.recoveryGuidance.title,
          detail: params.recoveryGuidance.detail
        }
      : null,
    params.executionPlan.lastError?.fixCommand
      ? {
          command: formatCliCommand(params.executionPlan.lastError.fixCommand, params.targetRoot),
          label: "Fix the blocking issue",
          detail: params.executionPlan.lastError.reason
        }
      : null,
    params.executionPlan.lastError?.retryCommand
      ? {
          command: formatCliCommand(params.executionPlan.lastError.retryCommand, params.targetRoot),
          label: "Then retry",
          detail: "Use this after the blocking issue is cleared."
        }
      : null,
    ...params.executionPlan.nextCommands.slice(0, 3).map((command, index) => ({
      command: formatCliCommand(command, params.targetRoot),
      label: index === 0 ? "Next planned command" : `Next planned command ${index + 1}`,
      detail: "Derived from the current execution plan without running another CLI command."
    }))
  ]
    .filter((entry): entry is ExplainCommandEntry => Boolean(entry))
    .filter((entry, index, items) => items.findIndex((candidate) => candidate.command === entry.command) === index);
}

export function buildBlockedWorkflowEntries(params: {
  targetRoot: string;
  recoveryGuidance: RecoveryGuidance | null;
  executionPlan: {
    blocked: boolean;
    currentStepIndex: number;
    steps: Array<{ id: string; command: string; validation: string; status: string }>;
    lastError: { reason: string; fixCommand: string; retryCommand: string } | null;
    nextCommands: string[];
  };
}): BlockedWorkflowEntry[] {
  if (!params.executionPlan.blocked && params.recoveryGuidance?.tone !== "blocked") {
    return [];
  }

  const entries: BlockedWorkflowEntry[] = [];
  const seen = new Set<string>();
  const failedStep =
    params.executionPlan.steps.find((step) => step.status === "failed")
    ?? params.executionPlan.steps[params.executionPlan.currentStepIndex]
    ?? null;

  const pushEntry = (title: string, command: string | null | undefined, detail: string) => {
    const formatted = formatCliCommand(command, params.targetRoot);
    if (!formatted || seen.has(formatted)) {
      return;
    }
    seen.add(formatted);
    entries.push({ title, command: formatted, detail });
  };

  pushEntry(
    "Inspect the blocker",
    params.executionPlan.lastError?.fixCommand ?? params.recoveryGuidance?.nextCommand,
    params.executionPlan.lastError?.reason ?? params.recoveryGuidance?.detail ?? "Review the current workflow blocker before changing repo-local state."
  );

  if (failedStep) {
    pushEntry(
      failedStep.status === "failed" ? `Re-run ${failedStep.id}` : `Run ${failedStep.id}`,
      failedStep.command,
      failedStep.validation || "Run the blocked workflow step again after reviewing the blocker."
    );
  }

  pushEntry(
    "Then retry",
    params.executionPlan.lastError?.retryCommand,
    "Use this after the blocking issue is cleared."
  );

  for (const [index, command] of params.executionPlan.nextCommands.entries()) {
    pushEntry(
      index === 0 ? "Continue with the next planned step" : `Continue with planned step ${index + 1}`,
      command,
      "Resume the remaining workflow once the blocker is resolved."
    );
  }

  return entries.slice(0, 4);
}

function tokenizeCommand(value: string): string[] {
  const tokens = [...value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)];
  return tokens.map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").filter(Boolean);
}

function shellQuoteCommandToken(token: string): string {
  return /^[A-Za-z0-9_./:@%+=,-]+$/.test(token)
    ? token
    : `"${token.replace(/(["\\$`])/g, "\\$1")}"`;
}
