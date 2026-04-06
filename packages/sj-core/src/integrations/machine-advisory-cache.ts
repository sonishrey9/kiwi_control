import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists, readJson, writeText } from "../utils/fs.js";
import type {
  MachineAdvisorySectionName,
  MachineAdvisorySectionState,
  MachineAdvisoryState
} from "./machine-advisory.js";

export const MACHINE_ADVISORY_ARTIFACT_TYPE = "kiwi-control/machine-advisory" as const;
export const MACHINE_ADVISORY_VERSION = 3 as const;
export const MACHINE_ADVISORY_CACHE_TTL_MS = 60_000;

export function advisoryCachePath(homeRoot: string): string {
  return path.join(homeRoot, ".kiwi-control", "cache", "machine-advisory.json");
}

export async function writeMachineAdvisoryCache(homeRoot: string, advisory: MachineAdvisoryState): Promise<void> {
  const cachePath = advisoryCachePath(homeRoot);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await writeText(cachePath, `${JSON.stringify(advisory, null, 2)}\n`);
}

export async function loadMachineAdvisoryFromCache(
  homeRoot: string,
  now: Date,
  options: { forceStale?: boolean; note?: string } = {}
): Promise<MachineAdvisoryState | null> {
  const cached = await readCachedMachineAdvisory(homeRoot);
  if (!cached) {
    return null;
  }

  if (options.forceStale) {
    return {
      ...cached,
      stale: true,
      note: options.note ?? cached.note
    };
  }

  const age = now.getTime() - new Date(cached.updatedAt).getTime();
  if (age < MACHINE_ADVISORY_CACHE_TTL_MS && !cached.stale) {
    return { ...cached, stale: false };
  }

  return null;
}

export async function loadMachineAdvisorySectionFromCache(
  section: MachineAdvisorySectionName,
  homeRoot: string,
  now: Date
): Promise<{ section: MachineAdvisorySectionName; meta: MachineAdvisorySectionState; data: unknown } | null> {
  const cached = await readCachedMachineAdvisory(homeRoot);
  if (!cached) {
    return null;
  }

  const age = now.getTime() - new Date(cached.updatedAt).getTime();
  if (!Number.isFinite(age) || age < 0) {
    return null;
  }

  const advisory = age < MACHINE_ADVISORY_CACHE_TTL_MS && !cached.stale
    ? { ...cached, stale: false }
    : markMachineAdvisoryCached(cached, now);

  return sectionFromMachineAdvisory(section, advisory);
}

export function sectionFromMachineAdvisory(
  section: MachineAdvisorySectionName,
  advisory: MachineAdvisoryState
): { section: MachineAdvisorySectionName; meta: MachineAdvisorySectionState; data: unknown } {
  switch (section) {
    case "inventory":
      return { section, meta: advisory.sections.inventory, data: advisory.inventory };
    case "mcpInventory":
      return { section, meta: advisory.sections.mcpInventory, data: advisory.mcpInventory };
    case "optimizationLayers":
      return { section, meta: advisory.sections.optimizationLayers, data: advisory.optimizationLayers };
    case "setupPhases":
      return { section, meta: advisory.sections.setupPhases, data: advisory.setupPhases };
    case "configHealth":
      return { section, meta: advisory.sections.configHealth, data: advisory.configHealth };
    case "usage":
      return { section, meta: advisory.sections.usage, data: advisory.usage };
    case "guidance":
      return { section, meta: advisory.sections.guidance, data: advisory.guidance };
  }
}

export function markMachineAdvisoryCached(
  advisory: MachineAdvisoryState,
  now: Date,
  note = advisory.note
): MachineAdvisoryState {
  const updatedAt = advisory.updatedAt || now.toISOString();
  return {
    ...advisory,
    stale: true,
    note,
    sections: Object.fromEntries(
      Object.entries(advisory.sections ?? buildDefaultSectionState(updatedAt)).map(([key, value]) => [
        key,
        value.status === "partial"
          ? value
          : {
              ...value,
              status: "cached"
            }
      ])
    ) as Record<MachineAdvisorySectionName, MachineAdvisorySectionState>
  };
}

function buildDefaultSectionState(updatedAt: string): Record<MachineAdvisorySectionName, MachineAdvisorySectionState> {
  return {
    inventory: { status: "cached", updatedAt },
    mcpInventory: { status: "cached", updatedAt },
    optimizationLayers: { status: "cached", updatedAt },
    setupPhases: { status: "cached", updatedAt },
    configHealth: { status: "cached", updatedAt },
    usage: { status: "cached", updatedAt },
    guidance: { status: "cached", updatedAt }
  };
}

async function readCachedMachineAdvisory(homeRoot: string): Promise<MachineAdvisoryState | null> {
  const cachePath = advisoryCachePath(homeRoot);
  if (!(await pathExists(cachePath))) {
    return null;
  }
  try {
    const cached = await readJson<MachineAdvisoryState>(cachePath);
    if (cached.artifactType !== MACHINE_ADVISORY_ARTIFACT_TYPE || cached.version !== MACHINE_ADVISORY_VERSION) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}
