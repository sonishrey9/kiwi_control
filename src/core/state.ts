import path from "node:path";
import { promises as fs } from "node:fs";
import type { ChangeSize, ExecutionMode, FileArea, TaskType, ToolName } from "./config.js";
import {
  buildBootstrapNextAction,
  buildChecksToRun,
  buildSearchGuidance,
  buildStopConditions,
  type SearchGuidance
} from "./guidance.js";
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
  version: number;
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
  nextRecommendedStep: string;
  previousTool?: ToolName;
  previousPhaseId?: string;
}

export interface ActiveRoleHintsRecord {
  artifactType: "shrey-junior/active-role-hints";
  version: number;
  updatedAt: string;
  activeRole: string;
  supportingRoles: string[];
  authoritySource: string;
  projectType: string;
  readNext: string[];
  writeTargets: string[];
  checksToRun: string[];
  stopConditions: string[];
  nextAction: string;
  searchGuidance: SearchGuidance;
  latestTaskPacket: string | null;
  latestHandoff: string | null;
  latestDispatchManifest: string | null;
  latestReconcile: string | null;
}

export interface HandoffRecord {
  artifactType: "shrey-junior/handoff";
  version: number;
  createdAt: string;
  toTool: ToolName;
  fromPhaseId?: string;
  previousTool?: ToolName;
  summary: string;
  goal: string;
  profile: string;
  mode: ExecutionMode;
  readFirst: string[];
  writeTargets: string[];
  checksToRun: string[];
  stopConditions: string[];
  searchGuidance: SearchGuidance;
  whatChanged: string[];
  validationsPending: string[];
  risksRemaining: string[];
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
}

export function getStatePaths(targetRoot: string): {
  root: string;
  currentPhase: string;
  activeRoleHints: string;
  historyDir: string;
  handoffDir: string;
  latestTaskPackets: string;
} {
  const root = path.join(targetRoot, ".agent", "state");
  return {
    root,
    currentPhase: path.join(root, "current-phase.json"),
    activeRoleHints: path.join(root, "active-role-hints.json"),
    historyDir: path.join(root, "history"),
    handoffDir: path.join(root, "handoff"),
    latestTaskPackets: path.join(root, "latest-task-packets.json")
  };
}

export async function ensureStateLayout(targetRoot: string): Promise<ReturnType<typeof getStatePaths>> {
  const paths = getStatePaths(targetRoot);
  await ensureDir(paths.historyDir);
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
  return paths.activeRoleHints;
}

export async function updateActiveRoleHints(
  targetRoot: string,
  patch: Partial<ActiveRoleHintsRecord> & Pick<ActiveRoleHintsRecord, "activeRole" | "authoritySource" | "projectType">
): Promise<string> {
  const current = (await loadActiveRoleHints(targetRoot)) ?? {
    artifactType: "shrey-junior/active-role-hints" as const,
    version: 1,
    updatedAt: new Date().toISOString(),
    activeRole: patch.activeRole,
    supportingRoles: [],
    authoritySource: patch.authoritySource,
    projectType: patch.projectType,
    readNext: [".agent/state/current-phase.json", ".agent/checks.yaml", ".agent/project.yaml"],
    writeTargets: [".agent/tasks/*", ".agent/state/current-phase.json", ".agent/state/handoff/*"],
    checksToRun: buildChecksToRun(),
    stopConditions: buildStopConditions(),
    nextAction: buildBootstrapNextAction(),
    searchGuidance: buildSearchGuidance({
      projectType: patch.projectType
    }),
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
    writeTargets: patch.writeTargets ?? current.writeTargets,
    checksToRun: patch.checksToRun ?? current.checksToRun,
    stopConditions: patch.stopConditions ?? current.stopConditions,
    nextAction: patch.nextAction ?? current.nextAction,
    searchGuidance: patch.searchGuidance ?? current.searchGuidance
  };
  return writeActiveRoleHints(targetRoot, next);
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
    latestHandoff: await loadLatestHandoff(targetRoot, toTool)
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
