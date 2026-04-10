import path from "node:path";
import type { FileArea, LoadedConfig, TaskType, ToolName } from "./config.js";
import { getMemoryPaths, type RepoFactsRecord } from "./memory.js";
import {
  getMcpPackDefinition,
  listMcpPacks,
  normalizeMcpPack,
  recommendMcpPack,
  type McpPackDefinition,
  type McpPackId
} from "./recommendations.js";
import { listAvailableMcpCapabilities, listEligibleMcpCapabilities, type McpCapability } from "./specialists.js";
import { loadCurrentPhase } from "./state.js";
import { getRuntimePackSelectionStatus } from "../runtime/client.js";
import { ensureDir, pathExists, readJson, readText, writeText } from "../utils/fs.js";

type PackSelectionSource = "runtime-explicit" | "heuristic-default";

interface McpPackPolicy {
  allowedCapabilityIds: string[];
  preferredCapabilityIds: string[];
  unavailableCapabilityIds: string[];
  executable: boolean;
  unavailableReason?: string;
}

export interface ResolvedMcpPackCatalogEntry extends McpPackDefinition {
  executable: boolean;
  unavailablePackReason: string | null;
  allowedCapabilityIds: string[];
  preferredCapabilityIds: string[];
  unavailableCapabilityIds: string[];
}

export interface ResolvedMcpPackState {
  explicitSelection: string | null;
  heuristicPackId: McpPackId;
  selectedPackId: McpPackId;
  selectedPack: McpPackDefinition;
  suggestedPack: McpPackDefinition;
  selectedPackSource: PackSelectionSource;
  executable: boolean;
  unavailablePackReason: string | null;
  allowedCapabilityIds: string[];
  preferredCapabilityIds: string[];
  unavailableCapabilityIds: string[];
  effectiveCapabilities: McpCapability[];
  effectiveCapabilityIds: string[];
  availablePacks: ResolvedMcpPackCatalogEntry[];
  note: string;
}

export interface SelectedPackArtifact {
  artifactType: "kiwi-control/selected-pack";
  version: 1;
  updatedAt: string;
  targetRoot: string;
  selectedPack: string;
  selectedPackSource: PackSelectionSource;
  explicitSelection: string | null;
  heuristicPackId: string;
  executable: boolean;
  unavailablePackReason: string | null;
  effectiveCapabilityIds: string[];
  preferredCapabilityIds: string[];
  unavailableCapabilityIds: string[];
  availablePacks: Array<{
    id: string;
    executable: boolean;
    unavailablePackReason: string | null;
  }>;
}

export interface PackSelectionArtifactData {
  selectedPack: string;
  selectedPackSource: PackSelectionSource;
  explicitSelection: string | null;
  heuristicPackId: string;
  executable: boolean;
  unavailablePackReason: string | null;
  effectiveCapabilityIds: string[];
  preferredCapabilityIds: string[];
  unavailableCapabilityIds: string[];
  availablePacks: Array<{
    id: string;
    executable: boolean;
    unavailablePackReason: string | null;
  }>;
}

const PACK_POLICIES: Record<McpPackId, McpPackPolicy> = {
  "core-pack": {
    allowedCapabilityIds: ["filesystem", "context7", "github", "sequential-thinking"],
    preferredCapabilityIds: ["filesystem", "context7", "github"],
    unavailableCapabilityIds: [],
    executable: true
  },
  "research-pack": {
    allowedCapabilityIds: ["exa", "firecrawl", "brave-search", "context7", "sequential-thinking", "github"],
    preferredCapabilityIds: ["exa", "firecrawl", "brave-search", "context7", "sequential-thinking"],
    unavailableCapabilityIds: [],
    executable: true
  },
  "web-qa-pack": {
    allowedCapabilityIds: ["playwright", "figma", "cloudflare-docs", "github", "context7"],
    preferredCapabilityIds: ["playwright", "figma", "cloudflare-docs"],
    unavailableCapabilityIds: [],
    executable: true
  },
  "aws-pack": {
    allowedCapabilityIds: ["aws-docs", "aws-cdk", "aws-cli"],
    preferredCapabilityIds: ["aws-cdk", "aws-docs", "aws-cli"],
    unavailableCapabilityIds: ["aws-docs", "aws-cdk", "aws-cli"],
    executable: false,
    unavailableReason: "AWS Pack is blocked because this repo does not register any AWS-specific MCP or tool integrations in the current registry/inventory."
  },
  "ios-pack": {
    allowedCapabilityIds: ["xcode", "simulator", "apple-docs"],
    preferredCapabilityIds: ["xcode", "simulator", "apple-docs"],
    unavailableCapabilityIds: ["xcode", "simulator", "apple-docs"],
    executable: false,
    unavailableReason: "iOS Pack is blocked because this repo does not register any Xcode or simulator integrations in the current registry/inventory."
  },
  "android-pack": {
    allowedCapabilityIds: ["android-studio", "emulator", "adb"],
    preferredCapabilityIds: ["android-studio", "emulator", "adb"],
    unavailableCapabilityIds: ["android-studio", "emulator", "adb"],
    executable: false,
    unavailableReason: "Android Pack is blocked because this repo does not register any Android-specific MCP or emulator integrations in the current registry/inventory."
  }
};

const SELECTED_PACK_ARTIFACT_PATH = ".agent/state/selected-pack.json";

export async function resolveEffectiveMcpPackState(options: {
  targetRoot: string;
  config: LoadedConfig;
  profileName: string;
  projectType?: string;
  taskType?: TaskType;
  fileArea?: FileArea;
  authorityFiles?: string[];
  starterMcpHints?: string[];
  activeSpecialistId?: string;
  tool?: ToolName;
}): Promise<ResolvedMcpPackState> {
  const runtimeSelection = await getRuntimePackSelectionStatus(options.targetRoot).catch(() => null);
  const heuristicPackId = await resolveHeuristicPackId(options);
  const explicitSelection = runtimeSelection?.selectedPackId ? normalizeMcpPack(runtimeSelection.selectedPackId) : null;
  const selectedPackId = explicitSelection ?? heuristicPackId;
  const selectedPackSource: PackSelectionSource = explicitSelection ? "runtime-explicit" : "heuristic-default";
  const availableCapabilities = listAvailableMcpCapabilities({
    config: options.config,
    profileName: options.profileName,
    ...(options.tool ? { tool: options.tool } : {})
  });
  const specialistCompatibleIds = new Set(
    options.activeSpecialistId
      ? listEligibleMcpCapabilities({
          config: options.config,
          profileName: options.profileName,
          specialistId: options.activeSpecialistId,
          ...(options.tool ? { tool: options.tool } : {})
        }).map((entry) => entry.id)
      : []
  );

  const selectedPolicy = resolvePackPolicy(selectedPackId, availableCapabilities);
  const effectiveCapabilities = selectedPolicy.executable
    ? sortPackCapabilities(
        availableCapabilities.filter((capability) => selectedPolicy.allowedCapabilityIds.includes(capability.id)),
        selectedPolicy.preferredCapabilityIds,
        specialistCompatibleIds
      )
    : [];
  const effectiveCapabilityIds = effectiveCapabilities.map((entry) => entry.id);
  const selectedPack = getMcpPackDefinition(selectedPackId);
  const suggestedPack = getMcpPackDefinition(heuristicPackId);

  const availablePacks = resolveMcpPackCatalog({
    config: options.config,
    profileName: options.profileName,
    ...(options.tool ? { tool: options.tool } : {})
  });

  return {
    explicitSelection,
    heuristicPackId,
    selectedPackId,
    selectedPack,
    suggestedPack,
    selectedPackSource,
    executable: selectedPolicy.executable,
    unavailablePackReason: selectedPolicy.unavailablePackReason,
    allowedCapabilityIds: selectedPolicy.allowedCapabilityIds,
    preferredCapabilityIds: selectedPolicy.preferredCapabilityIds,
    unavailableCapabilityIds: selectedPolicy.unavailableCapabilityIds,
    effectiveCapabilities,
    effectiveCapabilityIds,
    availablePacks,
    note: buildPackNote(
      selectedPack,
      selectedPackSource,
      selectedPolicy.executable,
      selectedPolicy.unavailablePackReason,
      effectiveCapabilityIds.length
    )
  };
}

export function resolveMcpPackCatalog(options: {
  config: LoadedConfig;
  profileName: string;
  tool?: ToolName;
}): ResolvedMcpPackCatalogEntry[] {
  const availableCapabilities = listAvailableMcpCapabilities({
    config: options.config,
    profileName: options.profileName,
    ...(options.tool ? { tool: options.tool } : {})
  });
  return listMcpPacks().map((pack) => {
    const policy = resolvePackPolicy(pack.id, availableCapabilities);
    return {
      ...pack,
      executable: policy.executable,
      unavailablePackReason: policy.unavailablePackReason,
      allowedCapabilityIds: policy.allowedCapabilityIds,
      preferredCapabilityIds: policy.preferredCapabilityIds,
      unavailableCapabilityIds: policy.unavailableCapabilityIds
    };
  });
}

export function selectedPackArtifactPath(targetRoot: string): string {
  return path.join(targetRoot, SELECTED_PACK_ARTIFACT_PATH);
}

export function packSelectionArtifactFragment(selection: PackSelectionArtifactData): Omit<SelectedPackArtifact, "artifactType" | "version" | "updatedAt" | "targetRoot"> {
  return {
    selectedPack: selection.selectedPack,
    selectedPackSource: selection.selectedPackSource,
    explicitSelection: selection.explicitSelection,
    heuristicPackId: selection.heuristicPackId,
    executable: selection.executable,
    unavailablePackReason: selection.unavailablePackReason,
    effectiveCapabilityIds: selection.effectiveCapabilityIds,
    preferredCapabilityIds: selection.preferredCapabilityIds,
    unavailableCapabilityIds: selection.unavailableCapabilityIds,
    availablePacks: selection.availablePacks
  };
}

export async function persistSelectedPackArtifact(
  targetRoot: string,
  selection: PackSelectionArtifactData
): Promise<string> {
  const outputPath = selectedPackArtifactPath(targetRoot);
  const payload: SelectedPackArtifact = {
    artifactType: "kiwi-control/selected-pack",
    version: 1,
    updatedAt: new Date().toISOString(),
    targetRoot,
    ...packSelectionArtifactFragment(selection)
  };
  if (await pathExists(outputPath)) {
    const current = await readJson<SelectedPackArtifact>(outputPath).catch(() => null);
    if (current && equalPackSelectionSemanticState(current, payload)) {
      return outputPath;
    }
  }
  const nextContent = `${JSON.stringify(payload, null, 2)}\n`;
  await ensureDir(path.dirname(outputPath));
  await writeText(outputPath, nextContent);
  return outputPath;
}

export async function annotatePackSelectionArtifacts(
  targetRoot: string,
  selection: PackSelectionArtifactData
): Promise<void> {
  await persistSelectedPackArtifact(targetRoot, selection);
  await annotateArtifactIfPresent(path.join(targetRoot, ".agent", "context", "agent-pack.json"), selection);
  await annotateArtifactIfPresent(path.join(targetRoot, ".agent", "context", "repo-map.json"), selection);
}

async function annotateArtifactIfPresent(filePath: string, selection: PackSelectionArtifactData): Promise<void> {
  if (!(await pathExists(filePath))) {
    return;
  }
  const current = await readJson<Record<string, unknown>>(filePath).catch(() => null);
  if (!current || typeof current !== "object") {
    return;
  }
  const next = {
    ...current,
    packSelection: packSelectionArtifactFragment(selection)
  };
  const nextContent = `${JSON.stringify(next, null, 2)}\n`;
  const currentContent = await readText(filePath);
  if (currentContent === nextContent) {
    return;
  }
  await writeText(filePath, nextContent);
}

async function resolveHeuristicPackId(options: {
  targetRoot: string;
  projectType?: string;
  taskType?: TaskType;
  fileArea?: FileArea;
  authorityFiles?: string[];
  starterMcpHints?: string[];
}): Promise<McpPackId> {
  const [projectType, taskType, fileArea] = await Promise.all([
    resolveProjectType(options.targetRoot, options.projectType),
    resolveTaskType(options.targetRoot, options.taskType),
    resolveFileArea(options.targetRoot, options.fileArea)
  ]);
  return recommendMcpPack({
    projectType,
    ...(taskType ? { taskType } : {}),
    ...(fileArea ? { fileArea } : {}),
    ...(options.starterMcpHints?.length ? { starterMcpHints: options.starterMcpHints } : {}),
    ...(options.authorityFiles?.length ? { authorityFiles: options.authorityFiles } : {})
  });
}

async function resolveProjectType(targetRoot: string, projectType?: string): Promise<string> {
  if (projectType?.trim()) {
    return projectType;
  }
  const repoFactsPath = getMemoryPaths(targetRoot).repoFacts;
  if (await pathExists(repoFactsPath)) {
    const repoFacts = await readJson<RepoFactsRecord>(repoFactsPath).catch(() => null);
    if (repoFacts?.projectType) {
      return repoFacts.projectType;
    }
  }
  return "generic";
}

async function resolveTaskType(targetRoot: string, taskType?: TaskType): Promise<TaskType | undefined> {
  if (taskType) {
    return taskType;
  }
  const currentPhase = await loadCurrentPhase(targetRoot).catch(() => null);
  return currentPhase?.routingSummary.taskType;
}

async function resolveFileArea(targetRoot: string, fileArea?: FileArea): Promise<FileArea | undefined> {
  if (fileArea) {
    return fileArea;
  }
  const currentPhase = await loadCurrentPhase(targetRoot).catch(() => null);
  return currentPhase?.routingSummary.fileArea;
}

function resolvePackPolicy(packId: McpPackId, availableCapabilities: McpCapability[]): {
  executable: boolean;
  unavailablePackReason: string | null;
  allowedCapabilityIds: string[];
  preferredCapabilityIds: string[];
  unavailableCapabilityIds: string[];
} {
  const policy = PACK_POLICIES[packId];
  const availableIds = new Set(availableCapabilities.map((entry) => entry.id));
  const missingAllowed = policy.allowedCapabilityIds.filter((id) => !availableIds.has(id));
  const executable = policy.executable && policy.allowedCapabilityIds.some((id) => availableIds.has(id));
  const unavailablePackReason = !policy.executable
    ? policy.unavailableReason ?? "This pack is blocked until matching integrations are registered."
    : executable
      ? null
      : "This pack does not currently expose any mapped integrations for the active repo profile.";
  return {
    executable,
    unavailablePackReason,
    allowedCapabilityIds: policy.allowedCapabilityIds,
    preferredCapabilityIds: policy.preferredCapabilityIds,
    unavailableCapabilityIds: uniqueStrings([...policy.unavailableCapabilityIds, ...missingAllowed])
  };
}

function sortPackCapabilities(
  capabilities: McpCapability[],
  preferredCapabilityIds: string[],
  specialistCompatibleIds: Set<string>
): McpCapability[] {
  const preferredRanks = new Map(preferredCapabilityIds.map((id, index) => [id, index]));
  return [...capabilities].sort((left, right) => {
    const preferredDelta = (preferredRanks.has(left.id) ? 0 : 1) - (preferredRanks.has(right.id) ? 0 : 1);
    if (preferredDelta !== 0) {
      return preferredDelta;
    }
    const preferredRankDelta = (preferredRanks.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (preferredRanks.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (preferredRankDelta !== 0) {
      return preferredRankDelta;
    }
    const specialistDelta = Number(specialistCompatibleIds.has(right.id)) - Number(specialistCompatibleIds.has(left.id));
    if (specialistDelta !== 0) {
      return specialistDelta;
    }
    const trustDelta = trustWeight(right.trustLevel) - trustWeight(left.trustLevel);
    if (trustDelta !== 0) {
      return trustDelta;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildPackNote(
  pack: McpPackDefinition,
  selectedPackSource: PackSelectionSource,
  executable: boolean,
  unavailablePackReason: string | null,
  effectiveCapabilityCount: number
): string {
  if (!executable) {
    return `${pack.name} is not selectable yet. ${unavailablePackReason ?? "Matching MCP integrations are not registered."}`;
  }
  const sourceLabel = selectedPackSource === "runtime-explicit" ? "explicit runtime selection" : "heuristic default";
  return `${pack.name} is active via ${sourceLabel}. ${effectiveCapabilityCount} MCP integration(s) match this pack policy.`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function equalPackSelectionSemanticState(
  left: SelectedPackArtifact,
  right: SelectedPackArtifact
): boolean {
  return JSON.stringify({
    artifactType: left.artifactType,
    version: left.version,
    targetRoot: left.targetRoot,
    selectedPack: left.selectedPack,
    selectedPackSource: left.selectedPackSource,
    explicitSelection: left.explicitSelection,
    heuristicPackId: left.heuristicPackId,
    executable: left.executable,
    unavailablePackReason: left.unavailablePackReason,
    effectiveCapabilityIds: left.effectiveCapabilityIds,
    preferredCapabilityIds: left.preferredCapabilityIds,
    unavailableCapabilityIds: left.unavailableCapabilityIds,
    availablePacks: left.availablePacks
  }) === JSON.stringify({
    artifactType: right.artifactType,
    version: right.version,
    targetRoot: right.targetRoot,
    selectedPack: right.selectedPack,
    selectedPackSource: right.selectedPackSource,
    explicitSelection: right.explicitSelection,
    heuristicPackId: right.heuristicPackId,
    executable: right.executable,
    unavailablePackReason: right.unavailablePackReason,
    effectiveCapabilityIds: right.effectiveCapabilityIds,
    preferredCapabilityIds: right.preferredCapabilityIds,
    unavailableCapabilityIds: right.unavailableCapabilityIds,
    availablePacks: right.availablePacks
  });
}

function trustWeight(trustLevel: McpCapability["trustLevel"]): number {
  switch (trustLevel) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}
