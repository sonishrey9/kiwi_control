import path from "node:path";
import { promises as fs } from "node:fs";
import type { ExecutionMode, ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import type { RoutingDecision } from "./router.js";
import type { ContinuitySnapshot, PhaseRoutingSummary } from "./state.js";
import { buildPhaseId, getStatePaths } from "./state.js";
import { ensureDir, isIgnoredArtifactName, pathExists, readJson, readText, renderDisplayPath, writeText } from "../utils/fs.js";
import { parseYaml } from "../utils/yaml.js";

export const DISPATCH_ROLES = ["planner", "implementer", "reviewer", "tester"] as const;
export type DispatchRole = (typeof DISPATCH_ROLES)[number];
export type DispatchRoleStatus = "pending" | "active" | "complete" | "blocked";
export type DispatchRoleResultSource = "structured-json" | "structured-frontmatter" | "heuristic-markdown" | "missing" | "invalid";

export interface DispatchRoleAssignment {
  role: DispatchRole;
  intendedTool: ToolName;
  specialistId?: string;
  specialistReasons?: string[];
  required: boolean;
  packetPath: string;
  expectedMarkdownPath: string;
  expectedJsonPath: string;
  status: DispatchRoleStatus;
}

export interface DispatchManifest {
  version: number;
  createdAt: string;
  dispatchId: string;
  goal: string;
  profile: string;
  mode: ExecutionMode;
  status: DispatchRoleStatus;
  routingSummary: PhaseRoutingSummary;
  authorityFiles: string[];
  promotedDocs: string[];
  packetSetDirectory: string;
  roleAssignments: DispatchRoleAssignment[];
  sourcePhaseId?: string;
  previousTool?: ToolName;
  latestHandoffTo?: ToolName;
}

export interface DispatchRoleResult {
  role: DispatchRole;
  status: DispatchRoleStatus;
  summary: string;
  validations: string[];
  risks: string[];
  agreements: string[];
  conflicts: string[];
  touchedFiles: string[];
  nextSteps: string[];
  sourcePaths: string[];
  sourceKind: DispatchRoleResultSource;
  missingFields: string[];
  parsingWarnings: string[];
}

export interface DispatchCollection {
  version: number;
  createdAt: string;
  dispatchId: string;
  overallStatus: DispatchRoleStatus;
  parsingBasis: "structured" | "mixed" | "heuristic" | "empty";
  completedRoles: DispatchRole[];
  missingRoles: DispatchRole[];
  fallbackRoles: DispatchRole[];
  malformedRoles: DispatchRole[];
  partialRoles: Array<{ role: DispatchRole; missingFields: string[] }>;
  roleResults: DispatchRoleResult[];
}

interface StructuredRolePayload {
  role?: unknown;
  status?: unknown;
  summary?: unknown;
  agreements?: unknown;
  conflicts?: unknown;
  validations?: unknown;
  validationsRun?: unknown;
  risks?: unknown;
  warnings?: unknown;
  openIssues?: unknown;
  touched_files?: unknown;
  touchedFiles?: unknown;
  next_steps?: unknown;
  nextSteps?: unknown;
}

const STRUCTURED_ROLE_FIELDS = ["role", "status", "summary", "agreements", "conflicts", "validations", "risks", "touched_files", "next_steps"] as const;

export function buildDispatchId(goal: string, timestamp: string): string {
  return `dispatch-${buildPhaseId(goal, timestamp)}`;
}

export function getDispatchPaths(targetRoot: string, dispatchId?: string): {
  root: string;
  dispatchDir?: string;
  manifestPath?: string;
  markdownPath?: string;
  rolesDir?: string;
  resultsDir?: string;
  collectLatestPath?: string;
  collectHistoryDir?: string;
  reconcileLatestJsonPath?: string;
  reconcileLatestMarkdownPath?: string;
} {
  const root = path.join(getStatePaths(targetRoot).root, "dispatch");
  if (!dispatchId) {
    return { root };
  }
  const dispatchDir = path.join(root, dispatchId);
  return {
    root,
    dispatchDir,
    manifestPath: path.join(dispatchDir, "manifest.json"),
    markdownPath: path.join(dispatchDir, "dispatch.md"),
    rolesDir: path.join(dispatchDir, "roles"),
    resultsDir: path.join(dispatchDir, "results"),
    collectLatestPath: path.join(dispatchDir, "collect-latest.json"),
    collectHistoryDir: path.join(dispatchDir, "collect-history"),
    reconcileLatestJsonPath: path.join(dispatchDir, "reconcile-latest.json"),
    reconcileLatestMarkdownPath: path.join(dispatchDir, "reconcile-latest.md")
  };
}

export async function ensureDispatchLayout(targetRoot: string, dispatchId: string): Promise<Required<ReturnType<typeof getDispatchPaths>>> {
  const paths = getDispatchPaths(targetRoot, dispatchId) as Required<ReturnType<typeof getDispatchPaths>>;
  await ensureDir(paths.rolesDir);
  await ensureDir(paths.resultsDir);
  await ensureDir(paths.collectHistoryDir);
  return paths;
}

export function buildDispatchManifest(options: {
  targetRoot: string;
  goal: string;
  createdAt: string;
  profileName: string;
  executionMode: ExecutionMode;
  decision: RoutingDecision;
  context: CompiledContext;
  continuity: ContinuitySnapshot;
  packetRelativePaths: Record<DispatchRole, string>;
  roleTools: Record<DispatchRole, ToolName>;
  roleSpecialists?: Partial<Record<DispatchRole, { specialistId: string; reasons: string[] }>>;
}): DispatchManifest {
  const dispatchId = buildDispatchId(options.goal, options.createdAt);
  const packetSetDirectory = path.dirname(options.packetRelativePaths.planner);
  const roleAssignments: DispatchRoleAssignment[] = DISPATCH_ROLES.map((role) => ({
    role,
    intendedTool: options.roleTools[role],
    ...(options.roleSpecialists?.[role]
      ? {
          specialistId: options.roleSpecialists[role]?.specialistId,
          specialistReasons: options.roleSpecialists[role]?.reasons
        }
      : {}),
    required: role === "implementer" || role === "reviewer" || options.decision.requiredRoles.includes(role),
    packetPath: options.packetRelativePaths[role],
    expectedMarkdownPath: path.join(".agent", "state", "dispatch", dispatchId, "results", `${role}.md`),
    expectedJsonPath: path.join(".agent", "state", "dispatch", dispatchId, "results", `${role}.json`),
    status: "pending"
  }));

  return {
    version: 1,
    createdAt: options.createdAt,
    dispatchId,
    goal: options.goal,
    profile: options.profileName,
    mode: options.executionMode,
    status: "pending",
    routingSummary: {
      taskType: options.decision.taskType,
      primaryTool: options.decision.primaryTool,
      reviewTool: options.decision.reviewTool,
      riskLevel: options.decision.riskLevel,
      fileArea: options.decision.fileArea,
      changeSize: options.decision.changeSize,
      requiredRoles: options.decision.requiredRoles
    },
    authorityFiles: options.context.authorityOrder,
    promotedDocs: options.context.promotedAuthorityDocs,
    packetSetDirectory,
    roleAssignments,
    ...(options.continuity.latestPhase?.phaseId ? { sourcePhaseId: options.continuity.latestPhase.phaseId } : {}),
    ...(options.continuity.latestPhase?.tool ? { previousTool: options.continuity.latestPhase.tool } : {}),
    ...(options.continuity.latestHandoff?.toTool ? { latestHandoffTo: options.continuity.latestHandoff.toTool } : {})
  };
}

export async function writeDispatchManifest(targetRoot: string, manifest: DispatchManifest): Promise<{
  manifestPath: string;
  markdownPath: string;
}> {
  const paths = await ensureDispatchLayout(targetRoot, manifest.dispatchId);
  await writeText(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeText(paths.markdownPath, renderDispatchMarkdown(targetRoot, manifest));
  for (const assignment of manifest.roleAssignments) {
    await writeText(path.join(paths.rolesDir, `${assignment.role}.json`), `${JSON.stringify(assignment, null, 2)}\n`);
  }
  return {
    manifestPath: paths.manifestPath,
    markdownPath: paths.markdownPath
  };
}

export function renderDispatchMarkdown(targetRoot: string, manifest: DispatchManifest): string {
  const lines = [
    `# Dispatch ${manifest.dispatchId}`,
    "",
    `Goal: ${manifest.goal}`,
    `Profile: \`${manifest.profile}\``,
    `Mode: \`${manifest.mode}\``,
    `Status: \`${manifest.status}\``,
    ...(manifest.sourcePhaseId ? [`Source phase: \`${manifest.sourcePhaseId}\``] : []),
    ...(manifest.previousTool ? [`Previous tool: \`${manifest.previousTool}\``] : []),
    ...(manifest.latestHandoffTo ? [`Latest handoff target: \`${manifest.latestHandoffTo}\``] : []),
    "",
    "## Promoted Canonical Docs",
    "",
    ...(manifest.promotedDocs.length > 0
      ? manifest.promotedDocs.map((docPath) => `- \`${renderDisplayPath(targetRoot, docPath)}\``)
      : ["- none promoted"]),
    "",
    "## Authority Files",
    "",
    ...manifest.authorityFiles.slice(0, 10).map((filePath) => `- \`${renderDisplayPath(targetRoot, filePath)}\``),
    "",
    "## Role Assignments",
    "",
    ...manifest.roleAssignments.map(
      (assignment) =>
        `- ${assignment.role}: tool=\`${assignment.intendedTool}\`${assignment.specialistId ? ` specialist=\`${assignment.specialistId}\`` : ""} required=\`${assignment.required}\` packet=\`${assignment.packetPath}\` result=\`${assignment.expectedMarkdownPath}\``
    )
  ];
  return `${lines.join("\n")}\n`;
}

export async function loadLatestDispatchManifest(targetRoot: string): Promise<DispatchManifest | null> {
  const manifests = await listDispatchManifests(targetRoot);
  return manifests[0] ?? null;
}

export async function listDispatchManifests(targetRoot: string): Promise<DispatchManifest[]> {
  const root = getDispatchPaths(targetRoot).root;
  if (!(await pathExists(root))) {
    return [];
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory() && !isIgnoredArtifactName(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const manifests: DispatchManifest[] = [];
  for (const candidate of candidates) {
    const manifestPath = getDispatchPaths(targetRoot, candidate).manifestPath;
    if (manifestPath && (await pathExists(manifestPath))) {
      manifests.push(await readJson<DispatchManifest>(manifestPath));
    }
  }
  return manifests;
}

export async function loadLatestDispatchCollection(targetRoot: string, dispatchId?: string): Promise<DispatchCollection | null> {
  const manifest = dispatchId ? await loadDispatchManifest(targetRoot, dispatchId) : await loadLatestDispatchManifest(targetRoot);
  if (!manifest) {
    return null;
  }
  const collectLatestPath = getDispatchPaths(targetRoot, manifest.dispatchId).collectLatestPath;
  if (!collectLatestPath || !(await pathExists(collectLatestPath))) {
    return null;
  }
  return readJson<DispatchCollection>(collectLatestPath);
}

export async function loadDispatchManifest(targetRoot: string, dispatchId: string): Promise<DispatchManifest | null> {
  const manifestPath = getDispatchPaths(targetRoot, dispatchId).manifestPath;
  if (!manifestPath || !(await pathExists(manifestPath))) {
    return null;
  }
  return readJson<DispatchManifest>(manifestPath);
}

export async function collectDispatchOutputs(targetRoot: string, manifest: DispatchManifest): Promise<DispatchCollection> {
  const roleResults = await Promise.all(manifest.roleAssignments.map((assignment) => loadRoleResult(targetRoot, assignment)));
  const completedRoles = roleResults.filter((result) => result.status === "complete").map((result) => result.role);
  const missingRoles = roleResults.filter((result) => result.status === "pending").map((result) => result.role);
  const fallbackRoles = roleResults.filter((result) => result.sourceKind === "heuristic-markdown").map((result) => result.role);
  const malformedRoles = roleResults.filter((result) => result.sourceKind === "invalid").map((result) => result.role);
  const partialRoles = roleResults
    .filter((result) => result.missingFields.length > 0)
    .map((result) => ({ role: result.role, missingFields: result.missingFields }));
  const hasBlocked = roleResults.some((result) => result.status === "blocked");
  const hasActive = roleResults.some((result) => result.status === "active");
  const structuredCount = roleResults.filter(
    (result) => result.sourceKind === "structured-json" || result.sourceKind === "structured-frontmatter"
  ).length;
  const heuristicCount = fallbackRoles.length;
  const parsingBasis: DispatchCollection["parsingBasis"] = structuredCount === 0 && heuristicCount === 0
    ? "empty"
    : structuredCount > 0 && heuristicCount === 0
      ? "structured"
      : structuredCount === 0
        ? "heuristic"
        : "mixed";

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    dispatchId: manifest.dispatchId,
    overallStatus: hasBlocked
      ? "blocked"
      : missingRoles.length === 0
        ? "complete"
        : hasActive || completedRoles.length > 0
          ? "active"
          : "pending",
    parsingBasis,
    completedRoles,
    missingRoles,
    fallbackRoles,
    malformedRoles,
    partialRoles,
    roleResults
  };
}

export async function writeDispatchCollection(targetRoot: string, manifest: DispatchManifest, collection: DispatchCollection): Promise<{
  latestPath: string;
  historyPath: string;
}> {
  const paths = await ensureDispatchLayout(targetRoot, manifest.dispatchId);
  const latestPath = paths.collectLatestPath;
  const historyPath = path.join(paths.collectHistoryDir, `${collection.createdAt.replace(/[:.]/g, "-")}.json`);
  await writeText(latestPath, `${JSON.stringify(collection, null, 2)}\n`);
  await writeText(historyPath, `${JSON.stringify(collection, null, 2)}\n`);
  const updatedManifest = applyCollectionToManifest(manifest, collection);
  await writeDispatchManifest(targetRoot, updatedManifest);
  return { latestPath, historyPath };
}

export function applyCollectionToManifest(manifest: DispatchManifest, collection: DispatchCollection): DispatchManifest {
  const statusByRole = new Map(collection.roleResults.map((result) => [result.role, result.status] as const));
  return {
    ...manifest,
    status: collection.overallStatus,
    roleAssignments: manifest.roleAssignments.map((assignment) => ({
      ...assignment,
      status: statusByRole.get(assignment.role) ?? assignment.status
    }))
  };
}

async function loadRoleResult(targetRoot: string, assignment: DispatchRoleAssignment): Promise<DispatchRoleResult> {
  const jsonPath = path.join(targetRoot, assignment.expectedJsonPath);
  const markdownPath = path.join(targetRoot, assignment.expectedMarkdownPath);
  const parsingWarnings: string[] = [];

  if (await pathExists(jsonPath)) {
    try {
      const payload = JSON.parse(await readText(jsonPath)) as StructuredRolePayload;
      return buildStructuredRoleResult(assignment, payload, assignment.expectedJsonPath, "structured-json");
    } catch (error) {
      parsingWarnings.push(`invalid structured json at ${assignment.expectedJsonPath}: ${(error as Error).message}`);
      if (!(await pathExists(markdownPath))) {
        return invalidRoleResult(assignment, assignment.expectedJsonPath, parsingWarnings);
      }
    }
  }

  if (await pathExists(markdownPath)) {
    const content = (await readText(markdownPath)).trim();
    if (!content) {
      return emptyRoleResult(assignment.role, assignment.status);
    }
    const frontmatter = extractFrontmatter(content);
    if (frontmatter) {
      try {
        const payload = parseYaml<StructuredRolePayload>(frontmatter.body);
        const structured = buildStructuredRoleResult(assignment, payload, assignment.expectedMarkdownPath, "structured-frontmatter");
        structured.parsingWarnings.unshift(...parsingWarnings);
        return structured;
      } catch (error) {
        parsingWarnings.push(`invalid structured frontmatter at ${assignment.expectedMarkdownPath}: ${(error as Error).message}`);
      }
    }
    return {
      role: assignment.role,
      status: /\bblocked\b/i.test(content) ? "blocked" : /\bactive\b/i.test(content) ? "active" : "complete",
      summary: extractMarkdownSummary(content) ?? `${assignment.role} markdown output captured.`,
      validations: extractTaggedLines(content, "validation"),
      risks: extractTaggedLines(content, "risk"),
      agreements: extractTaggedLines(content, "agreement"),
      conflicts: extractTaggedLines(content, "conflict"),
      touchedFiles: extractTaggedLines(content, "touched_file"),
      nextSteps: extractTaggedLines(content, "next_step"),
      sourcePaths: [assignment.expectedMarkdownPath],
      sourceKind: "heuristic-markdown",
      missingFields: [],
      parsingWarnings
    };
  }

  return emptyRoleResult(assignment.role, assignment.status);
}

function emptyRoleResult(role: DispatchRole, fallbackStatus: DispatchRoleStatus): DispatchRoleResult {
  return {
    role,
    status: fallbackStatus === "active" ? "active" : "pending",
    summary: "No role output captured yet.",
    validations: [],
    risks: [],
    agreements: [],
    conflicts: [],
    touchedFiles: [],
    nextSteps: [],
    sourcePaths: [],
    sourceKind: "missing",
    missingFields: [],
    parsingWarnings: []
  };
}

function invalidRoleResult(assignment: DispatchRoleAssignment, sourcePath: string, parsingWarnings: string[]): DispatchRoleResult {
  return {
    role: assignment.role,
    status: "blocked",
    summary: `Structured role output for ${assignment.role} is invalid and needs manual cleanup.`,
    validations: [],
    risks: ["invalid structured role output"],
    agreements: [],
    conflicts: [],
    touchedFiles: [],
    nextSteps: ["Repair the structured role result file and rerun collect."],
    sourcePaths: [sourcePath],
    sourceKind: "invalid",
    missingFields: [],
    parsingWarnings
  };
}

function buildStructuredRoleResult(
  assignment: DispatchRoleAssignment,
  payload: StructuredRolePayload,
  sourcePath: string,
  sourceKind: Extract<DispatchRoleResultSource, "structured-json" | "structured-frontmatter">
): DispatchRoleResult {
  const missingFields = STRUCTURED_ROLE_FIELDS.filter((field) => {
    if (field === "validations") {
      return stringArrayField(payload.validations) === undefined && stringArrayField(payload.validationsRun) === undefined;
    }
    if (field === "risks") {
      return (
        stringArrayField(payload.risks) === undefined &&
        stringArrayField(payload.warnings) === undefined &&
        stringArrayField(payload.openIssues) === undefined
      );
    }
    if (field === "touched_files") {
      return stringArrayField(payload.touched_files) === undefined && stringArrayField(payload.touchedFiles) === undefined;
    }
    if (field === "next_steps") {
      return stringArrayField(payload.next_steps) === undefined && stringArrayField(payload.nextSteps) === undefined;
    }
    return payload[field] === undefined;
  });
  const parsingWarnings = missingFields.length > 0 ? [`missing structured fields: ${missingFields.join(", ")}`] : [];

  return {
    role: parseRole(payload.role, assignment.role),
    status: parseRoleStatus(payload.status, "complete"),
    summary: stringField(payload.summary) ?? `Structured result captured for ${assignment.role}.`,
    validations: stringArrayField(payload.validations) ?? stringArrayField(payload.validationsRun) ?? [],
    risks: stringArrayField(payload.risks) ?? stringArrayField(payload.warnings) ?? stringArrayField(payload.openIssues) ?? [],
    agreements: stringArrayField(payload.agreements) ?? [],
    conflicts: stringArrayField(payload.conflicts) ?? [],
    touchedFiles: stringArrayField(payload.touched_files) ?? stringArrayField(payload.touchedFiles) ?? [],
    nextSteps: stringArrayField(payload.next_steps) ?? stringArrayField(payload.nextSteps) ?? [],
    sourcePaths: [sourcePath],
    sourceKind,
    missingFields,
    parsingWarnings
  };
}

function parseRole(value: unknown, fallback: DispatchRole): DispatchRole {
  if (value === "planner" || value === "implementer" || value === "reviewer" || value === "tester") {
    return value;
  }
  return fallback;
}

function parseRoleStatus(value: unknown, fallback: DispatchRoleStatus): DispatchRoleStatus {
  if (value === "pending" || value === "active" || value === "complete" || value === "blocked") {
    return value;
  }
  return fallback;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArrayField(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

function extractFrontmatter(content: string): { body: string; remainder: string } | null {
  if (!content.startsWith("---\n")) {
    return null;
  }
  const closingIndex = content.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return null;
  }
  return {
    body: content.slice(4, closingIndex),
    remainder: content.slice(closingIndex + 5).trim()
  };
}

function extractMarkdownSummary(content: string): string | undefined {
  const line = content
    .split("\n")
    .map((item) => item.trim())
    .find((item) => Boolean(item) && !item.startsWith("#") && !item.startsWith("<!--") && !item.startsWith("- validation:") && !item.startsWith("- risk:"));
  return line;
}

function extractTaggedLines(content: string, tag: "validation" | "risk" | "agreement" | "conflict" | "touched_file" | "next_step"): string[] {
  const prefix = `${tag}:`;
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      const normalized = line.replace(/^-+\s*/, "").toLowerCase();
      return normalized.startsWith(prefix);
    })
    .map((line) => line.replace(/^-+\s*/, "").slice(prefix.length).trim());
}
