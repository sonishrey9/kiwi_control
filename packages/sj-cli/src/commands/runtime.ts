import {
  getRuntimeIdentity,
  getRuntimeSnapshot,
  refreshRuntimeDerivedOutputs,
  type RuntimeDerivedOutputStatus,
  type RuntimeIdentity,
  type RuntimeSnapshot
} from "@shrey-junior/sj-core/runtime/client.js";
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

const AUTHORITATIVE_DERIVED_OUTPUTS = new Set([
  "execution-state",
  "execution-events",
  "execution-plan",
  "workflow",
  "runtime-lifecycle",
  "decision-logic"
]);

export async function runRuntime(options: RuntimeCommandOptions): Promise<number> {
  if (options.refreshDerived) {
    await refreshRuntimeDerivedOutputs({
      targetRoot: options.targetRoot
    });
  }

  const [identity, snapshot] = await Promise.all([
    getRuntimeIdentity(),
    getRuntimeSnapshot(options.targetRoot)
  ]);
  const derivedFreshness = filterAuthoritativeDerivedFreshness(snapshot.derivedFreshness);
  const result: RuntimeCommandResult = {
    identity,
    snapshot: {
      ...snapshot,
      derivedFreshness
    },
    derivedFreshness
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
      ...renderDerivedFreshness(result.derivedFreshness)
    ].join("\n")
  );
  return 0;
}

function filterAuthoritativeDerivedFreshness(
  statuses: RuntimeDerivedOutputStatus[]
): RuntimeDerivedOutputStatus[] {
  return statuses.filter((entry) => AUTHORITATIVE_DERIVED_OUTPUTS.has(entry.outputName));
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
