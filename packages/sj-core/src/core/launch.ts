import type { LoadedConfig, ExecutionMode, ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import type { DispatchCollection, DispatchManifest, DispatchRole } from "./dispatch.js";
import type { PolicyEvaluation } from "./policies.js";
import { evaluatePolicyPoint } from "./policies.js";
import type { ProfileSelection, ProjectOverlay } from "./profiles.js";
import type { ReconcileReport } from "./reconcile.js";
import type { SpecialistSelection } from "./specialists.js";
import { listEligibleMcpCapabilities, resolveSpecialist } from "./specialists.js";
import type { ContinuitySnapshot, PhaseRecord } from "./state.js";
import { renderDisplayPath } from "../utils/fs.js";

export interface LaunchPlan {
  tool: ToolName;
  role: string;
  profileName: string;
  mode: ExecutionMode;
  specialist: SpecialistSelection;
  policyPoint: "pre-run" | "pre-dispatch";
  policy: PolicyEvaluation;
  packetPath?: string;
  readFirst: string[];
  latestHandoffSummary?: string;
  latestDispatchId?: string;
  latestReconcileStatus?: ReconcileReport["status"];
  latestPhaseLabel?: string;
  eligibleMcpReferences: string[];
  blockers: string[];
  warnings: string[];
  recommendedAction: string;
}

export function buildLaunchPlan(options: {
  targetRoot: string;
  config: LoadedConfig;
  selection: ProfileSelection;
  overlay: ProjectOverlay | null;
  compiledContext: CompiledContext;
  continuity: ContinuitySnapshot;
  latestDispatch: DispatchManifest | null;
  latestCollection: DispatchCollection | null;
  latestReconcile: ReconcileReport | null;
  executionMode: ExecutionMode;
  tool: ToolName;
  role?: string;
  explicitSpecialistId?: string;
}): LaunchPlan {
  const role = options.role ?? inferRole(options.tool, options.latestDispatch, options.continuity.latestPhase);
  const specialist = resolveSpecialist({
    config: options.config,
    profileName: options.selection.profileName,
    taskType: options.compiledContext.taskType,
    fileArea: options.compiledContext.fileArea,
    role,
    tool: options.tool,
    ...(options.explicitSpecialistId ? { explicitSpecialistId: options.explicitSpecialistId } : {})
  });
  const policyPoint = options.latestDispatch ? "pre-dispatch" : "pre-run";
  const policy = evaluatePolicyPoint(policyPoint, {
    config: options.config,
    selection: options.selection,
    overlay: options.overlay,
    compiledContext: options.compiledContext,
    specialist,
    taskType: options.compiledContext.taskType,
    fileArea: options.compiledContext.fileArea,
    role,
    tool: options.tool,
    latestPhase: options.continuity.latestPhase,
    latestDispatch: options.latestDispatch,
    latestCollection: options.latestCollection,
    latestReconcile: options.latestReconcile
  });
  const eligibleMcpReferences = listEligibleMcpCapabilities({
    config: options.config,
    profileName: options.selection.profileName,
    specialistId: specialist.specialistId,
    tool: options.tool
  }).map((capability) => capability.id);
  const readFirst = dedupe([
    ...options.compiledContext.promotedAuthorityDocs,
    ...options.compiledContext.authorityOrder
  ])
    .slice(0, 8)
    .map((filePath) => renderDisplayPath(options.targetRoot, filePath));
  const packetPath = findPacketPath(options.targetRoot, options.latestDispatch, role, options.tool);
  const blockers = policy.findings.filter((finding) => finding.severity === "block").map((finding) => finding.message);
  const warnings = policy.findings.filter((finding) => finding.severity === "warn").map((finding) => finding.message);

  return {
    tool: options.tool,
    role,
    profileName: options.selection.profileName,
    mode: options.executionMode,
    specialist,
    policyPoint,
    policy,
    ...(packetPath ? { packetPath } : {}),
    readFirst,
    ...(options.continuity.latestHandoff ? { latestHandoffSummary: options.continuity.latestHandoff.summary } : {}),
    ...(options.latestDispatch ? { latestDispatchId: options.latestDispatch.dispatchId } : {}),
    ...(options.latestReconcile ? { latestReconcileStatus: options.latestReconcile.status } : {}),
    ...(options.continuity.latestPhase ? { latestPhaseLabel: options.continuity.latestPhase.label } : {}),
    eligibleMcpReferences,
    blockers,
    warnings,
    recommendedAction: buildRecommendedAction(packetPath, options.tool, role, policy.result)
  };
}

function inferRole(tool: ToolName, latestDispatch: DispatchManifest | null, latestPhase: PhaseRecord | null): string {
  const dispatchMatch = latestDispatch?.roleAssignments.find((assignment) => assignment.intendedTool === tool && assignment.required);
  if (dispatchMatch) {
    return dispatchMatch.role;
  }
  if (tool === "codex") {
    return "implementer";
  }
  if (tool === "copilot") {
    return "implementer";
  }
  if (latestPhase?.routingSummary.taskType === "planning" || latestPhase?.routingSummary.taskType === "docs") {
    return "planner";
  }
  return "reviewer";
}

function findPacketPath(targetRoot: string, latestDispatch: DispatchManifest | null, role: string, tool: ToolName): string | undefined {
  if (latestDispatch) {
    const assignment = latestDispatch.roleAssignments.find((item) => item.role === role && item.intendedTool === tool);
    if (assignment) {
      return renderDisplayPath(targetRoot, assignment.packetPath);
    }
  }
  return undefined;
}

function buildRecommendedAction(packetPath: string | undefined, tool: ToolName, role: string, policyResult: PolicyEvaluation["result"]): string {
  if (policyResult === "blocked") {
    return `Do not launch ${tool} as ${role} until the listed blockers are resolved.`;
  }
  if (packetPath) {
    return `Open ${packetPath} and continue as ${role} in ${tool}.`;
  }
  return `No matching packet was found. Generate a fresh run or fanout packet before launching ${tool} as ${role}.`;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter((item) => Boolean(item.trim())))];
}
