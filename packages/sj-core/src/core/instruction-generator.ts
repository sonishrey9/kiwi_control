import path from "node:path";
import type { ContextSelection, ContextConfidence } from "./context-selector.js";
import { taskNeedsExternalVerification } from "./task-intent.js";
import { writeText } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GeneratedInstructions {
  goal: string;
  allowedFiles: string[];
  forbiddenPatterns: string[];
  steps: string[];
  constraints: string[];
  stopConditions: string[];
  validationSteps: string[];
  confidence: ContextConfidence;
  confidenceNote: string;
  raw: string;
}

// ---------------------------------------------------------------------------
// Constraints — mandatory rules for every AI tool
// ---------------------------------------------------------------------------

const CORE_CONSTRAINTS = [
  "Minimal edits only — change only what the goal requires.",
  "No full repository scanning — use only the allowed files listed above.",
  "No refactoring unless the goal explicitly requires it.",
  "Prefer repo-local context first. Verify external behavior when the task depends on APIs, SDKs, or unknown contracts.",
  "No over-explaining — keep responses focused on the goal.",
  "Do not create files unless the goal requires new functionality.",
  "Modify tests when behavior or contracts change.",
  "Read each file before editing — never write blind."
];

const VALIDATION_STEPS_DEFAULT = [
  "Run the project build and verify it succeeds.",
  "Run affected tests and verify they pass.",
  "Check for type errors (tsc --noEmit or equivalent).",
  "Review the diff for scope creep — revert unrelated changes."
];

const STOP_CONDITIONS_DEFAULT = [
  "STOP if you find yourself editing more than 5 files not in the allowed list.",
  "STOP if you are about to add a new dependency not already in the project.",
  "STOP if you are about to delete or rename a public API without explicit approval.",
  "STOP if a test suite begins failing and the fix is non-obvious.",
  "STOP if you discover the task requires architectural changes beyond the stated goal."
];

// ---------------------------------------------------------------------------
// Generator entry point
// ---------------------------------------------------------------------------

export function generateInstructions(
  task: string,
  selection: ContextSelection
): GeneratedInstructions {
  const confidence: ContextConfidence = selection.confidence ?? "medium";
  const confidenceNote = describeConfidence(selection, confidence);
  const steps = deriveSteps(task, selection, confidence);
  const constraints = deriveConstraints(task, confidence);
  const validationSteps = deriveValidationSteps(task, selection);
  const stopConditions = [...STOP_CONDITIONS_DEFAULT];

  const forbiddenPatterns = [
    ...selection.exclude,
    "**/.env*",
    "**/secrets/**",
    "**/credentials/**"
  ];

  const raw = renderInstructionDocument({
    goal: task,
    confidence,
    confidenceNote,
    allowedFiles: selection.include,
    forbiddenPatterns,
    steps,
    constraints,
    validationSteps,
    stopConditions
  });

  return {
    goal: task,
    allowedFiles: selection.include,
    forbiddenPatterns,
    steps,
    constraints,
    stopConditions,
    validationSteps,
    confidence,
    confidenceNote,
    raw
  };
}

// ---------------------------------------------------------------------------
// Step derivation — confidence-aware, read-first
// ---------------------------------------------------------------------------

function deriveSteps(
  task: string,
  selection: ContextSelection,
  confidence: ContextConfidence
): string[] {
  const steps: string[] = [];
  const { signals } = selection;

  // Low confidence: verify file relevance before diving in
  if (confidence === "low") {
    steps.push(
      "ORIENTATION: Context confidence is low. Before editing, scan the allowed files and confirm they are relevant to the goal. If key files are missing, note them and proceed with caution."
    );
  }

  if (confidence === "medium") {
    steps.push(
      "ORIENTATION: Context confidence is medium. Treat the selected files as likely relevant, but refresh context if a missing dependency appears."
    );
  }

  // Read-first guidance — always read before editing
  if (signals.changedFiles.length > 0) {
    steps.push(
      `READ first — review the changed files: ${signals.changedFiles.slice(0, 5).join(", ")}${signals.changedFiles.length > 5 ? ` (+${signals.changedFiles.length - 5} more)` : ""}`
    );
  } else if (selection.include.length > 0) {
    steps.push(
      `READ first — review the top selected files: ${selection.include.slice(0, 3).join(", ")}`
    );
  }

  // Import neighbors — understand dependencies
  if (signals.importNeighbors.length > 0) {
    steps.push(
      `Review import dependencies for context: ${signals.importNeighbors.slice(0, 5).join(", ")}`
    );
  }

  // Keyword matches — check relevance
  if (signals.keywordMatches && signals.keywordMatches.length > 0) {
    const extraKeywordFiles = signals.keywordMatches
      .filter((f) => !signals.changedFiles.includes(f))
      .slice(0, 3);
    if (extraKeywordFiles.length > 0) {
      steps.push(
        `Check keyword-matched files for additional context: ${extraKeywordFiles.join(", ")}`
      );
    }
  }

  // Core implementation step
  steps.push(`Implement the goal: ${task}`);

  if (taskNeedsExternalVerification(task)) {
    steps.push("Verify external API, SDK, or contract behavior before relying on it in the change.");
  }

  // Test guidance
  const hasTestFiles = signals.changedFiles.some(
    (f) => f.endsWith(".test.ts") || f.endsWith(".test.js") || f.endsWith("_test.py") || f.endsWith("_test.go") || f.includes("__tests__")
  );
  if (hasTestFiles) {
    steps.push("Run affected tests to verify the change.");
  } else {
    steps.push("Run existing tests to verify no regressions.");
  }

  // Final diff review
  steps.push("Review the diff for minimal scope — remove any unrelated changes.");

  return steps;
}

// ---------------------------------------------------------------------------
// Constraint derivation — confidence-aware
// ---------------------------------------------------------------------------

function deriveConstraints(task: string, confidence: ContextConfidence): string[] {
  const constraints = [...CORE_CONSTRAINTS];

  if (taskNeedsExternalVerification(task)) {
    constraints.push(
      "External verification is allowed for this task because it touches APIs, SDKs, or unknown runtime behavior."
    );
  }

  if (confidence === "low") {
    constraints.push(
      "Context confidence is LOW — evidence is narrow or partial. Double-check that each file you edit is actually relevant before making changes."
    );
  }

  if (confidence === "medium") {
    constraints.push(
      "Context confidence is MEDIUM — the selected files are likely relevant, but coverage is still partial. Refresh context before widening scope."
    );
  }

  if (confidence === "high") {
    constraints.push(
      "Context confidence is HIGH — multiple repo-local signals agree on these files, but do not assume full coverage beyond the allowed set."
    );
  }

  return constraints;
}

// ---------------------------------------------------------------------------
// Validation step derivation
// ---------------------------------------------------------------------------

function deriveValidationSteps(task: string, selection: ContextSelection): string[] {
  const steps = [...VALIDATION_STEPS_DEFAULT];

  const hasTypeScript = selection.include.some(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  );
  const hasPython = selection.include.some((f) => f.endsWith(".py"));
  const hasRust = selection.include.some((f) => f.endsWith(".rs"));

  if (hasTypeScript) {
    steps.push("Verify TypeScript strict mode passes (no implicit any, no unused vars).");
  }
  if (hasPython) {
    steps.push("Run linter (ruff/flake8) and type checker (mypy/pyright) if configured.");
  }
  if (hasRust) {
    steps.push("Run cargo check and cargo clippy.");
  }
  if (taskNeedsExternalVerification(task)) {
    steps.push("Verify any external API, SDK, or runtime assumptions against source documentation or observed behavior.");
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Markdown renderer — pasteable format for Claude/Codex/Copilot
// ---------------------------------------------------------------------------

function renderInstructionDocument(instructions: {
  goal: string;
  confidence: ContextConfidence;
  confidenceNote: string;
  allowedFiles: string[];
  forbiddenPatterns: string[];
  steps: string[];
  constraints: string[];
  validationSteps: string[];
  stopConditions: string[];
}): string {
  const lines: string[] = [
    "# AI Task Instructions",
    "",
    "> Generated by Kiwi Control. Paste into Claude Code, Codex, or Copilot as system context.",
    "> Context confidence: **" + instructions.confidence.toUpperCase() + "** — " + instructions.confidenceNote,
    "",
    "## GOAL",
    "",
    instructions.goal,
    "",
    "## ALLOWED FILES",
    "",
    ...instructions.allowedFiles.map((f) => `- \`${f}\``),
    ...(instructions.allowedFiles.length === 0
      ? ["- _(no specific files selected — task may require broader exploration)_"]
      : []),
    "",
    "## FORBIDDEN FILES",
    "",
    ...instructions.forbiddenPatterns.slice(0, 20).map((f) => `- \`${f}\``),
    ...(instructions.forbiddenPatterns.length > 20
      ? [`- _...and ${instructions.forbiddenPatterns.length - 20} more patterns_`]
      : []),
    "",
    "## STEPS",
    "",
    ...instructions.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## CONSTRAINTS",
    "",
    ...instructions.constraints.map((c) => `- ${c}`),
    "",
    "## VALIDATION",
    "",
    "Before marking the task complete, verify:",
    "",
    ...instructions.validationSteps.map((v) => `- [ ] ${v}`),
    "",
    "## STOP CONDITIONS",
    "",
    "Halt and ask the user if any of these trigger:",
    "",
    ...instructions.stopConditions.map((s) => `- ${s}`),
    ""
  ];

  return lines.join("\n");
}

function describeConfidence(selection: ContextSelection, confidence: ContextConfidence): string {
  const maxDepthExplored = selection.signals.discovery?.maxDepthExplored ?? 0;
  const budgetLimited = Boolean(
    selection.signals.discovery?.fileBudgetReached || selection.signals.discovery?.directoryBudgetReached
  );

  if (confidence === "high") {
    return "multiple repo-local signals agree and current coverage looks healthy";
  }

  if (confidence === "medium") {
    if (budgetLimited) {
      return "useful evidence was found, but discovery hit a budget limit";
    }
    if (maxDepthExplored >= 4) {
      return "useful evidence was found across the repo, but coverage is still partial";
    }
    return "useful evidence was found, but the file set should still be treated as partial";
  }

  if (budgetLimited) {
    return "evidence is narrow and discovery hit a budget limit";
  }

  if (maxDepthExplored < 4) {
    return "evidence is narrow and repo coverage is still limited";
  }

  return "evidence is narrow or partial, so verify file relevance before editing";
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function persistInstructions(
  targetRoot: string,
  instructions: GeneratedInstructions
): Promise<string> {
  const outputPath = path.join(
    targetRoot,
    ".agent",
    "context",
    "generated-instructions.md"
  );
  await writeText(outputPath, instructions.raw);
  return outputPath;
}
