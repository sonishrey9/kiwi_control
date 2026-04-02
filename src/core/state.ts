import path from "node:path";
import { promises as fs } from "node:fs";
import type { ChangeSize, ExecutionMode, FileArea, TaskType, ToolName } from "./config.js";
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

export interface HandoffRecord {
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

export interface ContinuitySnapshot {
  latestPhase: PhaseRecord | null;
  latestHandoff: HandoffRecord | null;
}

export function getStatePaths(targetRoot: string): {
  root: string;
  currentPhase: string;
  historyDir: string;
  handoffDir: string;
} {
  const root = path.join(targetRoot, ".agent", "state");
  return {
    root,
    currentPhase: path.join(root, "current-phase.json"),
    historyDir: path.join(root, "history"),
    handoffDir: path.join(root, "handoff")
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

export async function loadLatestHandoff(targetRoot: string, toTool?: ToolName): Promise<HandoffRecord | null> {
  const paths = getStatePaths(targetRoot);
  if (!(await pathExists(paths.handoffDir))) {
    return null;
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
  await writeText(markdownPath, markdown);
  await writeText(jsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
  await writeText(briefPath, brief);
  return { markdownPath, jsonPath, briefPath };
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
