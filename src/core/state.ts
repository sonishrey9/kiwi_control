import path from "node:path";
import { promises as fs } from "node:fs";
import type { ChangeSize, ExecutionMode, FileArea, TaskType, ToolName } from "./config.js";
import {
  buildBootstrapNextAction,
  buildBootstrapNextFileToRead,
  buildBootstrapNextSuggestedCommand,
  buildChecksToRun,
  buildSearchGuidance,
  buildStopConditions,
  type SearchGuidance
} from "./guidance.js";
import { loadCurrentFocus, syncCurrentFocusFromActiveHints } from "./memory.js";
import type { CurrentFocusRecord } from "./memory.js";
import { normalizeMcpPack } from "./recommendations.js";
import { ensureDir, isIgnoredArtifactName, pathExists, readJson, relativeFrom, slugify, writeText } from "../utils/fs.js";

export type PhaseStatus = "in-progress" | "complete" | "blocked";

export interface PhaseRoutingSummary {
  taskType: TaskType;
  primaryTool: ToolName;
  reviewTool: ToolName;
  riskLevel: "low" | "medium" | "high";
  fileArea: FileArea;
  changeSize: ChangeSize;
  requiredRoles: string[];
}

export interface ChangedFilesSummary {
  isGitRepo: boolean;
  branch?: string;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  changedFiles: string[];
}

export interface PhaseRecord {
  artifactType: "shrey-junior/current-phase";
  version: 3;
  timestamp: string;
  phaseId: string;
  label: string;
  goal: string;
  profile: string;
  mode: ExecutionMode;
  tool?: ToolName;
  status: PhaseStatus;
  routingSummary: PhaseRoutingSummary;
  authorityFiles: string[];
  changedFilesSummary?: ChangedFilesSummary;
  validationsRun: string[];
  warnings: string[];
  openIssues: string[];
  latestMemoryFocus: string;
  nextRecommendedSpecialist: string;
  nextSuggestedMcpPack: string;
  nextRecommendedStep: string;
  previousTool?: ToolName;
  previousPhaseId?: string;
}

export interface ActiveRoleHintsRecord {
  artifactType: "shrey-junior/active-role-hints";
  version: 2;
  updatedAt: string;
  activeRole: string;
  supportingRoles: string[];
  authoritySource: string;
  projectType: string;
  readNext: string[];
  nextFileToRead: string;
  nextSuggestedCommand: string;
  writeTargets: string[];
  checksToRun: string[];
  stopConditions: string[];
  nextAction: string;
  nextRecommendedSpecialist: string;
  nextSuggestedMcpPack: string;
  searchGuidance: SearchGuidance;
  latestMemoryFocus: string | null;
  latestCheckpoint: string | null;
  latestTaskPacket: string | null;
  latestHandoff: string | null;
  latestDispatchManifest: string | null;
  latestReconcile: string | null;
}

export interface CheckpointDirtyState {
  isGitRepo: boolean;
  clean: boolean;
  branch?: string;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
}

export interface CheckpointTaskContext {
  goal: string;
  taskType: TaskType;
  fileArea: FileArea;
  changeSize: ChangeSize;
  riskLevel: "low" | "medium" | "high";
  primaryTool?: ToolName;
  reviewTool?: ToolName;
}

export interface CheckpointRecord {
  artifactType: "shrey-junior/checkpoint";
  schemaVersion: 1;
  createdAt: string;
  checkpointId: string;
  phase: string;
  activeRole: string;
  supportingRoles: string[];
  authoritySource: string;
  summary: string;
  taskContext: CheckpointTaskContext;
  filesTouched: string[];
  filesCreated: string[];
  filesDeleted: string[];
  checksRun: string[];
  checksPassed: string[];
  checksFailed: string[];
  gitBranch: string | null;
  gitCommitBefore: string | null;
  gitCommitAfter: string | null;
  dirtyState: CheckpointDirtyState;
  stagedFiles: string[];
  relatedTaskPacket: string | null;
  relatedHandoff: string | null;
  relatedReconcile: string | null;
  latestMemoryFocus: string | null;
  nextRecommendedSpecialist: string;
  nextSuggestedMcpPack: string;
  nextRecommendedAction: string;
  nextSuggestedCommand: string;
}

export interface HandoffRecord {
  artifactType: "shrey-junior/handoff";
  version: 2;
  createdAt: string;
  toTool: ToolName;
  fromRole: string;
  toRole: string;
  taskId: string;
  fromPhaseId?: string;
  previousTool?: ToolName;
  summary: string;
  goal: string;
  profile: string;
  mode: ExecutionMode;
  workCompleted: string[];
  filesTouched: string[];
  checksRun: string[];
  checksPassed: string[];
  checksFailed: string[];
  evidence: string[];
  openQuestions: string[];
  risks: string[];
  nextFile: string;
  nextCommand: string;
  recommendedMcpPack: string;
  checkpointPointer: string | null;
  readFirst: string[];
  writeTargets: string[];
  checksToRun: string[];
  stopConditions: string[];
  searchGuidance: SearchGuidance;
  whatChanged: string[];
  validationsPending: string[];
  risksRemaining: string[];
  latestCheckpoint?: string;
  checkpointSummary?: string;
  nextStep: string;
  status: "ready" | "blocked";
}

export interface PacketDirectorySummary {
  name: string;
  relativePath: string;
  fileCount: number;
}

export interface LatestTaskPacketSet {
  artifactType: "shrey-junior/latest-task-packets";
  version: number;
  createdAt: string;
  packetSet: string;
  files: string[];
}

export interface ContinuitySnapshot {
  latestPhase: PhaseRecord | null;
  latestHandoff: HandoffRecord | null;
  latestCheckpoint: CheckpointRecord | null;
  currentFocus: CurrentFocusRecord | null;
}

export function getStatePaths(targetRoot: string): {
  root: string;
  currentPhase: string;
  activeRoleHints: string;
  historyDir: string;
  checkpointsDir: string;
  latestCheckpointJson: string;
  latestCheckpointMarkdown: string;
  handoffDir: string;
  latestTaskPackets: string;
} {
  const root = path.join(targetRoot, ".agent", "state");
  return {
    root,
    currentPhase: path.join(root, "current-phase.json"),
    activeRoleHints: path.join(root, "active-role-hints.json"),
    historyDir: path.join(root, "history"),
    checkpointsDir: path.join(root, "checkpoints"),
    latestCheckpointJson: path.join(root, "checkpoints", "latest.json"),
    latestCheckpointMarkdown: path.join(root, "checkpoints", "latest.md"),
    handoffDir: path.join(root, "handoff"),
    latestTaskPackets: path.join(root, "latest-task-packets.json")
  };
}

export async function ensureStateLayout(targetRoot: string): Promise<ReturnType<typeof getStatePaths>> {
  const paths = getStatePaths(targetRoot);
  await ensureDir(paths.historyDir);
  await ensureDir(paths.checkpointsDir);
  await ensureDir(paths.handoffDir);
  return paths;
}

export function buildPhaseId(label: string, timestamp: string): string {
  const compactTimestamp = timestamp.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return `${compactTimestamp}-${slugify(label)}`;
}

export async function writePhaseRecord(targetRoot: string, record: PhaseRecord): Promise<{ currentPhasePath: string; historyPath: string }> {
  const paths = await ensureStateLayout(targetRoot);
  const payload = `${JSON.stringify(record, null, 2)}\n`;
  const historyPath = path.join(paths.historyDir, `${record.phaseId}.json`);
  await writeText(paths.currentPhase, payload);
  await writeText(historyPath, payload);
  return {
    currentPhasePath: paths.currentPhase,
    historyPath
  };
}

export async function loadCurrentPhase(targetRoot: string): Promise<PhaseRecord | null> {
  const paths = getStatePaths(targetRoot);
  if (!(await pathExists(paths.currentPhase))) {
    return null;
  }
  return readJson<PhaseRecord>(paths.currentPhase);
}

export async function loadActiveRoleHints(targetRoot: string): Promise<ActiveRoleHintsRecord | null> {
  const paths = getStatePaths(targetRoot);
  if (!(await pathExists(paths.activeRoleHints))) {
    return null;
  }
  return readJson<ActiveRoleHintsRecord>(paths.activeRoleHints);
}

export async function writeActiveRoleHints(targetRoot: string, record: ActiveRoleHintsRecord): Promise<string> {
  const paths = await ensureStateLayout(targetRoot);
  await writeText(paths.activeRoleHints, `${JSON.stringify(record, null, 2)}\n`);
  await syncCurrentFocusFromActiveHints(targetRoot, record);
  return paths.activeRoleHints;
}

export async function updateActiveRoleHints(
  targetRoot: string,
  patch: Partial<ActiveRoleHintsRecord> & Pick<ActiveRoleHintsRecord, "activeRole" | "authoritySource" | "projectType">
): Promise<string> {
  const current = (await loadActiveRoleHints(targetRoot)) ?? {
    artifactType: "shrey-junior/active-role-hints" as const,
    version: 2,
    updatedAt: new Date().toISOString(),
    activeRole: patch.activeRole,
    supportingRoles: [],
    authoritySource: patch.authoritySource,
    projectType: patch.projectType,
    readNext: [
      ".agent/state/current-phase.json",
      ".agent/state/checkpoints/latest.json",
      ".agent/context/commands.md",
      ".agent/context/tool-capabilities.md",
      ".agent/context/mcp-capabilities.md",
      ".agent/context/architecture.md",
      ".agent/checks.yaml",
      ".agent/project.yaml"
    ],
    nextFileToRead: buildBootstrapNextFileToRead(),
    nextSuggestedCommand: buildBootstrapNextSuggestedCommand(),
    writeTargets: [".agent/tasks/*", ".agent/state/current-phase.json", ".agent/state/handoff/*"],
    checksToRun: buildChecksToRun(),
    stopConditions: buildStopConditions(),
    nextAction: buildBootstrapNextAction(),
    nextRecommendedSpecialist: patch.activeRole,
    nextSuggestedMcpPack: "core-pack",
    searchGuidance: buildSearchGuidance({
      projectType: patch.projectType
    }),
    latestMemoryFocus: ".agent/memory/current-focus.json",
    latestCheckpoint: null,
    latestTaskPacket: null,
    latestHandoff: null,
    latestDispatchManifest: null,
    latestReconcile: null
  };

  const next: ActiveRoleHintsRecord = {
    ...current,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
    supportingRoles: patch.supportingRoles ?? current.supportingRoles,
    readNext: patch.readNext ?? current.readNext,
    nextFileToRead: patch.nextFileToRead ?? current.nextFileToRead,
    nextSuggestedCommand: patch.nextSuggestedCommand ?? current.nextSuggestedCommand,
    writeTargets: patch.writeTargets ?? current.writeTargets,
    checksToRun: patch.checksToRun ?? current.checksToRun,
    stopConditions: patch.stopConditions ?? current.stopConditions,
    nextAction: patch.nextAction ?? current.nextAction,
    nextRecommendedSpecialist: patch.nextRecommendedSpecialist ?? current.nextRecommendedSpecialist,
    nextSuggestedMcpPack: patch.nextSuggestedMcpPack ? normalizeMcpPack(patch.nextSuggestedMcpPack) : current.nextSuggestedMcpPack,
    searchGuidance: patch.searchGuidance ?? current.searchGuidance,
    latestMemoryFocus: patch.latestMemoryFocus ?? current.latestMemoryFocus ?? ".agent/memory/current-focus.json",
    latestCheckpoint: patch.latestCheckpoint ?? current.latestCheckpoint
  };
  return writeActiveRoleHints(targetRoot, next);
}

export async function loadLatestCheckpoint(targetRoot: string): Promise<CheckpointRecord | null> {
  const paths = getStatePaths(targetRoot);
  if (!(await pathExists(paths.latestCheckpointJson))) {
    return null;
  }
  return readJson<CheckpointRecord>(paths.latestCheckpointJson);
}

export async function writeCheckpointArtifacts(targetRoot: string, record: CheckpointRecord): Promise<{
  jsonPath: string;
  latestJsonPath: string;
  latestMarkdownPath: string;
}> {
  const paths = await ensureStateLayout(targetRoot);
  const jsonPath = path.join(paths.checkpointsDir, `${record.checkpointId}.json`);
  const latestJsonPath = paths.latestCheckpointJson;
  const latestMarkdownPath = paths.latestCheckpointMarkdown;
  const jsonPayload = `${JSON.stringify(record, null, 2)}\n`;
  const markdown = renderCheckpointMarkdown(record);
  await writeText(jsonPath, jsonPayload);
  await writeText(latestJsonPath, jsonPayload);
  await writeText(latestMarkdownPath, markdown);

  const activeRoleHints = await loadActiveRoleHints(targetRoot);
  if (activeRoleHints) {
    await updateActiveRoleHints(targetRoot, {
      activeRole: activeRoleHints.activeRole,
      authoritySource: activeRoleHints.authoritySource,
      projectType: activeRoleHints.projectType,
      supportingRoles: activeRoleHints.supportingRoles,
      latestCheckpoint: relativeFrom(targetRoot, latestJsonPath)
    });
  }

  return {
    jsonPath,
    latestJsonPath,
    latestMarkdownPath
  };
}

export async function loadLatestHandoff(targetRoot: string, toTool?: ToolName): Promise<HandoffRecord | null> {
  const paths = getStatePaths(targetRoot);
  if (!(await pathExists(paths.handoffDir))) {
    return null;
  }

  const latestPath = path.join(paths.handoffDir, "latest.json");
  if (!toTool && (await pathExists(latestPath))) {
    return readJson<HandoffRecord>(latestPath);
  }

  const entries = await fs.readdir(paths.handoffDir);
  const candidates = entries
    .filter((entry) => entry.endsWith(".json") && !isIgnoredArtifactName(entry))
    .sort()
    .reverse();

  for (const entry of candidates) {
    const fullPath = path.join(paths.handoffDir, entry);
    const record = await readJson<HandoffRecord>(fullPath);
    if (!toTool || record.toTool === toTool) {
      return record;
    }
  }

  return null;
}

export async function writeHandoffArtifacts(
  targetRoot: string,
  baseName: string,
  handoff: HandoffRecord,
  markdown: string,
  brief: string
): Promise<{ markdownPath: string; jsonPath: string; briefPath: string }> {
  const paths = await ensureStateLayout(targetRoot);
  const markdownPath = path.join(paths.handoffDir, `${baseName}.md`);
  const jsonPath = path.join(paths.handoffDir, `${baseName}.json`);
  const briefPath = path.join(paths.handoffDir, `${baseName}.brief.md`);
  const latestMarkdownPath = path.join(paths.handoffDir, "latest.md");
  const latestJsonPath = path.join(paths.handoffDir, "latest.json");
  const latestBriefPath = path.join(paths.handoffDir, "latest.brief.md");
  await writeText(markdownPath, markdown);
  await writeText(jsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
  await writeText(briefPath, brief);
  await writeText(latestMarkdownPath, markdown);
  await writeText(latestJsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
  await writeText(latestBriefPath, brief);
  const activeRoleHints = await loadActiveRoleHints(targetRoot);
  if (activeRoleHints) {
    await updateActiveRoleHints(targetRoot, {
      activeRole: activeRoleHints.activeRole,
      authoritySource: activeRoleHints.authoritySource,
      projectType: activeRoleHints.projectType,
      supportingRoles: activeRoleHints.supportingRoles,
      latestHandoff: relativeFrom(targetRoot, latestJsonPath)
    });
  }
  return { markdownPath, jsonPath, briefPath };
}

export async function writeLatestTaskPacketSet(targetRoot: string, files: string[]): Promise<string | null> {
  if (files.length === 0) {
    return null;
  }

  const paths = await ensureStateLayout(targetRoot);
  const packetSet = path.dirname(files[0] ?? ".agent/tasks");
  const payload: LatestTaskPacketSet = {
    artifactType: "shrey-junior/latest-task-packets",
    version: 1,
    createdAt: new Date().toISOString(),
    packetSet,
    files
  };
  await writeText(paths.latestTaskPackets, `${JSON.stringify(payload, null, 2)}\n`);
  const activeRoleHints = await loadActiveRoleHints(targetRoot);
  if (activeRoleHints) {
    await updateActiveRoleHints(targetRoot, {
      activeRole: activeRoleHints.activeRole,
      authoritySource: activeRoleHints.authoritySource,
      projectType: activeRoleHints.projectType,
      supportingRoles: activeRoleHints.supportingRoles,
      latestTaskPacket: relativeFrom(targetRoot, paths.latestTaskPackets)
    });
  }
  return paths.latestTaskPackets;
}

export async function listTaskPacketDirectories(targetRoot: string): Promise<PacketDirectorySummary[]> {
  const taskRoot = path.join(targetRoot, ".agent", "tasks");
  if (!(await pathExists(taskRoot))) {
    return [];
  }

  const entries = await fs.readdir(taskRoot, { withFileTypes: true });
  const directories: PacketDirectorySummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || isIgnoredArtifactName(entry.name)) {
      continue;
    }
    const fullPath = path.join(taskRoot, entry.name);
    const fileEntries = await fs.readdir(fullPath, { withFileTypes: true });
    directories.push({
      name: entry.name,
      relativePath: relativeFrom(targetRoot, fullPath),
      fileCount: fileEntries.filter((fileEntry) => fileEntry.isFile() && fileEntry.name.endsWith(".md") && !isIgnoredArtifactName(fileEntry.name)).length
    });
  }

  return directories.sort((left, right) => right.name.localeCompare(left.name));
}

export async function loadLatestTaskPacketSet(targetRoot: string): Promise<LatestTaskPacketSet | null> {
  const paths = getStatePaths(targetRoot);
  if (!(await pathExists(paths.latestTaskPackets))) {
    return null;
  }
  return readJson<LatestTaskPacketSet>(paths.latestTaskPackets);
}

export async function loadContinuitySnapshot(targetRoot: string, toTool?: ToolName): Promise<ContinuitySnapshot> {
  return {
    latestPhase: await loadCurrentPhase(targetRoot),
    latestHandoff: await loadLatestHandoff(targetRoot, toTool),
    latestCheckpoint: await loadLatestCheckpoint(targetRoot),
    currentFocus: await loadCurrentFocus(targetRoot)
  };
}

export function parseCsvFlag(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => Boolean(item));
}

export function renderCheckpointMarkdown(record: CheckpointRecord): string {
  const lines = [
    `# Checkpoint ${record.phase}`,
    "",
    `Created: ${record.createdAt}`,
    `Active role: \`${record.activeRole}\``,
    `Authority source: \`${record.authoritySource}\``,
    ...(record.gitBranch ? [`Git branch: \`${record.gitBranch}\``] : ["Git branch: none"]),
    ...(record.gitCommitAfter ? [`Git commit: \`${record.gitCommitAfter}\``] : ["Git commit: none"]),
    "",
    "## Summary",
    "",
    `- ${record.summary}`,
    "",
    "## Task Context",
    "",
    `- goal: ${record.taskContext.goal}`,
    `- task type: \`${record.taskContext.taskType}\``,
    `- file area: \`${record.taskContext.fileArea}\``,
    `- change size: \`${record.taskContext.changeSize}\``,
    `- risk: \`${record.taskContext.riskLevel}\``,
    ...(record.taskContext.primaryTool ? [`- primary tool: \`${record.taskContext.primaryTool}\``] : []),
    ...(record.taskContext.reviewTool ? [`- review tool: \`${record.taskContext.reviewTool}\``] : []),
    "",
    "## Files",
    "",
    ...(record.filesTouched.length > 0 ? record.filesTouched.map((item) => `- touched: \`${item}\``) : ["- touched: none recorded"]),
    ...(record.filesCreated.length > 0 ? record.filesCreated.map((item) => `- created: \`${item}\``) : []),
    ...(record.filesDeleted.length > 0 ? record.filesDeleted.map((item) => `- deleted: \`${item}\``) : []),
    "",
    "## Checks",
    "",
    ...(record.checksRun.length > 0 ? record.checksRun.map((item) => `- ran: ${item}`) : ["- ran: none recorded"]),
    ...(record.checksPassed.length > 0 ? record.checksPassed.map((item) => `- passed: ${item}`) : []),
    ...(record.checksFailed.length > 0 ? record.checksFailed.map((item) => `- failed: ${item}`) : []),
    "",
    "## Next",
    "",
    `- next specialist: ${record.nextRecommendedSpecialist}`,
    `- suggested MCP pack: ${record.nextSuggestedMcpPack}`,
    ...(record.latestMemoryFocus ? [`- latest memory focus: \`${record.latestMemoryFocus}\``] : []),
    `- next action: ${record.nextRecommendedAction}`,
    `- next command: ${record.nextSuggestedCommand}`
  ];

  return `${lines.join("\n")}\n`;
}
