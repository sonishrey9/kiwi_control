import type { ExecutionMode, ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import type { GitState } from "./git.js";
import type { HandoffRecord, PhaseRecord } from "./state.js";
import { buildPhaseId } from "./state.js";
import { renderDisplayPath } from "../utils/fs.js";

export function buildHandoffRecord(options: {
  toTool: ToolName;
  currentPhase: PhaseRecord | null;
  context: CompiledContext;
  gitState: GitState;
}): HandoffRecord {
  const now = new Date().toISOString();
  const currentPhase = options.currentPhase;
  const validationsPending = currentPhase
    ? options.context.validationSteps.filter((step) => !currentPhase.validationsRun.includes(step))
    : options.context.validationSteps;
  const risksRemaining = [
    ...(currentPhase?.warnings ?? []),
    ...(currentPhase?.openIssues ?? []),
    ...options.context.conflicts.map((conflict) => conflict.message)
  ];
  const whatChanged = currentPhase?.changedFilesSummary?.changedFiles ?? options.gitState.changedFiles.slice(0, 12);

  return {
    version: 1,
    createdAt: now,
    toTool: options.toTool,
    ...(currentPhase?.phaseId ? { fromPhaseId: currentPhase.phaseId } : {}),
    ...(currentPhase?.tool ? { previousTool: currentPhase.tool } : {}),
    summary: currentPhase?.label ?? "No checkpoint is recorded yet.",
    goal: currentPhase?.goal ?? "Continue the current repo-local work safely.",
    profile: currentPhase?.profile ?? options.context.profileName,
    mode: (currentPhase?.mode ?? options.context.executionMode) as ExecutionMode,
    readFirst: [...new Set(options.context.authorityOrder.map((authorityPath) => renderDisplayPath(options.context.targetRoot, authorityPath)))],
    whatChanged,
    validationsPending,
    risksRemaining,
    nextStep: currentPhase?.nextRecommendedStep ?? `Continue with ${options.toTool} using the generated handoff brief.`,
    status: risksRemaining.length > 0 ? "blocked" : "ready"
  };
}

export function renderHandoffMarkdown(handoff: HandoffRecord): string {
  const lines = [
    `# Handoff To ${capitalize(handoff.toTool)}`,
    "",
    `Created: ${handoff.createdAt}`,
    "",
    "## Last Phase",
    "",
    `- summary: ${handoff.summary}`,
    `- goal: ${handoff.goal}`,
    `- profile: \`${handoff.profile}\``,
    `- mode: \`${handoff.mode}\``,
    ...(handoff.previousTool ? [`- previous tool: \`${handoff.previousTool}\``] : []),
    ...(handoff.fromPhaseId ? [`- phase id: \`${handoff.fromPhaseId}\``] : []),
    "",
    "## Promoted Canonical Docs",
    "",
    ...handoff.readFirst.slice(0, 3).map((item) => `- \`${item}\``),
    "",
    "## Read First",
    "",
    ...handoff.readFirst.map((item) => `- \`${item}\``),
    "",
    "## What Changed",
    "",
    ...(handoff.whatChanged.length > 0 ? handoff.whatChanged.map((item) => `- ${item}`) : ["- no changed file summary recorded"]),
    "",
    "## Validations Pending",
    "",
    ...(handoff.validationsPending.length > 0 ? handoff.validationsPending.map((item) => `- ${item}`) : ["- no pending validations recorded"]),
    "",
    "## Risks Remaining",
    "",
    ...(handoff.risksRemaining.length > 0 ? handoff.risksRemaining.map((item) => `- ${item}`) : ["- no known remaining risks"]),
    "",
    "## Next Step",
    "",
    `- ${handoff.nextStep}`
  ];

  return `${lines.join("\n")}\n`;
}

export function renderHandoffBrief(handoff: HandoffRecord): string {
  const lines = [
    `# Read This First For ${capitalize(handoff.toTool)}`,
    "",
    `Last phase: ${handoff.summary}`,
    `Goal: ${handoff.goal}`,
    `Next step: ${handoff.nextStep}`,
    "",
    "Promoted docs:",
    ...handoff.readFirst.slice(0, 3).map((item) => `- \`${item}\``),
    "",
    "Start with:",
    ...handoff.readFirst.slice(0, 5).map((item) => `- \`${item}\``)
  ];

  if (handoff.risksRemaining.length > 0) {
    lines.push("", "Open risks:", ...handoff.risksRemaining.slice(0, 5).map((item) => `- ${item}`));
  }

  return `${lines.join("\n")}\n`;
}

export function buildHandoffBaseName(handoff: HandoffRecord): string {
  const seed = handoff.fromPhaseId ?? buildPhaseId(`handoff-to-${handoff.toTool}`, handoff.createdAt);
  return `${seed}-to-${handoff.toTool}`;
}

function capitalize(input: string): string {
  return `${input.charAt(0).toUpperCase()}${input.slice(1)}`;
}
