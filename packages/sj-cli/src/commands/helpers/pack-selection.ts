import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import { annotatePackSelectionArtifacts, type PackSelectionArtifactData } from "@shrey-junior/sj-core/core/mcp-pack-selection.js";
import { persistReadyRepoSubstrate } from "@shrey-junior/sj-core/core/ready-substrate.js";

export function packArtifactDataFromControlState(
  controlState: Awaited<ReturnType<typeof buildRepoControlState>>
): PackSelectionArtifactData {
  const selectedEntry = controlState.mcpPacks.available.find((entry) => entry.id === controlState.mcpPacks.selectedPack.id);
  return {
    selectedPack: controlState.mcpPacks.selectedPack.id,
    selectedPackSource: controlState.mcpPacks.selectedPackSource,
    explicitSelection: controlState.mcpPacks.explicitSelection,
    heuristicPackId: controlState.mcpPacks.suggestedPack.id,
    executable: controlState.mcpPacks.executable,
    unavailablePackReason: controlState.mcpPacks.unavailablePackReason,
    effectiveCapabilityIds: controlState.mcpPacks.effectiveCapabilityIds,
    preferredCapabilityIds: controlState.mcpPacks.preferredCapabilityIds,
    unavailableCapabilityIds: selectedEntry?.unavailableCapabilityIds ?? [],
    availablePacks: controlState.mcpPacks.available.map((entry) => ({
      id: entry.id,
      executable: entry.executable,
      unavailablePackReason: entry.unavailablePackReason
    }))
  };
}

export async function syncPackSelectionSideEffects(options: {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  persist?: boolean;
}): Promise<{
  controlState: Awaited<ReturnType<typeof buildRepoControlState>>;
  packSelection: PackSelectionArtifactData;
}> {
  const controlState = await buildRepoControlState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {}),
    machineAdvisoryOptions: { fastMode: true },
    readOnly: true
  });
  const packSelection = packArtifactDataFromControlState(controlState);
  if (options.persist !== false) {
    await annotatePackSelectionArtifacts(options.targetRoot, packSelection);
    await persistReadyRepoSubstrate(options.targetRoot, packSelection).catch(() => null);
  }
  return { controlState, packSelection };
}
