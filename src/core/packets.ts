import type { ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
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
  const lines = [
    `# ${options.title}`,
    "",
    `Objective: ${options.goal}`,
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
    "## Repo Context Summary",
    "",
    options.context.repoContextSummary,
    ...(options.context.promotedAuthorityDocs.length > 0
      ? [
          "",
          "## Promoted Canonical Docs",
          "",
          ...options.context.promotedAuthorityDocs.map((docPath) => `- \`${renderDisplayPath(options.context.targetRoot, docPath)}\``)
        ]
      : []),
    "",
    "## Workflow Decision Rules",
    "",
    "- treat existing repo authority and promoted canonical docs as stronger than generated overlays",
    "- trivial work may stay direct only when it is local, low-risk, and does not affect contracts, auth, data, security, release behavior, or multiple files",
    "- if the task is non-trivial, continue within the Shrey Junior workflow instead of freeform improvisation",
    "- escalate to fanout or dispatch if the work becomes cross-cutting, guarded, contract-sensitive, or needs reviewer/tester separation",
    "- use checkpoint and handoff at meaningful phase boundaries or cross-tool transitions",
    "- require push-check before recommending push on non-trivial or guarded work",
    "",
    "## Authority Files To Read First",
    "",
    ...options.context.authorityOrder.map((authorityPath) => `- \`${renderDisplayPath(options.context.targetRoot, authorityPath)}\``),
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
    ...(options.context.stableContracts.length > 0
      ? [
          "",
          "## Stable Contracts",
          "",
          ...options.context.stableContracts.map((filePath) => `- \`${renderDisplayPath(options.context.targetRoot, filePath)}\``)
        ]
      : []),
    ...(options.context.keyBoundaryFiles.length > 0
      ? [
          "",
          "## Key Boundary Files",
          "",
          ...options.context.keyBoundaryFiles.map((filePath) => `- \`${renderDisplayPath(options.context.targetRoot, filePath)}\``)
        ]
      : []),
    ...(options.context.releaseCriticalSurfaces.length > 0
      ? [
          "",
          "## Release-Critical Surfaces",
          "",
          ...options.context.releaseCriticalSurfaces.map((filePath) => `- \`${renderDisplayPath(options.context.targetRoot, filePath)}\``)
        ]
      : []),
    ...(options.context.riskyAreas.length > 0
      ? [
          "",
          "## Risky Areas To Treat Carefully",
          "",
          ...options.context.riskyAreas.map((filePath) => `- \`${renderDisplayPath(options.context.targetRoot, filePath)}\``)
        ]
      : []),
    "",
    "## Allowed Scope",
    "",
    ...options.context.allowedScope.map((item) => `- ${item}`),
    "",
    "## Forbidden Scope",
    "",
    ...options.context.forbiddenScope.map((item) => `- ${item}`),
    "",
    "## Exact Validation Steps",
    "",
    ...options.context.validationSteps.map((item) => `- ${item}`),
    "",
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

  if (options.continuity?.latestPhase) {
    const latestPhase = options.continuity.latestPhase;
    lines.push(
      "",
      "## Previous Phase Summary",
      "",
      `- phase id: \`${latestPhase.phaseId}\``,
      `- label: ${latestPhase.label}`,
      `- status: \`${latestPhase.status}\``,
      `- profile: \`${latestPhase.profile}\``,
      `- mode: \`${latestPhase.mode}\``,
      ...(latestPhase.tool ? [`- previous tool: \`${latestPhase.tool}\``] : []),
      ...(latestPhase.previousTool ? [`- tool before that: \`${latestPhase.previousTool}\``] : [])
    );

    const changedFiles = latestPhase.changedFilesSummary?.changedFiles ?? [];
    if (changedFiles.length > 0) {
      lines.push("", "## What Changed Since Last Checkpoint", "");
      for (const filePath of changedFiles.slice(0, 12)) {
        lines.push(`- \`${filePath}\``);
      }
    }

    if (latestPhase.validationsRun.length > 0) {
      lines.push("", "## Previous Validations", "");
      for (const validation of latestPhase.validationsRun) {
        lines.push(`- ${validation}`);
      }
    }

    if (latestPhase.warnings.length > 0 || latestPhase.openIssues.length > 0) {
      lines.push("", "## Open Issues From Previous Phase", "");
      for (const warning of latestPhase.warnings) {
        lines.push(`- warning: ${warning}`);
      }
      for (const issue of latestPhase.openIssues) {
        lines.push(`- open issue: ${issue}`);
      }
    }
  }

  if (options.continuity?.latestHandoff) {
    const latestHandoff = options.continuity.latestHandoff;
    lines.push(
      "",
      "## Latest Handoff Context",
      "",
      `- handoff target: \`${latestHandoff.toTool}\``,
      `- handoff status: \`${latestHandoff.status}\``,
      `- summary: ${latestHandoff.summary}`,
      `- next step: ${latestHandoff.nextStep}`
    );
  }

  lines.push(
    "",
    "## Control Plane Expectations",
    "",
    "- prefer specialist-aware routing over generic freeform work when a clear specialist fit exists",
    "- treat MCP usage as policy-driven by profile, specialist, trust, and approval rules",
    "- stop and warn when authority files, reconcile state, or policy guidance conflict"
  );

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
  return `${lines.join("\n")}\n`;
}
