import {
  getRuntimeIdentity,
  getRuntimeSnapshot,
  persistRuntimeDerivedOutput,
  refreshRuntimeDerivedOutputs,
  type RuntimeDerivedOutputStatus,
  type RuntimeIdentity,
  type RuntimeSnapshot
} from "@shrey-junior/sj-core/runtime/client.js";
import {
  buildRepoControlSnapshotArtifact,
  buildRepoControlState
} from "@shrey-junior/sj-core/core/ui-state.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface RuntimeCommandOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  refreshDerived?: boolean;
  json?: boolean;
  logger: Logger;
}

export interface RuntimeCommandResult {
  identity: RuntimeIdentity;
  snapshot: RuntimeSnapshot;
  derivedFreshness: RuntimeDerivedOutputStatus[];
}

export async function runRuntime(options: RuntimeCommandOptions): Promise<number> {
  let snapshotArtifact: ReturnType<typeof buildRepoControlSnapshotArtifact> | undefined;
  if (options.refreshDerived) {
    const state = await buildRepoControlState({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { profileName: options.profileName } : {}),
      machineAdvisoryOptions: { fastMode: true },
      readOnly: true
    });
    snapshotArtifact = buildRepoControlSnapshotArtifact(state);
    await refreshRuntimeDerivedOutputs({
      targetRoot: options.targetRoot,
      ...(snapshotArtifact ? { repoControlSnapshot: snapshotArtifact } : {})
    });
    await persistRuntimeDerivedOutput({
      targetRoot: options.targetRoot,
      outputName: "repo-control-snapshot",
      payload: snapshotArtifact,
      sourceRevision: state.executionState.revision
    });
  }

  const [identity, snapshot] = await Promise.all([
    getRuntimeIdentity(),
    getRuntimeSnapshot(options.targetRoot)
  ]);
  const result: RuntimeCommandResult = {
    identity,
    snapshot,
    derivedFreshness: snapshot.derivedFreshness
  };

  if (options.json) {
    options.logger.info(JSON.stringify(result, null, 2));
    return 0;
  }

  options.logger.info(
    [
      `runtime launch mode: ${identity.launchMode}`,
      `caller surface: ${identity.callerSurface}`,
      `packaging source: ${identity.packagingSourceCategory}`,
      `binary path: ${identity.binaryPath}`,
      `binary sha256: ${identity.binarySha256}`,
      `runtime version: ${identity.runtimeVersion}`,
      `target triple: ${identity.targetTriple}`,
      `started at: ${identity.startedAt}`,
      `metadata path: ${identity.metadataPath}`,
      `execution lifecycle: ${snapshot.lifecycle}`,
      `current step: ${snapshot.decision?.currentStepId ?? "none"}`,
      `readiness: ${snapshot.decision?.readinessLabel ?? snapshot.readiness.label}`,
      ...(options.refreshDerived ? ["derived outputs refreshed from canonical runtime state"] : []),
      ...renderDerivedFreshness(snapshot.derivedFreshness)
    ].join("\n")
  );
  return 0;
}

function renderDerivedFreshness(statuses: RuntimeDerivedOutputStatus[]): string[] {
  if (statuses.length === 0) {
    return ["derived outputs: none recorded"];
  }
  return [
    "derived outputs:",
    ...statuses.map((entry) =>
      `- ${entry.outputName}: ${entry.freshness} @ revision ${entry.sourceRevision ?? "none"}${entry.generatedAt ? ` (${entry.generatedAt})` : ""}${entry.lastError ? ` [${entry.lastError}]` : ""}`
    )
  ];
}
