import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import {
  clearRuntimePackSelection,
  getRuntimePackSelectionStatus,
  setRuntimePackSelection,
} from "@shrey-junior/sj-core/runtime/client.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { syncPackSelectionSideEffects } from "./helpers/pack-selection.js";

export interface PackOptions {
  repoRoot: string;
  targetRoot: string;
  action: "status" | "set" | "clear";
  packId?: string;
  profileName?: string;
  json?: boolean;
  logger: Logger;
}

export async function runPack(options: PackOptions): Promise<number> {
  const before = await getRuntimePackSelectionStatus(options.targetRoot).catch(() => ({
    targetRoot: options.targetRoot,
    selectedPackId: null,
    selectedPackSource: null,
    updatedAt: null
  }));

  if (options.action === "set") {
    const requestedPackId = options.packId?.trim();
    if (!requestedPackId) {
      throw new Error("pack set requires a pack id.");
    }
    const { controlState: preflightState } = await syncPackSelectionSideEffects({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { profileName: options.profileName } : {}),
      persist: false
    });
    const requestedEntry = preflightState.mcpPacks.available.find((entry) => entry.id === requestedPackId);
    if (!requestedEntry) {
      throw new Error(`unknown pack id: ${requestedPackId}`);
    }
    if (!requestedEntry.executable) {
      return emitPackResult(
        options,
        preflightState,
        false,
        false,
        requestedEntry.unavailablePackReason ?? `${requestedPackId} is not selectable in this repo.`
      );
    }
    if (before.selectedPackId === requestedPackId) {
      return emitPackResult(
        options,
        preflightState,
        true,
        false,
        null
      );
    }
    await setRuntimePackSelection({
      targetRoot: options.targetRoot,
      packId: requestedPackId,
      selectionSource: "runtime-explicit",
      triggerCommand: `kiwi-control pack set ${requestedPackId}`,
      actor: process.env.KIWI_CONTROL_COMMAND_SOURCE ?? process.env.SHREY_JUNIOR_COMMAND_SOURCE ?? "cli"
    });
    const { controlState: refreshed } = await syncPackSelectionSideEffects({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { profileName: options.profileName } : {})
    });
    return emitPackResult(
      options,
      refreshed,
      true,
      before.selectedPackId !== requestedPackId,
      null
    );
  }

  if (options.action === "clear") {
    if (before.selectedPackId === null) {
      const { controlState } = await syncPackSelectionSideEffects({
        repoRoot: options.repoRoot,
        targetRoot: options.targetRoot,
        ...(options.profileName ? { profileName: options.profileName } : {}),
        persist: false
      });
      return emitPackResult(options, controlState, true, false, null);
    }
    await clearRuntimePackSelection({
      targetRoot: options.targetRoot,
      triggerCommand: "kiwi-control pack clear",
      actor: process.env.KIWI_CONTROL_COMMAND_SOURCE ?? process.env.SHREY_JUNIOR_COMMAND_SOURCE ?? "cli"
    });
    const { controlState: refreshed } = await syncPackSelectionSideEffects({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { profileName: options.profileName } : {})
    });
    return emitPackResult(
      options,
      refreshed,
      true,
      before.selectedPackId !== null,
      null
    );
  }

  const { controlState } = await syncPackSelectionSideEffects({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {}),
    persist: false
  });
  return emitPackResult(options, controlState, true, false, null);
}

function emitPackResult(
  options: PackOptions,
  controlState: Awaited<ReturnType<typeof buildRepoControlState>>,
  ok: boolean,
  changed: boolean,
  error: string | null
): number {
  const selectedEntry = controlState.mcpPacks.available.find((entry) => entry.id === controlState.mcpPacks.selectedPack.id);
  const payload = {
    ok,
    changed,
    targetRoot: options.targetRoot,
    selectedPack: controlState.mcpPacks.selectedPack.id,
    selectedPackSource: controlState.mcpPacks.selectedPackSource,
    explicitSelection: controlState.mcpPacks.explicitSelection,
    heuristicPackId: controlState.mcpPacks.suggestedPack.id,
    executable: controlState.mcpPacks.executable,
    unavailablePackReason: error ?? controlState.mcpPacks.unavailablePackReason,
    effectiveCapabilityIds: controlState.mcpPacks.effectiveCapabilityIds,
    preferredCapabilityIds: controlState.mcpPacks.preferredCapabilityIds,
    unavailableCapabilityIds: selectedEntry?.unavailableCapabilityIds ?? [],
    executionRevision: controlState.executionState.revision,
    availablePacks: controlState.mcpPacks.available.map((entry) => ({
      id: entry.id,
      name: entry.name,
      executable: entry.executable,
      unavailablePackReason: entry.unavailablePackReason,
      allowedCapabilityIds: entry.allowedCapabilityIds,
      preferredCapabilityIds: entry.preferredCapabilityIds,
      unavailableCapabilityIds: entry.unavailableCapabilityIds
    })),
    note: controlState.mcpPacks.note,
    artifactPaths: {
      selectedPack: ".agent/state/selected-pack.json",
      readySubstrate: ".agent/state/ready-substrate.json",
      agentPack: ".agent/context/agent-pack.json",
      repoMap: ".agent/context/repo-map.json"
    },
    ...(error ? { error } : {})
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
  } else {
    options.logger.info(
      [
        `pack: ${payload.selectedPack} [${payload.selectedPackSource}]`,
        `executable: ${payload.executable ? "yes" : "no"}`,
        `effective capabilities: ${payload.effectiveCapabilityIds.join(", ") || "none"}`,
        payload.unavailablePackReason ? `blocked: ${payload.unavailablePackReason}` : `note: ${payload.note}`
      ].join("\n")
    );
  }

  return ok ? 0 : 1;
}
