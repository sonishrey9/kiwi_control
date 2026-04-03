import type { LoadedConfig, PolicyCheckId, PolicyPoint, ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import type { DispatchCollection, DispatchManifest } from "./dispatch.js";
import type { GitState, PushAssessment } from "./git.js";
import type { ProjectOverlay, ProfileSelection } from "./profiles.js";
import type { ReconcileReport } from "./reconcile.js";
import type { SpecialistSelection } from "./specialists.js";
import type { PhaseRecord } from "./state.js";

export interface PolicyFinding {
  point: PolicyPoint;
  checkId: PolicyCheckId;
  severity: "warn" | "block";
  message: string;
}

export interface PolicyEvaluation {
  point: PolicyPoint;
  result: "allowed" | "review-required" | "blocked";
  findings: PolicyFinding[];
}

export interface PolicyContext {
  config: LoadedConfig;
  selection: ProfileSelection;
  overlay: ProjectOverlay | null;
  compiledContext?: CompiledContext;
  specialist?: SpecialistSelection;
  taskType?: string;
  fileArea?: string;
  role?: string;
  tool?: ToolName;
  latestPhase?: PhaseRecord | null;
  latestDispatch?: DispatchManifest | null;
  latestCollection?: DispatchCollection | null;
  latestReconcile?: ReconcileReport | null;
  gitState?: GitState;
  pushAssessment?: PushAssessment;
}

export function evaluatePolicyPoint(point: PolicyPoint, context: PolicyContext): PolicyEvaluation {
  const pointConfig = context.config.policies.points[point];
  const findings: PolicyFinding[] = [];

  for (const rule of pointConfig.checks) {
    for (const message of runCheck(rule.id, context)) {
      findings.push({
        point,
        checkId: rule.id,
        severity: rule.severity,
        message
      });
    }
  }

  const result = findings.some((finding) => finding.severity === "block")
    ? "blocked"
    : findings.length > 0
      ? "review-required"
      : "allowed";

  return {
    point,
    result,
    findings
  };
}

export function evaluatePolicyPoints(points: PolicyPoint[], context: PolicyContext): PolicyEvaluation[] {
  return points.map((point) => evaluatePolicyPoint(point, context));
}

function runCheck(id: PolicyCheckId, context: PolicyContext): string[] {
  switch (id) {
    case "authority-conflicts":
      return context.compiledContext?.conflicts.map((conflict) => conflict.message) ?? [];
    case "profile-mismatch":
      return context.overlay?.profile && context.overlay.profile !== context.selection.profileName
        ? [`overlay profile ${context.overlay.profile} differs from selected profile ${context.selection.profileName}`]
        : [];
    case "blocked-reconcile":
      return context.latestReconcile?.status === "blocked"
        ? [`latest reconcile ${context.latestReconcile.dispatchId} is blocked`]
        : [];
    case "missing-structured-outputs": {
      const findings: string[] = [];
      if (context.latestCollection?.malformedRoles.length) {
        findings.push(`malformed structured outputs: ${context.latestCollection.malformedRoles.join(", ")}`);
      }
      if (context.latestCollection?.partialRoles.length) {
        findings.push(
          `partial structured outputs: ${context.latestCollection.partialRoles.map((item) => `${item.role}(${item.missingFields.join(",")})`).join("; ")}`
        );
      }
      if (context.latestCollection?.fallbackRoles.length) {
        findings.push(`heuristic fallback outputs: ${context.latestCollection.fallbackRoles.join(", ")}`);
      }
      return findings;
    }
    case "specialist-mismatch": {
      if (!context.specialist) {
        return [];
      }
      const findings: string[] = [];
      const specialist = context.specialist.specialist;
      if (!specialist.allowed_profiles.includes(context.selection.profileName)) {
        findings.push(`specialist ${specialist.id} is not allowed for profile ${context.selection.profileName}`);
      }
      if (context.role && !specialist.routing_bias.roles.includes(context.role)) {
        findings.push(`specialist ${specialist.id} is not biased for role ${context.role}`);
      }
      if (context.tool && !specialist.preferred_tools.includes(context.tool)) {
        findings.push(`specialist ${specialist.id} does not prefer tool ${context.tool}`);
      }
      return findings;
    }
    case "mcp-ineligibility": {
      if (!context.specialist || !context.compiledContext) {
        return [];
      }
      const eligible = new Set(context.compiledContext.eligibleMcpServers);
      const missing = context.specialist.specialist.mcp_eligibility.filter((item) => !eligible.has(item));
      return missing.length > 0 ? [`specialist ${context.specialist.specialist.id} expects unavailable MCP references: ${missing.join(", ")}`] : [];
    }
    case "missing-validations": {
      const findings: string[] = [];
      if (!context.latestPhase || context.latestPhase.validationsRun.length === 0) {
        findings.push("latest checkpoint does not record completed validations");
      }
      if (context.latestReconcile?.missingValidations.length) {
        findings.push(`reconcile missing validations: ${context.latestReconcile.missingValidations.join("; ")}`);
      }
      return findings;
    }
    case "push-release-blockers": {
      const findings: string[] = [];
      if (context.pushAssessment && context.pushAssessment.result !== "allowed" && context.pushAssessment.result !== "not-applicable") {
        findings.push(`push readiness is ${context.pushAssessment.result}`);
      }
      if (context.gitState?.isGitRepo && !context.gitState.clean) {
        findings.push("working tree is not clean");
      }
      return findings;
    }
    default:
      return [];
  }
}
