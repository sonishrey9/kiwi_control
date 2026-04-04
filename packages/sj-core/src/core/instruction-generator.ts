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
      "Context confidence is LOW — double-check that each file you edit is actually relevant to the goal before making changes."
    );
  }

  if (confidence === "high") {
    constraints.push(
      "Context confidence is HIGH — the selected files are strongly correlated with the task. Stay within them."
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
    "> Context confidence: **" + instructions.confidence.toUpperCase() + "**",
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
