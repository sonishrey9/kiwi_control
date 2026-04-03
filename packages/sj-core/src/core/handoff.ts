import type { ExecutionMode, ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import { buildChecksToRun, buildFirstReadContract, buildSearchGuidance, buildStopConditions, buildWriteTargets } from "./guidance.js";
import type { GitState } from "./git.js";
import { PRODUCT_METADATA } from "./product.js";
import type { ActiveRoleHintsRecord, CheckpointRecord, HandoffRecord, PhaseRecord } from "./state.js";
import { buildPhaseId } from "./state.js";

export function buildHandoffRecord(options: {
  toTool: ToolName;
  currentPhase: PhaseRecord | null;
  context: CompiledContext;
  gitState: GitState;
  activeRoleHints?: ActiveRoleHintsRecord | null;
  latestCheckpoint?: CheckpointRecord | null;
  recommendedSpecialistId: string;
  recommendedMcpPack: string;
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
  const fromRole = options.activeRoleHints?.activeRole ?? currentPhase?.nextRecommendedSpecialist ?? "architecture-specialist";
  const toRole = options.recommendedSpecialistId;
  const recommendedMcpPack = options.recommendedMcpPack;
  const checkpointPointer = options.latestCheckpoint ? ".agent/state/checkpoints/latest.json" : null;
  const nextCommand = currentPhase?.nextRecommendedStep
    ? `${PRODUCT_METADATA.cli.primaryCommand} status --target "${options.context.targetRoot}"`
    : `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "<milestone>" --target "${options.context.targetRoot}"`;
  const nextFile = options.activeRoleHints?.nextFileToRead ?? ".agent/state/active-role-hints.json";

  return {
    artifactType: "shrey-junior/handoff",
    version: 2,
    createdAt: now,
    toTool: options.toTool,
    fromRole,
    toRole,
    taskId: currentPhase?.phaseId ?? buildPhaseId(`handoff-to-${options.toTool}`, now),
    ...(currentPhase?.phaseId ? { fromPhaseId: currentPhase.phaseId } : {}),
    ...(currentPhase?.tool ? { previousTool: currentPhase.tool } : {}),
    summary: currentPhase?.label ?? "No checkpoint is recorded yet.",
    goal: currentPhase?.goal ?? "Continue the current repo-local work safely.",
    profile: currentPhase?.profile ?? options.context.profileName,
    mode: (currentPhase?.mode ?? options.context.executionMode) as ExecutionMode,
    workCompleted: whatChanged.length > 0 ? whatChanged : ["No changed-file summary recorded yet."],
    filesTouched: whatChanged,
    checksRun: currentPhase?.validationsRun ?? [],
    checksPassed: currentPhase?.validationsRun ?? [],
    checksFailed: [],
    evidence: [
      ...(checkpointPointer ? [checkpointPointer] : []),
      ...(options.activeRoleHints?.latestTaskPacket ? [options.activeRoleHints.latestTaskPacket] : []),
      ...(options.activeRoleHints?.latestReconcile ? [options.activeRoleHints.latestReconcile] : []),
      ...(options.activeRoleHints?.latestDispatchManifest ? [options.activeRoleHints.latestDispatchManifest] : [])
    ],
    openQuestions: validationsPending,
    risks: risksRemaining,
    nextFile,
    nextCommand,
    recommendedMcpPack,
    checkpointPointer,
    readFirst: buildFirstReadContract({
      targetRoot: options.context.targetRoot,
      authorityOrder: options.context.authorityOrder,
      promotedAuthorityDocs: options.context.promotedAuthorityDocs,
      contract: {
        instructionSurfaces: options.context.stableContracts.filter((item) => item.includes(".github/instructions/")),
        agentSurfaces: [".github/agents/shrey-junior.md"],
        roleSurfaces: [],
        activeRole: "handoff",
        supportingRoles: []
      }
    }),
    writeTargets: buildWriteTargets(
      {
        instructionSurfaces: [],
        agentSurfaces: [],
        roleSurfaces: [],
        activeRole: "handoff",
        supportingRoles: []
      },
      whatChanged.length > 0 ? whatChanged.slice(0, 8) : ["only goal-relevant repo files and continuity artifacts"]
    ),
    checksToRun: buildChecksToRun(options.context.validationSteps),
    stopConditions: buildStopConditions({
      riskLevel: currentPhase?.routingSummary.riskLevel ?? options.context.riskLevel,
      taskType: currentPhase?.routingSummary.taskType ?? options.context.taskType
    }),
    searchGuidance: buildSearchGuidance({
      taskType: currentPhase?.routingSummary.taskType ?? options.context.taskType,
      fileArea: currentPhase?.routingSummary.fileArea ?? options.context.fileArea
    }),
    whatChanged,
    validationsPending,
    risksRemaining,
    ...(options.latestCheckpoint
      ? {
          latestCheckpoint: ".agent/state/checkpoints/latest.json",
          checkpointSummary: options.latestCheckpoint.summary
        }
      : {}),
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
    "## Priority Reads",
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
    "## Handoff Routing",
    "",
    `- from role: \`${handoff.fromRole}\``,
    `- to role: \`${handoff.toRole}\``,
    `- task id: \`${handoff.taskId}\``,
    `- next file: \`${handoff.nextFile}\``,
    `- next command: ${handoff.nextCommand}`,
    `- recommended MCP pack: \`${handoff.recommendedMcpPack}\``,
    ...(handoff.latestCheckpoint
      ? [
          "",
          "## Latest Checkpoint",
          "",
          `- pointer: \`${handoff.latestCheckpoint}\``,
          ...(handoff.checkpointSummary ? [`- summary: ${handoff.checkpointSummary}`] : [])
        ]
      : []),
    "",
    "## Write Targets",
    "",
    ...handoff.writeTargets.map((item) => `- ${item}`),
    "",
    "## Checks To Run",
    "",
    ...handoff.checksToRun.map((item) => `- ${item}`),
    "",
    "## Validations Pending",
    "",
    ...(handoff.validationsPending.length > 0 ? handoff.validationsPending.map((item) => `- ${item}`) : ["- no pending validations recorded"]),
    "",
    "## Stop Conditions",
    "",
    ...handoff.stopConditions.map((item) => `- ${item}`),
    "",
    "## External Lookup Rules",
    "",
    "- inspect the repo codebase first before external search",
    "- prefer promoted repo docs or canonical linked docs before internet search",
    ...handoff.searchGuidance.useExternalLookupWhen.map((item) => `- use external lookup when: ${item}`),
    ...handoff.searchGuidance.avoidExternalLookupWhen.map((item) => `- avoid external lookup when: ${item}`),
    "",
    "## Risks Remaining",
    "",
    ...(handoff.risksRemaining.length > 0 ? handoff.risksRemaining.map((item) => `- ${item}`) : ["- no known remaining risks"]),
    "",
    "## Open Questions",
    "",
    ...(handoff.openQuestions.length > 0 ? handoff.openQuestions.map((item) => `- ${item}`) : ["- none recorded"]),
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
    `Next role: ${handoff.toRole}`,
    `Next command: ${handoff.nextCommand}`,
    "",
    "Priority reads:",
    ...handoff.readFirst.slice(0, 3).map((item) => `- \`${item}\``),
    "",
    "Start with:",
    ...handoff.readFirst.slice(0, 5).map((item) => `- \`${item}\``)
  ];

  if (handoff.checksToRun.length > 0) {
    lines.push("", "Checks to run next:", ...handoff.checksToRun.slice(0, 4).map((item) => `- ${item}`));
  }

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
