import type { ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import { buildChecksToRun, buildFirstReadContract, buildSearchGuidance, buildStopConditions, buildWriteTargets } from "./guidance.js";
import type { RoutingDecision } from "./router.js";
import type { SpecialistSelection } from "./specialists.js";
import type { ContinuitySnapshot } from "./state.js";
import { renderDisplayPath } from "../utils/fs.js";

export interface RenderPacketOptions {
  title: string;
  goal: string;
  packetType: string;
  prompt: string;
  nativeSurface?: string;
  routedTool?: ToolName;
  decision: RoutingDecision;
  context: CompiledContext;
  supportingRole: string;
  specialist?: SpecialistSelection;
  continuity?: ContinuitySnapshot;
}

export function renderTaskPacket(options: RenderPacketOptions): string {
  const roleSpecPaths = options.specialist
    ? [
        ".agent/templates/role-result.md",
        `.agent/roles/${options.specialist.specialistId}.md`,
        `.github/agents/${options.specialist.specialistId}.md`
      ]
    : [".agent/templates/role-result.md"];

  const instructionSurfaces = options.context.stableContracts.filter((item) => item.includes(".github/instructions/"));
  const readFirst = buildFirstReadContract({
    targetRoot: options.context.targetRoot,
    authorityOrder: options.context.authorityOrder,
    promotedAuthorityDocs: options.context.promotedAuthorityDocs,
    contract: {
      instructionSurfaces,
      agentSurfaces: roleSpecPaths.filter((item) => item.startsWith(".github/agents/")),
      roleSurfaces: roleSpecPaths.filter((item) => item.startsWith(".agent/")),
      activeRole: options.specialist?.specialistId ?? options.supportingRole,
      supportingRoles: []
    }
  });
  const checksToRun = buildChecksToRun(options.context.validationSteps);
  const stopConditions = buildStopConditions({
    riskLevel: options.decision.riskLevel,
    taskType: options.decision.taskType
  });
  const searchGuidance = buildSearchGuidance({
    taskType: options.decision.taskType,
    fileArea: options.decision.fileArea
  });
  const writeTargets = buildPacketWriteTargets(options);

  const frontmatter = [
    "---",
    "schema: shrey-junior/task-packet@v1",
    `packet_type: ${options.packetType}`,
    `title: ${escapeYaml(options.title)}`,
    `goal: ${escapeYaml(options.goal)}`,
    `profile: ${options.context.profileName}`,
    `execution_mode: ${options.decision.executionMode}`,
    `task_type: ${options.decision.taskType}`,
    `primary_tool: ${options.decision.primaryTool}`,
    `review_tool: ${options.decision.reviewTool}`,
    `supporting_role: ${escapeYaml(options.supportingRole)}`,
    ...(options.nativeSurface ? [`native_surface: ${options.nativeSurface}`] : []),
    ...(options.specialist ? [`specialist: ${options.specialist.specialistId}`] : []),
    ...renderYamlList("read_first", readFirst),
    ...renderYamlList("write_targets", writeTargets),
    ...renderYamlList("checks_to_run", checksToRun),
    ...renderYamlList("stop_conditions", stopConditions),
    "external_lookup:",
    "  inspect_codebase_first: true",
    "  repo_docs_first: true",
    ...renderYamlList("use_external_lookup_when", searchGuidance.useExternalLookupWhen, 1),
    ...renderYamlList("avoid_external_lookup_when", searchGuidance.avoidExternalLookupWhen, 1),
    "---",
    ""
  ];

  const lines = [
    `# ${options.title}`,
    "",
    `Objective: ${options.goal}`,
    "",
    "## Read This First",
    "",
    ...readFirst.map((item) => `- \`${item}\``),
    "",
    "## Exact Write Targets",
    "",
    ...writeTargets.map((item) => `- ${item}`),
    "",
    "## Exact Checks To Run",
    "",
    ...checksToRun.map((item) => `- ${item}`),
    "",
    "## Stop Conditions",
    "",
    ...stopConditions.map((item) => `- ${item}`),
    "",
    "## External Lookup Rules",
    "",
    "- inspect the repo codebase first before external search",
    "- prefer promoted repo docs or linked canonical docs before internet search",
    ...searchGuidance.useExternalLookupWhen.map((item) => `- use external lookup when: ${item}`),
    ...searchGuidance.avoidExternalLookupWhen.map((item) => `- avoid external lookup when: ${item}`),
    "",
    "## Routing",
    "",
    `- task type: \`${options.decision.taskType}\``,
    `- primary tool: \`${options.decision.primaryTool}\``,
    `- review tool: \`${options.decision.reviewTool}\``,
    `- execution mode: \`${options.decision.executionMode}\``,
    `- risk: \`${options.decision.riskLevel}\``,
    `- file area: \`${options.decision.fileArea}\``,
    `- change size: \`${options.decision.changeSize}\``,
    `- packet role: ${options.supportingRole}`,
    ...(options.specialist
      ? [
          `- specialist: \`${options.specialist.specialistId}\` (${options.specialist.source})`
        ]
      : []),
    "",
    "## Repo Context",
    "",
    options.context.repoContextSummary,
    "",
    "## Role References",
    "",
    ...roleSpecPaths.map((item) => `- \`${item}\``),
    ...(options.specialist
      ? [
          "",
          "## Specialist Guidance",
          "",
          `- name: ${options.specialist.specialist.name}`,
          `- purpose: ${options.specialist.specialist.purpose}`,
          `- risk posture: \`${options.specialist.specialist.risk_posture}\``,
          `- preferred tools: ${options.specialist.specialist.preferred_tools.join(", ")}`,
          `- validation expectations: ${options.specialist.specialist.validation_expectations.join("; ")}`,
          `- result schema expectations: ${options.specialist.specialist.result_schema_expectations.join(", ")}`,
          `- handoff guidance: ${options.specialist.specialist.handoff_guidance.join("; ")}`
        ]
      : []),
    ...renderRelevantFilesSection(options),
    "",
    "## Allowed Scope",
    "",
    ...options.context.allowedScope.map((item) => `- ${item}`),
    "",
    "## Forbidden Scope",
    "",
    ...options.context.forbiddenScope.map((item) => `- ${item}`),
    "## Completion Criteria",
    "",
    ...options.context.completionCriteria.map((item) => `- ${item}`),
    "",
    "## Output Format",
    "",
    ...options.context.outputFormat.map((item) => `- ${item}`),
    "",
    "## Escalation Conditions",
    "",
    ...options.context.escalationConditions.map((item) => `- ${item}`)
  ];

  if (options.nativeSurface) {
    lines.push("", "## Native Surface", "", `- \`${options.nativeSurface}\``);
  }

  const latestCheckpoint = options.continuity?.latestCheckpoint;
  const latestPhase = options.continuity?.latestPhase;
  const latestHandoff = options.continuity?.latestHandoff;
  const currentFocus = options.continuity?.currentFocus;
  if (latestCheckpoint || latestPhase || latestHandoff || currentFocus) {
    lines.push("", "## Continuity", "");
  }

  if (currentFocus) {
    lines.push(
      `- current focus: ${currentFocus.currentFocus}`,
      `- focus owner: \`${currentFocus.focusOwnerRole}\``,
      `- focus next specialist: \`${currentFocus.nextRecommendedSpecialist}\``,
      `- focus MCP pack: \`${currentFocus.nextSuggestedMcpPack}\``,
      `- focus next file: \`${currentFocus.nextFileToRead}\``,
      `- focus next command: ${currentFocus.nextSuggestedCommand}`
    );
  }

  if (latestCheckpoint) {
    lines.push(
      `- latest checkpoint: \`${latestCheckpoint.phase}\` (${latestCheckpoint.createdAt})`,
      `- checkpoint summary: ${latestCheckpoint.summary}`,
      ...(latestCheckpoint.filesTouched.length > 0
        ? [`- checkpoint files: ${latestCheckpoint.filesTouched.slice(0, 8).join(", ")}`]
        : []),
      `- checkpoint next action: ${latestCheckpoint.nextRecommendedAction}`,
      `- checkpoint next command: ${latestCheckpoint.nextSuggestedCommand}`
    );
  }

  if (latestPhase) {
    lines.push(
      `- latest phase: \`${latestPhase.phaseId}\` (${latestPhase.status})`,
      `- phase label: ${latestPhase.label}`,
      ...(latestPhase.tool ? [`- previous tool: \`${latestPhase.tool}\``] : []),
      ...(latestPhase.validationsRun.length > 0 ? [`- validations: ${latestPhase.validationsRun.join("; ")}`] : []),
      ...(latestPhase.warnings.length > 0 ? [`- warnings: ${latestPhase.warnings.join("; ")}`] : []),
      ...(latestPhase.openIssues.length > 0 ? [`- open issues: ${latestPhase.openIssues.join("; ")}`] : [])
    );
  }

  if (latestHandoff) {
    lines.push(
      `- latest handoff: ${latestHandoff.summary} -> \`${latestHandoff.toTool}\` (${latestHandoff.status})`,
      `- handoff next step: ${latestHandoff.nextStep}`
    );
  }

  if (options.context.conflicts.length > 0) {
    lines.push("", "## Context Conflicts", "");
    for (const conflict of options.context.conflicts) {
      lines.push(`- ${conflict.message}`);
    }
  }

  if (options.context.eligibleMcpCapabilities.length > 0) {
    lines.push("", "## Eligible MCP References", "");
    for (const capability of options.context.eligibleMcpCapabilities.slice(0, 6)) {
      lines.push(
        `- ${capability.id}: ${capability.purpose} (trust=${capability.trustLevel}, readOnly=${capability.readOnly}, approvalRequired=${capability.approvalRequired})`
      );
    }
  }

  lines.push("", "## Role Instructions", "", options.prompt.trim());
  return `${frontmatter.join("\n")}${lines.join("\n")}\n`;
}

function buildPacketWriteTargets(options: RenderPacketOptions): string[] {
  const focusedFiles = [
    ...options.context.keyBoundaryFiles.slice(0, 4).map((item) => `read carefully before editing: \`${renderDisplayPath(options.context.targetRoot, item)}\``),
    ...options.context.stableContracts.slice(0, 4).map((item) => `update matching contract if touched: \`${renderDisplayPath(options.context.targetRoot, item)}\``)
  ];
  return buildWriteTargets(
    {
      instructionSurfaces: [],
      agentSurfaces: [],
      roleSurfaces: [],
      activeRole: options.specialist?.specialistId ?? options.supportingRole,
      supportingRoles: []
    },
    focusedFiles.length > 0 ? focusedFiles : ["only the goal-relevant repo files and matching continuity artifacts"]
  );
}

function renderYamlList(key: string, items: string[], indentLevel = 0): string[] {
  const indent = "  ".repeat(indentLevel);
  const childIndent = `${indent}  `;
  if (items.length === 0) {
    return [`${indent}${key}: []`];
  }
  return [`${indent}${key}:`, ...items.map((item) => `${childIndent}- ${escapeYaml(item)}`)];
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}

function renderRelevantFilesSection(options: RenderPacketOptions): string[] {
  const relevantFiles = [
    ...options.context.stableContracts,
    ...options.context.keyBoundaryFiles,
    ...options.context.releaseCriticalSurfaces,
    ...options.context.riskyAreas
  ]
    .map((filePath) => renderDisplayPath(options.context.targetRoot, filePath))
    .filter((filePath, index, items) => items.indexOf(filePath) === index)
    .slice(0, 16);

  const lines = ["", "## Relevant Repo Files", ""];
  if (relevantFiles.length === 0) {
    lines.push("- no extra repo files were promoted beyond the read-first contract");
  } else {
    lines.push(...relevantFiles.map((filePath) => `- \`${filePath}\``));
  }
  return lines;
}
