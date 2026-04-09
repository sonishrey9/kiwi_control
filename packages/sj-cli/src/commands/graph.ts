import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoContextTree, persistRepoContextTreeArtifacts } from "@shrey-junior/sj-core/core/context-tree.js";
import { inspectBootstrapTarget } from "@shrey-junior/sj-core/core/project-detect.js";
import { buildRepoIntelligenceArtifacts, persistRepoIntelligenceArtifacts } from "@shrey-junior/sj-core/core/repo-intelligence.js";
import { buildReadyRepoSubstrate } from "@shrey-junior/sj-core/core/ready-substrate.js";
import { getRuntimeRepoGraphStatus, getRuntimeSnapshot, queryRuntimeRepoGraph, transitionRuntimeExecutionState, type RepoGraphNodeResult } from "@shrey-junior/sj-core/runtime/client.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";
import { syncPackSelectionSideEffects } from "./helpers/pack-selection.js";

export interface GraphOptions {
  repoRoot: string;
  targetRoot: string;
  action: "status" | "build" | "file" | "module" | "symbol" | "neighbors" | "impact";
  value?: string;
  json?: boolean;
  logger: Logger;
}

export async function runGraph(options: GraphOptions): Promise<number> {
  if (options.action === "build") {
    await buildCanonicalGraph(options.repoRoot, options.targetRoot);
    await recordGraphBuildRuntimeEvent(options.targetRoot).catch(() => null);
    await syncPackSelectionSideEffects({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot
    }).catch(() => null);
  }
  if (["file", "module", "symbol", "neighbors", "impact"].includes(options.action)) {
    return runGraphQueryAction(options);
  }

  const graph = await getRuntimeRepoGraphStatus(options.targetRoot);
  const packSynced = await syncPackSelectionSideEffects({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    persist: false
  }).catch(() => null);
  const substrate = await buildReadyRepoSubstrate(options.targetRoot, undefined, packSynced?.packSelection ?? null);
  const payload = {
    targetRoot: options.targetRoot,
    graph,
    ...(packSynced ? { packSelection: packSynced.controlState.mcpPacks } : {}),
    readySubstrate: {
      ready: substrate.ready,
      status: substrate.status,
      summary: substrate.summary,
      graphAuthority: substrate.graphAuthority,
      readFirst: substrate.readFirst,
      toolEntry: substrate.toolEntry,
      missingRequired: substrate.missingRequired
    }
  };

  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return graph.ready ? 0 : 1;
  }

  options.logger.info(`graph status: ${graph.status} — ${graph.freshness}`);
  options.logger.info(`graph revision: ${graph.graphRevision ?? "none"}`);
  options.logger.info(`graph authority: ${graph.graphAuthorityPath}`);
  options.logger.info(`ready substrate: ${substrate.status} — ${substrate.toolEntry.path}`);
  if (!graph.ready) {
    options.logger.info(`next command: kiwi-control graph build --target ${JSON.stringify(options.targetRoot)}`);
  }
  return graph.ready ? 0 : 1;
}

async function recordGraphBuildRuntimeEvent(targetRoot: string): Promise<void> {
  const snapshot = await getRuntimeSnapshot(targetRoot);
  await transitionRuntimeExecutionState({
    targetRoot,
    actor: process.env.KIWI_CONTROL_COMMAND_SOURCE ?? process.env.SHREY_JUNIOR_COMMAND_SOURCE ?? "cli",
    triggerCommand: "kiwi-control graph build",
    eventType: "repo-graph-built",
    lifecycle: snapshot.lifecycle,
    task: snapshot.task,
    sourceCommand: snapshot.sourceCommand,
    reason: snapshot.reason,
    nextCommand: snapshot.nextCommand,
    blockedBy: snapshot.blockedBy,
    artifacts: {
      ...snapshot.artifacts,
      repoGraph: [".agent/state/runtime.sqlite3"],
      readySubstrate: [".agent/state/ready-substrate.json"]
    },
    operationId: snapshot.operationId,
    reuseOperation: snapshot.operationId !== null,
    decision: snapshot.decision ?? null,
    materializeOutputs: ["execution-state", "execution-events"]
  });
}

async function runGraphQueryAction(options: GraphOptions): Promise<number> {
  const value = options.value?.trim();
  if (!value) {
    throw new Error(`graph ${options.action} requires a query value.`);
  }
  const graph = await getRuntimeRepoGraphStatus(options.targetRoot);
  if (!graph.ready) {
    throw new Error(`Canonical graph is not ready. Run: kiwi-control graph build --target ${JSON.stringify(options.targetRoot)}`);
  }
  const query =
    options.action === "file"
      ? { path: value }
      : options.action === "module"
        ? { moduleId: value }
        : options.action === "symbol"
          ? { symbol: value }
          : value.includes(":")
            ? { nodeId: value }
            : value.includes("/") || value.includes(".")
              ? { path: value }
              : { moduleId: value, symbol: value };
  const action = options.action as "file" | "module" | "symbol" | "neighbors" | "impact";
  const payload = await queryRuntimeRepoGraph(options.targetRoot, action, query);
  if (options.json) {
    options.logger.info(JSON.stringify(payload, null, 2));
    return payload.matches.length > 0 || payload.node ? 0 : 1;
  }
  options.logger.info(renderQueryText(options.action, payload));
  return payload.matches.length > 0 || payload.node ? 0 : 1;
}

function renderQueryText(action: GraphOptions["action"], payload: RepoGraphNodeResult): string {
  const node = payload.node;
  return [
    `graph ${action}: ${node?.displayLabel ?? "no match"}`,
    `graph revision: ${payload.status.graphRevision ?? "none"}`,
    `matches: ${payload.matches.length}`,
    `incoming edges: ${payload.incoming.length}`,
    `outgoing edges: ${payload.outgoing.length}`
  ].join("\n");
}

async function buildCanonicalGraph(repoRoot: string, targetRoot: string): Promise<void> {
  const config = await loadCanonicalConfig(repoRoot);
  const inspection = await inspectBootstrapTarget(targetRoot, config);
  const { state, view, index } = await buildRepoContextTree(targetRoot, inspection.projectType);
  await persistRepoContextTreeArtifacts(targetRoot, state, view);
  const artifacts = await buildRepoIntelligenceArtifacts({
    targetRoot,
    tree: state,
    view,
    index
  });
  await persistRepoIntelligenceArtifacts(targetRoot, artifacts);
  await syncPackSelectionSideEffects({
    repoRoot,
    targetRoot
  }).catch(() => null);
}
