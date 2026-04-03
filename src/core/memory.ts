import path from "node:path";
import type { ProjectType } from "./config.js";
import type { ActiveRoleHintsRecord } from "./state.js";
import { normalizeMcpPack, type McpPackId } from "./recommendations.js";
import { ensureDir, pathExists, readJson, writeText } from "../utils/fs.js";

export interface RepoFactsRecord {
  artifactType: "shrey-junior/repo-facts";
  version: 1;
  updatedAt: string;
  projectName: string;
  projectType: ProjectType | string;
  profile: string;
  authoritySource: string;
  activeRole: string;
  recommendedMcpPack: McpPackId;
}

export interface CurrentFocusRecord {
  artifactType: "shrey-junior/current-focus";
  version: 1;
  updatedAt: string;
  currentFocus: string;
  focusOwnerRole: string;
  nextRecommendedSpecialist: string;
  nextSuggestedMcpPack: McpPackId;
  nextFileToRead: string;
  nextSuggestedCommand: string;
  latestCheckpoint: string | null;
  latestTaskPacket: string | null;
  latestHandoff: string | null;
  latestDispatchManifest: string | null;
  latestReconcile: string | null;
}

export interface OpenRisksRecord {
  artifactType: "shrey-junior/open-risks";
  version: 1;
  updatedAt: string;
  source: string;
  risks: string[];
}

export function getMemoryPaths(targetRoot: string): {
  root: string;
  repoFacts: string;
  architectureDecisions: string;
  domainGlossary: string;
  currentFocus: string;
  openRisks: string;
  knownGotchas: string;
  lastSuccessfulPatterns: string;
} {
  const root = path.join(targetRoot, ".agent", "memory");
  return {
    root,
    repoFacts: path.join(root, "repo-facts.json"),
    architectureDecisions: path.join(root, "architecture-decisions.md"),
    domainGlossary: path.join(root, "domain-glossary.md"),
    currentFocus: path.join(root, "current-focus.json"),
    openRisks: path.join(root, "open-risks.json"),
    knownGotchas: path.join(root, "known-gotchas.md"),
    lastSuccessfulPatterns: path.join(root, "last-successful-patterns.md")
  };
}

export async function ensureMemoryLayout(targetRoot: string): Promise<ReturnType<typeof getMemoryPaths>> {
  const paths = getMemoryPaths(targetRoot);
  await ensureDir(paths.root);
  return paths;
}

export async function loadCurrentFocus(targetRoot: string): Promise<CurrentFocusRecord | null> {
  const paths = getMemoryPaths(targetRoot);
  if (!(await pathExists(paths.currentFocus))) {
    return null;
  }
  return readJson<CurrentFocusRecord>(paths.currentFocus);
}

export async function loadOpenRisks(targetRoot: string): Promise<OpenRisksRecord | null> {
  const paths = getMemoryPaths(targetRoot);
  if (!(await pathExists(paths.openRisks))) {
    return null;
  }
  return readJson<OpenRisksRecord>(paths.openRisks);
}

export async function syncCurrentFocusFromActiveHints(targetRoot: string, hints: ActiveRoleHintsRecord): Promise<string> {
  const paths = await ensureMemoryLayout(targetRoot);
  const current = (await loadCurrentFocus(targetRoot)) ?? {
    artifactType: "shrey-junior/current-focus" as const,
    version: 1,
    updatedAt: new Date().toISOString(),
    currentFocus: hints.nextAction,
    focusOwnerRole: hints.activeRole,
    nextRecommendedSpecialist: hints.nextRecommendedSpecialist,
    nextSuggestedMcpPack: normalizeMcpPack(hints.nextSuggestedMcpPack),
    nextFileToRead: hints.nextFileToRead,
    nextSuggestedCommand: hints.nextSuggestedCommand,
    latestCheckpoint: hints.latestCheckpoint,
    latestTaskPacket: hints.latestTaskPacket,
    latestHandoff: hints.latestHandoff,
    latestDispatchManifest: hints.latestDispatchManifest,
    latestReconcile: hints.latestReconcile
  };

  const next: CurrentFocusRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    currentFocus: hints.nextAction || current.currentFocus,
    focusOwnerRole: hints.activeRole,
    nextRecommendedSpecialist: hints.nextRecommendedSpecialist || current.nextRecommendedSpecialist,
    nextSuggestedMcpPack: normalizeMcpPack(hints.nextSuggestedMcpPack || current.nextSuggestedMcpPack),
    nextFileToRead: hints.nextFileToRead || current.nextFileToRead,
    nextSuggestedCommand: hints.nextSuggestedCommand || current.nextSuggestedCommand,
    latestCheckpoint: hints.latestCheckpoint ?? current.latestCheckpoint,
    latestTaskPacket: hints.latestTaskPacket ?? current.latestTaskPacket,
    latestHandoff: hints.latestHandoff ?? current.latestHandoff,
    latestDispatchManifest: hints.latestDispatchManifest ?? current.latestDispatchManifest,
    latestReconcile: hints.latestReconcile ?? current.latestReconcile
  };

  await writeText(paths.currentFocus, `${JSON.stringify(next, null, 2)}\n`);
  return paths.currentFocus;
}

export async function writeOpenRisksRecord(targetRoot: string, source: string, risks: string[]): Promise<string> {
  const paths = await ensureMemoryLayout(targetRoot);
  const next: OpenRisksRecord = {
    artifactType: "shrey-junior/open-risks",
    version: 1,
    updatedAt: new Date().toISOString(),
    source,
    risks: [...new Set(risks.filter((risk) => Boolean(risk.trim())))]
  };
  await writeText(paths.openRisks, `${JSON.stringify(next, null, 2)}\n`);
  return paths.openRisks;
}
