import path from "node:path";
import type { LoadedConfig } from "./config.js";
import type { CompiledContext } from "./context.js";
import type { DispatchCollection, DispatchManifest, DispatchRole, DispatchRoleResult } from "./dispatch.js";
import { ensureDispatchLayout, getDispatchPaths, listDispatchManifests } from "./dispatch.js";
import { PRODUCT_METADATA } from "./product.js";
import { recommendMcpPack } from "./recommendations.js";
import { recommendNextSpecialist } from "./specialists.js";
import { loadActiveRoleHints, updateActiveRoleHints } from "./state.js";
import { pathExists, readJson, renderDisplayPath, writeText } from "../utils/fs.js";

export interface ReconcileReport {
  artifactType: "shrey-junior/reconcile-report";
  version: number;
  createdAt: string;
  dispatchId: string;
  status: "ready-for-next-phase" | "review-required" | "blocked";
  analysisBasis: "mostly-structured" | "mixed" | "mostly-heuristic" | "empty";
  completedRoles: DispatchRole[];
  missingRoles: DispatchRole[];
  roleStatusGaps: string[];
  malformedRoles: DispatchRole[];
  partialRoles: Array<{ role: DispatchRole; missingFields: string[] }>;
  fallbackRoles: DispatchRole[];
  agreements: string[];
  conflicts: string[];
  missingValidations: string[];
  unresolvedRisks: string[];
  recommendedNextStep: string;
  readFirst: string[];
}

export function buildReconcileReport(manifest: DispatchManifest, collection: DispatchCollection, context: CompiledContext): ReconcileReport {
  const agreements = dedupeStrings(collection.roleResults.flatMap((result) => result.agreements));
  const conflicts = dedupeStrings(collection.roleResults.flatMap((result) => result.conflicts));
  const missingValidations = collection.roleResults
    .filter((result) => result.status === "complete" && result.validations.length === 0)
    .map((result) => `${result.role} recorded no validations`);
  const roleStatusMap = new Map(collection.roleResults.map((result) => [result.role, result.status] as const));
  const roleStatusGaps = manifest.roleAssignments
    .filter((assignment) => assignment.required && (roleStatusMap.get(assignment.role) === "pending" || roleStatusMap.get(assignment.role) === "active" || !roleStatusMap.has(assignment.role)))
    .map((assignment) => `required role output missing: ${assignment.role}`);
  const unresolvedRisks = dedupeStrings([
    ...collection.roleResults.flatMap((result) => result.risks),
    ...roleStatusGaps
  ]);
  const analysisBasis = resolveAnalysisBasis(collection);

  const status = resolveReconcileStatus(collection.roleResults, conflicts, missingValidations, unresolvedRisks, roleStatusGaps, collection.malformedRoles);
  const recommendedNextStep = status === "blocked"
    ? "Resolve blocked role outputs or explicit conflicts, then rerun collect and reconcile."
    : status === "review-required"
      ? roleStatusGaps.length > 0
        ? "Gather the missing required role outputs, repair any partial structured outputs, then rerun collect and reconcile."
        : collection.malformedRoles.length > 0 || collection.partialRoles.length > 0
        ? "Repair malformed or partial structured role outputs, then rerun collect and reconcile."
        : "Gather missing role outputs or validations, then rerun reconcile before checkpointing."
      : "Record a new checkpoint and hand off the next phase or run push-check if the repo is git-ready.";

  return {
    artifactType: "shrey-junior/reconcile-report",
    version: 1,
    createdAt: new Date().toISOString(),
    dispatchId: manifest.dispatchId,
    status,
    analysisBasis,
    completedRoles: collection.completedRoles,
    missingRoles: collection.missingRoles,
    roleStatusGaps,
    malformedRoles: collection.malformedRoles,
    partialRoles: collection.partialRoles,
    fallbackRoles: collection.fallbackRoles,
    agreements: agreements.length > 0 ? agreements : buildImplicitAgreements(collection.roleResults, conflicts),
    conflicts,
    missingValidations,
    unresolvedRisks,
    recommendedNextStep,
    readFirst: dedupeStrings([
      ".agent/state/active-role-hints.json",
      ".agent/state/current-phase.json",
      ".agent/state/checkpoints/latest.json",
      ...context.promotedAuthorityDocs,
      ...context.authorityOrder
    ]).slice(0, 8)
  };
}

export function renderReconcileMarkdown(targetRoot: string, report: ReconcileReport): string {
  const lines = [
    `# Reconcile ${report.dispatchId}`,
    "",
    `Created: ${report.createdAt}`,
    `Status: \`${report.status}\``,
    `Analysis basis: \`${report.analysisBasis}\``,
    "",
    "## Read First",
    "",
    ...report.readFirst.map((filePath) => `- \`${renderDisplayPath(targetRoot, filePath)}\``),
    "",
    "## Completed Roles",
    "",
    ...(report.completedRoles.length > 0 ? report.completedRoles.map((role) => `- ${role}`) : ["- none"]),
    "",
    "## Missing Roles",
    "",
    ...(report.missingRoles.length > 0 ? report.missingRoles.map((role) => `- ${role}`) : ["- none"]),
    "",
    "## Role Status Gaps",
    "",
    ...(report.roleStatusGaps.length > 0 ? report.roleStatusGaps.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Structured Output Health",
    "",
    ...(report.malformedRoles.length > 0 ? [`- malformed roles: ${report.malformedRoles.join(", ")}`] : ["- malformed roles: none"]),
    ...(report.partialRoles.length > 0
      ? report.partialRoles.map((item) => `- partial role ${item.role}: missing ${item.missingFields.join(", ")}`)
      : ["- partial roles: none"]),
    ...(report.fallbackRoles.length > 0 ? [`- heuristic fallback roles: ${report.fallbackRoles.join(", ")}`] : ["- heuristic fallback roles: none"]),
    "",
    "## Agreements",
    "",
    ...(report.agreements.length > 0 ? report.agreements.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Conflicts",
    "",
    ...(report.conflicts.length > 0 ? report.conflicts.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Missing Validations",
    "",
    ...(report.missingValidations.length > 0 ? report.missingValidations.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Unresolved Risks",
    "",
    ...(report.unresolvedRisks.length > 0 ? report.unresolvedRisks.map((item) => `- ${item}`) : ["- none recorded"]),
    "",
    "## Recommended Next Step",
    "",
    `- ${report.recommendedNextStep}`
  ];
  return `${lines.join("\n")}\n`;
}

export async function writeReconcileArtifacts(options: {
  targetRoot: string;
  dispatchId: string;
  report: ReconcileReport;
  config?: LoadedConfig;
  profileName?: string;
}): Promise<{
  jsonPath: string;
  markdownPath: string;
}> {
  const paths = await ensureDispatchLayout(options.targetRoot, options.dispatchId);
  const reconcileDir = path.join(getDispatchPaths(options.targetRoot).root, "..", "reconcile");
  const latestJsonPath = path.join(reconcileDir, "latest.json");
  const latestMarkdownPath = path.join(reconcileDir, "latest.md");
  const jsonPayload = `${JSON.stringify(options.report, null, 2)}\n`;
  const markdown = renderReconcileMarkdown(options.targetRoot, options.report);
  await writeText(paths.reconcileLatestJsonPath, jsonPayload);
  await writeText(paths.reconcileLatestMarkdownPath, markdown);
  await writeText(latestJsonPath, jsonPayload);
  await writeText(latestMarkdownPath, markdown);
  const activeRoleHints = await loadActiveRoleHints(options.targetRoot);
  if (activeRoleHints) {
    const nextSuggestedCommand = options.report.status === "ready-for-next-phase"
      ? `${PRODUCT_METADATA.cli.primaryCommand} checkpoint "reconcile ${options.report.dispatchId}" --target "${options.targetRoot}"`
      : `${PRODUCT_METADATA.cli.primaryCommand} status --target "${options.targetRoot}"`;
    const nextRecommendedSpecialist = options.config && options.profileName
      ? recommendNextSpecialist({
          config: options.config,
          profileName: options.profileName,
          projectType: activeRoleHints.projectType,
          taskType: options.report.status === "ready-for-next-phase" ? "release-readiness" : "review",
          fileArea: "context",
          activeSpecialistId: activeRoleHints.nextRecommendedSpecialist || activeRoleHints.activeRole,
          blocked: options.report.status === "blocked"
        }).specialistId
      : activeRoleHints.nextRecommendedSpecialist;
    await updateActiveRoleHints(options.targetRoot, {
      activeRole: activeRoleHints.activeRole,
      authoritySource: activeRoleHints.authoritySource,
      projectType: activeRoleHints.projectType,
      supportingRoles: activeRoleHints.supportingRoles,
      nextFileToRead: ".agent/state/reconcile/latest.json",
      nextSuggestedCommand,
      nextAction: options.report.recommendedNextStep,
      nextRecommendedSpecialist,
      nextSuggestedMcpPack: recommendMcpPack({
        projectType: activeRoleHints.projectType,
        taskType: options.report.status === "ready-for-next-phase" ? "release-readiness" : "review",
        fileArea: "context"
      }),
      latestReconcile: renderDisplayPath(options.targetRoot, latestJsonPath)
    });
  }
  return {
    jsonPath: paths.reconcileLatestJsonPath,
    markdownPath: paths.reconcileLatestMarkdownPath
  };
}

export async function loadLatestReconcileReport(targetRoot: string, dispatchId?: string): Promise<ReconcileReport | null> {
  const rootLatestPath = path.join(getDispatchPaths(targetRoot).root, "..", "reconcile", "latest.json");
  if (!dispatchId && (await pathExists(rootLatestPath))) {
    return normalizeReconcileReport(await readJson<Record<string, unknown>>(rootLatestPath));
  }
  if (dispatchId) {
    const resolvedPath = getDispatchPaths(targetRoot, dispatchId).reconcileLatestJsonPath;
    if (!resolvedPath || !(await pathExists(resolvedPath))) {
      return null;
    }
    return normalizeReconcileReport(await readJson<Record<string, unknown>>(resolvedPath));
  }

  const manifests = await listDispatchManifests(targetRoot);
  for (const manifest of manifests) {
    const resolvedPath = getDispatchPaths(targetRoot, manifest.dispatchId).reconcileLatestJsonPath;
    if (resolvedPath && (await pathExists(resolvedPath))) {
      return normalizeReconcileReport(await readJson<Record<string, unknown>>(resolvedPath));
    }
  }
  return null;
}

function resolveReconcileStatus(
  results: DispatchRoleResult[],
  conflicts: string[],
  missingValidations: string[],
  unresolvedRisks: string[],
  roleStatusGaps: string[],
  malformedRoles: DispatchRole[]
): ReconcileReport["status"] {
  if (results.some((result) => result.status === "blocked") || conflicts.length > 0) {
    return "blocked";
  }
  if (malformedRoles.length > 0 || roleStatusGaps.length > 0 || missingValidations.length > 0 || unresolvedRisks.length > 0) {
    return "review-required";
  }
  return "ready-for-next-phase";
}

function resolveAnalysisBasis(collection: DispatchCollection): ReconcileReport["analysisBasis"] {
  const structuredCount = collection.roleResults.filter(
    (result) => result.sourceKind === "structured-json" || result.sourceKind === "structured-frontmatter"
  ).length;
  const heuristicCount = collection.fallbackRoles.length;

  if (structuredCount === 0 && heuristicCount === 0) {
    return "empty";
  }
  if (structuredCount > 0 && heuristicCount === 0) {
    return "mostly-structured";
  }
  if (heuristicCount > structuredCount) {
    return "mostly-heuristic";
  }
  return "mixed";
}

function buildImplicitAgreements(results: DispatchRoleResult[], conflicts: string[]): string[] {
  const completed = results.filter((result) => result.status === "complete");
  if (completed.length >= 2 && conflicts.length === 0) {
    return [`${completed.map((result) => result.role).join(", ")} completed outputs with no explicit conflicts recorded.`];
  }
  return [];
}

function dedupeStrings(items: string[]): string[] {
  return [...new Set(items.filter((item) => Boolean(item.trim())))];
}

function normalizeReconcileReport(payload: Record<string, unknown>): ReconcileReport {
  return {
    artifactType: payload.artifactType === "shrey-junior/reconcile-report" ? payload.artifactType : "shrey-junior/reconcile-report",
    version: typeof payload.version === "number" ? payload.version : 1,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString(),
    dispatchId: typeof payload.dispatchId === "string" ? payload.dispatchId : "unknown-dispatch",
    status: payload.status === "ready-for-next-phase" || payload.status === "review-required" || payload.status === "blocked"
      ? payload.status
      : "review-required",
    analysisBasis:
      payload.analysisBasis === "mostly-structured" ||
      payload.analysisBasis === "mixed" ||
      payload.analysisBasis === "mostly-heuristic" ||
      payload.analysisBasis === "empty"
        ? payload.analysisBasis
        : "mixed",
    completedRoles: stringArray(payload.completedRoles) as DispatchRole[],
    missingRoles: stringArray(payload.missingRoles) as DispatchRole[],
    roleStatusGaps: stringArray(payload.roleStatusGaps),
    malformedRoles: stringArray(payload.malformedRoles) as DispatchRole[],
    partialRoles: Array.isArray(payload.partialRoles)
      ? payload.partialRoles
          .filter((item): item is { role: DispatchRole; missingFields: string[] } => {
            return (
              typeof item === "object" &&
              item !== null &&
              "role" in item &&
              typeof item.role === "string" &&
              Array.isArray((item as { missingFields?: unknown }).missingFields)
            );
          })
          .map((item) => ({
            role: item.role,
            missingFields: stringArray(item.missingFields)
          }))
      : [],
    fallbackRoles: stringArray(payload.fallbackRoles) as DispatchRole[],
    agreements: stringArray(payload.agreements),
    conflicts: stringArray(payload.conflicts),
    missingValidations: stringArray(payload.missingValidations),
    unresolvedRisks: stringArray(payload.unresolvedRisks),
    recommendedNextStep: typeof payload.recommendedNextStep === "string"
      ? payload.recommendedNextStep
      : "Review the collected role outputs before continuing.",
    readFirst: stringArray(payload.readFirst)
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}
