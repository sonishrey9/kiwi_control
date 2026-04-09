import path from "node:path";
import type { ChangeSize, ExecutionMode, FileArea, LoadedConfig, RoutingProfile, TaskType } from "./config.js";
import type { RiskLevel } from "./risk.js";
import type { InstructionConflict } from "./conflicts.js";
import { detectInstructionConflicts } from "./conflicts.js";
import type { ProjectOverlay } from "./profiles.js";
import { promises as fs } from "node:fs";
import { listEligibleMcpCapabilities } from "./specialists.js";
import { pathExists, readText } from "../utils/fs.js";
import { isMetadataOnlyPath, isSensitivePath } from "../utils/redact.js";
import { parseYaml } from "../utils/yaml.js";

export interface ContextSourceSummary {
  path: string;
  kind: "authority" | "context" | "repo-doc" | "linked-doc";
  summary: string;
}

export interface CompiledContext {
  targetRoot: string;
  profileName: string;
  executionMode: ExecutionMode;
  taskType: TaskType;
  fileArea: FileArea;
  changeSize: ChangeSize;
  riskLevel: RiskLevel;
  specialistId?: string;
  authorityOrder: string[];
  promotedAuthorityDocs: string[];
  sources: ContextSourceSummary[];
  repoContextSummary: string;
  validationSteps: string[];
  stableContracts: string[];
  keyBoundaryFiles: string[];
  releaseCriticalSurfaces: string[];
  riskyAreas: string[];
  allowedScope: string[];
  forbiddenScope: string[];
  completionCriteria: string[];
  outputFormat: string[];
  escalationConditions: string[];
  conflicts: InstructionConflict[];
  eligibleMcpServers: string[];
  eligibleMcpCapabilities: Array<{
    id: string;
    purpose: string;
    trustLevel: "low" | "medium" | "high";
    readOnly: boolean;
    approvalRequired: boolean;
  }>;
}

interface SourceContent {
  path: string;
  kind: ContextSourceSummary["kind"];
  content: string;
}

const MAX_SOURCE_CONTEXT_CHARS = 8_000;
const SOURCE_CHUNK_TARGET_CHARS = 1_600;
const SOURCE_RULE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bdo not\b/i,
  /\bnever\b/i,
  /\bmust\b/i,
  /\brequired\b/i,
  /\bsource of truth\b/i,
  /\bmachine-local\b/i,
  /\bgenerated outputs?\b/i,
  /\bglobal tool settings?\b/i,
  /\bvalidation\b/i,
  /\bverify\b/i,
  /\bchecks?\b/i,
  /\bcanonical\b/i
];

export async function compileRepoContext(options: {
  targetRoot: string;
  config: LoadedConfig;
  profileName: string;
  profile: RoutingProfile;
  overlay: ProjectOverlay | null;
  executionMode: ExecutionMode;
  taskType: TaskType;
  fileArea: FileArea;
  changeSize: ChangeSize;
  riskLevel: RiskLevel;
  specialistId?: string;
}): Promise<CompiledContext> {
  const sourceContents = await collectSourceContents(options.targetRoot, options.config);
  const conflicts = detectInstructionConflicts(
    sourceContents.map((source) => ({ path: source.path, content: source.content }))
  );
  const sources = sourceContents.map((source) => ({
    path: source.path,
    kind: source.kind,
    summary: summarizeSource(source.path, source.content)
  }));
  const authorityOrder = buildAuthorityOrder(options.targetRoot, options.config, sourceContents);
  const promotedAuthorityDocs = sourceContents
    .filter((source) => source.kind === "linked-doc")
    .map((source) => source.path);
  const validationSteps = await collectValidationSteps(options.targetRoot);
  const forbiddenScope = [
    ...options.config.guardrails.forbidden_scope.default,
    ...(options.config.guardrails.forbidden_scope[options.profileName] ?? [])
  ];
  const allowedScope = buildAllowedScope(options.taskType, options.fileArea, options.executionMode);
  const completionCriteria = buildCompletionCriteria(options.riskLevel);
  const outputFormat = buildOutputFormat(options.taskType);
  const escalationConditions = buildEscalationConditions(options.riskLevel, conflicts, options.profile);
  const repoContextSummary = buildRepoContextSummary(sources);
  const repoSignals = await collectRepoSignals(options.targetRoot, options.specialistId);
  const eligibleMcpCapabilities = options.specialistId
    ? listEligibleMcpCapabilities({
        config: options.config,
        profileName: options.profileName,
        specialistId: options.specialistId
      })
    : Object.entries(options.config.mcpServers.mcpServers)
        .filter(([, server]) => server.allowedProfiles.includes(options.profileName))
        .map(([name, server]) => ({
          id: server.id ?? name,
          purpose: server.purpose,
          trustLevel: server.trustLevel,
          readOnly: server.readOnly ?? server.referenceOnly,
          approvalRequired: server.approvalRequired ?? false
        }));
  const eligibleMcpServers = eligibleMcpCapabilities.map((capability) => capability.id).sort();

  return {
    targetRoot: options.targetRoot,
    profileName: options.profileName,
    executionMode: options.executionMode,
    taskType: options.taskType,
    fileArea: options.fileArea,
    changeSize: options.changeSize,
    riskLevel: options.riskLevel,
    ...(options.specialistId ? { specialistId: options.specialistId } : {}),
    authorityOrder,
    promotedAuthorityDocs,
    sources,
    repoContextSummary,
    validationSteps,
    stableContracts: repoSignals.stableContracts,
    keyBoundaryFiles: repoSignals.keyBoundaryFiles,
    releaseCriticalSurfaces: repoSignals.releaseCriticalSurfaces,
    riskyAreas: repoSignals.riskyAreas,
    allowedScope,
    forbiddenScope,
    completionCriteria,
    outputFormat,
    escalationConditions,
    conflicts,
    eligibleMcpServers,
    eligibleMcpCapabilities
  };
}

async function collectSourceContents(targetRoot: string, config: LoadedConfig): Promise<SourceContent[]> {
  const candidates: Array<{ relativePath: string; kind: ContextSourceSummary["kind"] }> = [
    { relativePath: "AGENTS.md", kind: "authority" },
    { relativePath: "CLAUDE.md", kind: "authority" },
    { relativePath: ".github/copilot-instructions.md", kind: "authority" },
    { relativePath: ".agent/project.yaml", kind: "authority" },
    { relativePath: ".agent/checks.yaml", kind: "authority" },
    { relativePath: ".agent/context/context-tree.json", kind: "context" },
    { relativePath: ".agent/context/agent-pack.json", kind: "context" },
    { relativePath: ".agent/context/task-pack.json", kind: "context" },
    { relativePath: ".agent/context/repo-map.json", kind: "context" },
    { relativePath: ".agent/context/compact-context-pack.json", kind: "context" },
    { relativePath: ".agent/context/review-context-pack.json", kind: "context" },
    { relativePath: ".agent/state/context-tree.json", kind: "context" },
    { relativePath: ".agent/memory/repo-facts.json", kind: "context" },
    { relativePath: ".agent/memory/current-focus.json", kind: "context" },
    { relativePath: ".agent/memory/open-risks.json", kind: "context" },
    { relativePath: "README.md", kind: "repo-doc" },
    { relativePath: "docs/architecture.md", kind: "repo-doc" },
    { relativePath: "docs/conventions.md", kind: "repo-doc" },
    { relativePath: "docs/runbooks.md", kind: "repo-doc" }
  ];
  const contents: SourceContent[] = [];

  for (const candidate of candidates) {
    const fullPath = path.join(targetRoot, candidate.relativePath);
    if (!(await pathExists(fullPath))) {
      continue;
    }
    if (isSensitivePath(fullPath) || isMetadataOnlyPath(fullPath)) {
      continue;
    }
    const content = extractRelevantSourceContent(fullPath, await readText(fullPath));
    if (!content.trim()) {
      continue;
    }
    contents.push({ path: fullPath, kind: candidate.kind, content });
  }

  for (const relativePath of config.global.defaults.authority_files ?? []) {
    const fullPath = path.join(targetRoot, relativePath);
    if (!(await pathExists(fullPath)) || contents.some((entry) => entry.path === fullPath)) {
      continue;
    }
    if (isSensitivePath(fullPath) || isMetadataOnlyPath(fullPath)) {
      continue;
    }
    const content = extractRelevantSourceContent(fullPath, await readText(fullPath));
    if (!content.trim()) {
      continue;
    }
    contents.push({ path: fullPath, kind: "authority", content });
  }

  const linkedDocs = await collectPromotedDocs(targetRoot, contents);
  for (const linkedDoc of linkedDocs) {
    if (contents.some((entry) => entry.path === linkedDoc.path)) {
      continue;
    }
    contents.push(linkedDoc);
  }

  for (const dynamicSource of await collectDirectoryMarkdownContents(targetRoot, [
    ".github/instructions",
    ".github/agents",
    ".agent/roles"
  ])) {
    if (contents.some((entry) => entry.path === dynamicSource.path)) {
      continue;
    }
    contents.push(dynamicSource);
  }

  return contents;
}

function buildAuthorityOrder(targetRoot: string, config: LoadedConfig, sourceContents: SourceContent[]): string[] {
  const configured = (config.global.defaults.authority_files ?? [])
    .map((relativePath) => path.join(targetRoot, relativePath))
    .filter((fullPath) => sourceContents.some((source) => source.path === fullPath));
  const linkedDocs = sourceContents
    .filter((source) => source.kind === "linked-doc")
    .map((source) => source.path);
  const contextFiles = sourceContents
    .filter((source) => source.kind === "context")
    .map((source) => source.path);
  const repoDocs = sourceContents
    .filter((source) => source.kind === "repo-doc")
    .map((source) => source.path);
  return [...configured, ...linkedDocs, ...contextFiles, ...repoDocs];
}

function summarizeSource(filePath: string, content: string): string {
  if (filePath.endsWith(".yaml")) {
    try {
      const parsed = parseYaml<Record<string, unknown>>(content);
      if (typeof parsed.profile === "string") {
        return `profile ${parsed.profile}`;
      }
      if (Array.isArray(parsed.checks)) {
        const names = parsed.checks
          .map((check) => (typeof check === "object" && check && "name" in check ? String((check as { name: string }).name) : "check"))
          .slice(0, 4);
        return `checks: ${names.join(", ")}`;
      }
    } catch {
      return "yaml context";
    }
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith("#") && !line.startsWith("<!--") && !line.startsWith("```"));
  return (lines[0] ?? "repo guidance").slice(0, 180);
}

function extractRelevantSourceContent(filePath: string, rawContent: string): string {
  const normalized = rawContent.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const chunks = buildSourceChunks(filePath, normalized);
  if (chunks.length === 0) {
    return normalized;
  }

  if (chunks.length === 1 && chunks[0]!.length <= MAX_SOURCE_CONTEXT_CHARS) {
    return chunks[0]!;
  }

  const selectedIndexes = new Set<number>();
  let usedChars = 0;

  const scoredChunks = chunks.map((chunk, index) => ({
    index,
    score: scoreSourceChunk(chunk, index, chunks.length)
  }));

  const tryAddChunk = (index: number): void => {
    if (selectedIndexes.has(index)) {
      return;
    }

    const chunk = chunks[index];
    if (!chunk) {
      return;
    }

    if (usedChars > 0 && usedChars + chunk.length > MAX_SOURCE_CONTEXT_CHARS) {
      return;
    }

    selectedIndexes.add(index);
    usedChars += chunk.length;
  };

  tryAddChunk(0);
  tryAddChunk(chunks.length - 1);

  for (const candidate of scoredChunks.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return left.index - right.index;
  })) {
    tryAddChunk(candidate.index);
  }

  if (selectedIndexes.size === 0) {
    return chunks[0]!;
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => chunks[index]!)
    .join("\n\n");
}

function buildSourceChunks(filePath: string, content: string): string[] {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".md" || extension === ".mdx") {
    return splitMarkdownSections(content);
  }

  return splitGenericChunks(content);
}

function splitMarkdownSections(content: string): string[] {
  const lines = content.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  const flushCurrent = (): void => {
    if (current.length === 0) {
      return;
    }
    const section = current.join("\n").trim();
    if (section) {
      sections.push(...splitLargeChunk(section));
    }
    current = [];
  };

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line) && current.length > 0) {
      flushCurrent();
    }
    current.push(line);
  }

  flushCurrent();
  return sections;
}

function splitGenericChunks(content: string): string[] {
  const blocks = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;
    if (candidate.length <= SOURCE_CHUNK_TARGET_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(...splitLargeChunk(current));
    }
    current = trimmed;
  }

  if (current) {
    chunks.push(...splitLargeChunk(current));
  }

  return chunks;
}

function splitLargeChunk(chunk: string): string[] {
  if (chunk.length <= SOURCE_CHUNK_TARGET_CHARS) {
    return [chunk];
  }

  const pieces: string[] = [];
  const lines = chunk.split("\n");
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= SOURCE_CHUNK_TARGET_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      pieces.push(current.trim());
    }

    if (line.length <= SOURCE_CHUNK_TARGET_CHARS) {
      current = line;
      continue;
    }

    for (let start = 0; start < line.length; start += SOURCE_CHUNK_TARGET_CHARS) {
      pieces.push(line.slice(start, start + SOURCE_CHUNK_TARGET_CHARS).trim());
    }
    current = "";
  }

  if (current.trim()) {
    pieces.push(current.trim());
  }

  return pieces.filter(Boolean);
}

function scoreSourceChunk(chunk: string, index: number, totalChunks: number): number {
  let score = 0;

  if (index === 0) {
    score += 4;
  }
  if (index === totalChunks - 1) {
    score += 5;
  }
  if (/^#{1,6}\s+/m.test(chunk)) {
    score += 1;
  }
  if (/(?:docs|\.agent\/context)\/[A-Za-z0-9._/-]+\.md/.test(chunk)) {
    score += 3;
  }

  for (const pattern of SOURCE_RULE_PATTERNS) {
    if (pattern.test(chunk)) {
      score += 2;
    }
  }

  return score;
}

function buildRepoContextSummary(sources: ContextSourceSummary[]): string {
  if (sources.length === 0) {
    return "No repo-local authority files were found yet. Use the canonical templates and the selected profile defaults.";
  }

  const promoted = sources
    .filter((source) => source.kind === "linked-doc")
    .slice(0, 2)
    .map((source) => `- canonical doc: ${path.basename(source.path)}: ${source.summary}`);
  const primary = sources
    .filter((source) => source.kind !== "linked-doc")
    .slice(0, 4)
    .map((source) => `- ${path.basename(source.path)}: ${source.summary}`)
    .join("\n");
  return [...promoted, primary].filter((item) => Boolean(item)).join("\n");
}

async function collectRepoSignals(targetRoot: string, specialistId?: string): Promise<{
  stableContracts: string[];
  keyBoundaryFiles: string[];
  releaseCriticalSurfaces: string[];
  riskyAreas: string[];
}> {
  const stableContractCandidates = [
    "docs/agent-shared.md",
    "docs/contracts.md",
    "openapi.yaml",
    "openapi.yml",
    "schema.graphql",
    "AGENTS.md",
    "CLAUDE.md"
  ];
  const boundaryCandidates = [
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "apps/api",
    "src/api",
    "app/api",
    "infra",
    ".github/workflows"
  ];
  const releaseCandidates = [
    "package.json",
    "pyproject.toml",
    "Dockerfile",
    "docker-compose.yml",
    "render.yaml",
    ".github/workflows",
    "infra"
  ];

  const stableContracts = await filterExistingPaths(targetRoot, stableContractCandidates);
  const keyBoundaryFiles = await filterExistingPaths(targetRoot, boundaryCandidates);
  const releaseCriticalSurfaces = await filterExistingPaths(targetRoot, releaseCandidates);

  const riskyAreas = specialistId === "security-specialist"
    ? await filterExistingPaths(targetRoot, ["infra", ".github/workflows", "src/api", "apps/api", "config"])
    : specialistId === "release-specialist" || specialistId === "push-specialist"
      ? await filterExistingPaths(targetRoot, ["package.json", ".github/workflows", "infra", "Dockerfile"])
      : specialistId === "python-specialist"
        ? await filterExistingPaths(targetRoot, ["pyproject.toml", "requirements.txt", "src", "tests"])
        : keyBoundaryFiles.slice(0, 4);

  return {
    stableContracts,
    keyBoundaryFiles,
    releaseCriticalSurfaces,
    riskyAreas
  };
}

async function filterExistingPaths(targetRoot: string, candidates: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const candidate of candidates) {
    const fullPath = path.join(targetRoot, candidate);
    if (await pathExists(fullPath)) {
      existing.push(fullPath);
      continue;
    }
  }

  if (existing.length === 0) {
    const topLevelEntries = await safeReadDir(targetRoot);
    for (const entry of topLevelEntries) {
      if (["src", "app", "apps", "docs", "tests", "infra"].includes(entry)) {
        existing.push(path.join(targetRoot, entry));
      }
    }
  }

  return existing.slice(0, 8);
}

async function safeReadDir(targetRoot: string): Promise<string[]> {
  try {
    return await fs.readdir(targetRoot);
  } catch {
    return [];
  }
}

async function collectDirectoryMarkdownContents(targetRoot: string, relativeDirs: string[]): Promise<SourceContent[]> {
  const contents: SourceContent[] = [];
  for (const relativeDir of relativeDirs) {
    const fullDir = path.join(targetRoot, relativeDir);
    if (!(await pathExists(fullDir))) {
      continue;
    }

    const entries = await safeReadDir(fullDir);
    for (const entry of entries) {
      if (!entry.endsWith(".md") || entry.startsWith("._")) {
        continue;
      }
      const fullPath = path.join(fullDir, entry);
      if (isSensitivePath(fullPath) || isMetadataOnlyPath(fullPath)) {
        continue;
      }
      const content = extractRelevantSourceContent(fullPath, await readText(fullPath));
      if (!content.trim()) {
        continue;
      }
      contents.push({
        path: fullPath,
        kind: "context",
        content
      });
    }
  }
  return contents;
}

async function collectValidationSteps(targetRoot: string): Promise<string[]> {
  const checksPath = path.join(targetRoot, ".agent", "checks.yaml");
  if (!(await pathExists(checksPath))) {
    return [
      "validate canonical configs load",
      "keep managed markers stable",
      "run the smallest relevant repo checks",
      "report any skipped verification"
    ];
  }

  try {
    const parsed = parseYaml<{ checks?: Array<{ name?: string; description?: string }> }>(await readText(checksPath));
    const checks = parsed.checks ?? [];
    if (checks.length === 0) {
      throw new Error("no checks");
    }
    return checks.map((check) => check.description || check.name || "repo-defined check");
  } catch {
    return [
      "validate canonical configs load",
      "keep managed markers stable",
      "run the smallest relevant repo checks",
      "report any skipped verification"
    ];
  }
}

function buildAllowedScope(taskType: TaskType, fileArea: FileArea, executionMode: ExecutionMode): string[] {
  const scope = [
    "files directly required for the requested goal",
    "repo-local instruction surfaces managed by shrey-junior",
    "validation files and tests needed to prove the change"
  ];

  if (fileArea === "docs" || taskType === "docs") {
    scope.push("documentation and context files needed for the requested update");
  }

  if (executionMode === "inline") {
    scope.push("small local edits that stay within one narrow area");
  }

  return scope;
}

function buildCompletionCriteria(riskLevel: RiskLevel): string[] {
  const criteria = [
    "goal satisfied with the smallest safe diff",
    "managed marker ownership remains intact",
    "relevant validation steps were run or explicitly skipped with a reason",
    "remaining risks are reported clearly"
  ];

  if (riskLevel === "high") {
    criteria.push("planner and reviewer escalation requirements are satisfied");
  }

  return criteria;
}

function buildOutputFormat(taskType: TaskType): string[] {
  const common = ["summary", "files changed or reviewed", "validation run", "remaining risks or blockers"];
  if (taskType === "review") {
    return ["findings first", "file references", "residual risks", "approval or follow-up recommendation"];
  }
  if (taskType === "planning") {
    return ["scope", "assumptions", "sequenced plan", "validation plan", "escalations"];
  }
  return common;
}

function buildEscalationConditions(
  riskLevel: RiskLevel,
  conflicts: InstructionConflict[],
  profile: RoutingProfile
): string[] {
  const conditions = [
    "goal requires global config mutation",
    "secret-bearing or metadata-only files would need to be ingested directly",
    "managed block ownership is ambiguous",
    "instruction surfaces disagree about authority or safety rules"
  ];

  if (riskLevel === "high") {
    conditions.push(`high-risk work must include: ${profile.packet.high_risk_required_roles.join(", ")}`);
  }

  if (conflicts.length > 0) {
    conditions.push("resolve or explicitly acknowledge context conflicts before implementation");
  }

  return conditions;
}

async function collectPromotedDocs(targetRoot: string, sources: SourceContent[]): Promise<SourceContent[]> {
  const promotedDocs: SourceContent[] = [];
  for (const source of sources.filter((entry) => entry.kind === "authority")) {
    const relativeCandidates = extractCanonicalDocReferences(source.content);
    for (const relativeCandidate of relativeCandidates) {
      const normalized = relativeCandidate.replace(/^\.?\//, "");
      const fullPath = path.join(targetRoot, normalized);
      if (
        promotedDocs.some((entry) => entry.path === fullPath) ||
        sources.some((entry) => entry.path === fullPath) ||
        !(await pathExists(fullPath)) ||
        isSensitivePath(fullPath) ||
        isMetadataOnlyPath(fullPath)
      ) {
        continue;
      }
      const content = extractRelevantSourceContent(fullPath, await readText(fullPath));
      if (!content.trim()) {
        continue;
      }
      promotedDocs.push({
        path: fullPath,
        kind: "linked-doc",
        content
      });
    }
  }
  return promotedDocs;
}

function extractCanonicalDocReferences(content: string): string[] {
  const matches = content.match(/(?:`|^|\s)(\.?\/?(?:docs|\.agent\/context)\/[A-Za-z0-9._/-]+\.md)(?:`|$|\s)/gm) ?? [];
  const cleaned = matches
    .map((match) => match.replace(/[`]/g, "").trim())
    .map((match) => match.replace(/^[^\w./-]+/, "").replace(/[^\w./-]+$/, ""))
    .filter((match) => match.endsWith(".md"));
  return [...new Set(cleaned)];
}
