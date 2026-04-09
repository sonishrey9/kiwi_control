import path from "node:path";
import { getRuntimeRepoGraphStatus, getRuntimeSnapshot, type RepoGraphStatus, type RuntimeSnapshot } from "../runtime/client.js";
import type { PackSelectionArtifactData } from "./mcp-pack-selection.js";
import { ensureDir, pathExists, readJson, writeText } from "../utils/fs.js";

export type ReadySubstrateStatus = "ready" | "partial" | "missing";

export interface ReadySubstrateArtifact {
  path: string;
  valid: boolean;
  required: boolean;
  role: "runtime-compat" | "repo-map" | "graph" | "impact" | "pack" | "review" | "tool-entry";
}

export interface ReadyRepoSubstrateState {
  artifactType: "kiwi-control/ready-substrate";
  version: 1;
  generatedAt: string;
  targetRoot: string;
  status: ReadySubstrateStatus;
  ready: boolean;
  summary: string;
  runtimeAuthority: {
    valid: boolean;
    revision: number | null;
    lifecycle: string | null;
    sourceCommand: string | null;
    nextCommand: string | null;
    lastUpdatedAt: string | null;
    sqlitePath: string;
    compatibilityStatePath: string;
    compatibilityEventsPath: string;
    note: string;
  };
  graphAuthority: {
    valid: boolean;
    ready: boolean;
    status: string;
    freshness: string;
    graphRevision: number | null;
    sourceRevision: number | null;
    sourceRuntimeRevision: number | null;
    generatedAt: string | null;
    graphAuthorityPath: string;
    kind: string;
    nodeCount: number;
    edgeCount: number;
    moduleCount: number;
    symbolCount: number;
    aliasKind: string;
    aliasCount: number;
    aliasAmbiguityCount: number;
    explicitAliasSourcePath: string;
    explicitAliasSourceAvailable: boolean;
    artifactPath: string | null;
    compatibilityExportReady: boolean;
    compatibilityInSync: boolean;
    compatibilityArtifacts: RepoGraphStatus["compatibilityArtifacts"];
    note: string;
  };
  packSelection: {
    selectedPack: string | null;
    selectedPackSource: string | null;
    explicitSelection: string | null;
    executable: boolean;
    unavailablePackReason: string | null;
    effectiveCapabilityIds: string[];
    preferredCapabilityIds: string[];
  };
  artifacts: Record<string, ReadySubstrateArtifact>;
  readFirst: string[];
  toolEntry: {
    path: ".agent/context/agent-pack.json";
    note: string;
  };
  missingRequired: string[];
}

const REQUIRED_ARTIFACTS: Array<[string, ReadySubstrateArtifact]> = [
  ["repoMap", artifact(".agent/context/repo-map.json", true, "repo-map")],
  ["symbolIndex", artifact(".agent/state/symbol-index.json", true, "graph")],
  ["dependencyGraph", artifact(".agent/state/dependency-graph.json", true, "graph")],
  ["impactMap", artifact(".agent/state/impact-map.json", true, "impact")],
  ["decisionGraph", artifact(".agent/state/decision-graph.json", true, "graph")],
  ["historyGraph", artifact(".agent/state/history-graph.json", true, "graph")],
  ["reviewGraph", artifact(".agent/state/review-graph.json", true, "review")],
  ["compactContextPack", artifact(".agent/context/compact-context-pack.json", true, "pack")],
  ["reviewContextPack", artifact(".agent/context/review-context-pack.json", true, "review")],
  ["taskPack", artifact(".agent/context/task-pack.json", true, "pack")],
  ["agentPack", artifact(".agent/context/agent-pack.json", true, "tool-entry")]
];

const OPTIONAL_ARTIFACTS: Array<[string, ReadySubstrateArtifact]> = [
  ["selectedPack", artifact(".agent/state/selected-pack.json", false, "pack")],
  ["reviewPack", artifact(".agent/context/review-pack.json", false, "review")],
  ["executionStateCompat", artifact(".agent/state/execution-state.json", false, "runtime-compat")],
  ["executionEventsCompat", artifact(".agent/state/execution-events.ndjson", false, "runtime-compat")]
];

export function readySubstratePath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "ready-substrate.json");
}

export async function buildReadyRepoSubstrate(
  targetRoot: string,
  runtimeSnapshot?: RuntimeSnapshot | null,
  packSelection?: PackSelectionArtifactData | null
): Promise<ReadyRepoSubstrateState> {
  const snapshot = runtimeSnapshot ?? await getRuntimeSnapshot(targetRoot).catch(() => null);
  const graphStatus = await getRuntimeRepoGraphStatus(targetRoot).catch(() => null);
  const artifacts: Record<string, ReadySubstrateArtifact> = {};
  for (const [name, entry] of [...REQUIRED_ARTIFACTS, ...OPTIONAL_ARTIFACTS]) {
    artifacts[name] = { ...entry };
  }

  await Promise.all(Object.values(artifacts).map(async (entry) => {
    entry.valid = await pathExists(path.join(targetRoot, entry.path));
  }));

  const runtimeAuthority = {
    valid: Boolean(snapshot && snapshot.revision > 0),
    revision: snapshot?.revision ?? null,
    lifecycle: snapshot?.lifecycle ?? null,
    sourceCommand: snapshot?.sourceCommand ?? null,
    nextCommand: snapshot?.nextCommand ?? null,
    lastUpdatedAt: snapshot?.lastUpdatedAt ?? null,
    sqlitePath: ".agent/state/runtime.sqlite3",
    compatibilityStatePath: ".agent/state/execution-state.json",
    compatibilityEventsPath: ".agent/state/execution-events.ndjson",
    note: "Runtime SQLite and runtime events are canonical. JSON execution files are compatibility outputs."
  };

  const missingRequired = [
    ...(runtimeAuthority.valid ? [] : ["runtimeAuthority"]),
    ...(graphStatus?.ready ? [] : ["graphAuthority"]),
    ...Object.entries(artifacts)
      .filter(([, entry]) => entry.required && !entry.valid)
      .map(([name]) => name)
  ];
  const ready = missingRequired.length === 0;
  const status: ReadySubstrateStatus = ready
    ? "ready"
    : missingRequired.length >= REQUIRED_ARTIFACTS.length
      ? "missing"
      : "partial";

  return {
    artifactType: "kiwi-control/ready-substrate",
    version: 1,
    generatedAt: new Date().toISOString(),
    targetRoot,
    status,
    ready,
    summary: ready
      ? `Ready repo substrate is available at runtime revision ${runtimeAuthority.revision}.`
      : `Repo substrate is ${status}; missing ${missingRequired.join(", ")}.`,
    runtimeAuthority,
    graphAuthority: {
      valid: Boolean(graphStatus),
      ready: graphStatus?.ready ?? false,
      status: graphStatus?.status ?? "missing",
      freshness: graphStatus?.freshness ?? "missing",
      graphRevision: graphStatus?.graphRevision ?? null,
      sourceRevision: graphStatus?.sourceRevision ?? null,
      sourceRuntimeRevision: graphStatus?.sourceRuntimeRevision ?? graphStatus?.sourceRevision ?? null,
      generatedAt: graphStatus?.generatedAt ?? null,
      graphAuthorityPath: graphStatus?.graphAuthorityPath ?? path.join(targetRoot, ".agent", "state", "runtime.sqlite3"),
      kind: graphStatus?.graphAuthorityKind ?? "runtime-sqlite-normalized",
      nodeCount: graphStatus?.nodeCount ?? 0,
      edgeCount: graphStatus?.edgeCount ?? 0,
      moduleCount: graphStatus?.moduleCount ?? 0,
      symbolCount: graphStatus?.symbolCount ?? 0,
      aliasKind: graphStatus?.aliasAuthorityKind ?? "runtime-sqlite-normalized-aliases",
      aliasCount: graphStatus?.aliasCount ?? 0,
      aliasAmbiguityCount: graphStatus?.aliasAmbiguityCount ?? 0,
      explicitAliasSourcePath: graphStatus?.explicitAliasSourcePath ?? ".agent/context/graph-aliases.json",
      explicitAliasSourceAvailable: graphStatus?.explicitAliasSourceAvailable ?? false,
      artifactPath: graphStatus?.artifactPath ?? null,
      compatibilityExportReady: graphStatus?.compatibilityExportReady ?? false,
      compatibilityInSync: graphStatus?.compatibilityInSync ?? false,
      compatibilityArtifacts: graphStatus?.compatibilityArtifacts ?? null,
      note: "Canonical repo graph lives in runtime SQLite. JSON graph files are compatibility/export views."
    },
    packSelection: {
      selectedPack: packSelection?.selectedPack ?? null,
      selectedPackSource: packSelection?.selectedPackSource ?? null,
      explicitSelection: packSelection?.explicitSelection ?? null,
      executable: packSelection?.executable ?? false,
      unavailablePackReason: packSelection?.unavailablePackReason ?? null,
      effectiveCapabilityIds: packSelection?.effectiveCapabilityIds ?? [],
      preferredCapabilityIds: packSelection?.preferredCapabilityIds ?? []
    },
    artifacts,
    readFirst: [
      ".agent/state/ready-substrate.json",
      ".agent/state/selected-pack.json",
      ".agent/context/agent-pack.json",
      ".agent/state/execution-state.json",
      ".agent/state/execution-events.ndjson",
      ".agent/context/task-pack.json",
      ".agent/context/review-context-pack.json",
      ".agent/context/repo-map.json"
    ],
    toolEntry: {
      path: ".agent/context/agent-pack.json",
      note: "External coding tools should start with agent-pack.json, then follow readFirst and packPointers."
    },
    missingRequired
  };
}

export async function persistReadyRepoSubstrate(
  targetRoot: string,
  packSelection?: PackSelectionArtifactData | null,
  runtimeSnapshot?: RuntimeSnapshot | null
): Promise<string> {
  const outputPath = readySubstratePath(targetRoot);
  const state = await buildReadyRepoSubstrate(targetRoot, runtimeSnapshot, packSelection);
  await ensureDir(path.dirname(outputPath));
  await writeText(outputPath, `${JSON.stringify(state, null, 2)}\n`);
  return outputPath;
}

export async function loadReadyRepoSubstrate(targetRoot: string): Promise<ReadyRepoSubstrateState | null> {
  try {
    const payload = await readJson<ReadyRepoSubstrateState>(readySubstratePath(targetRoot));
    return payload.artifactType === "kiwi-control/ready-substrate" && payload.version === 1
      ? payload
      : null;
  } catch {
    return null;
  }
}

function artifact(
  relativePath: string,
  required: boolean,
  role: ReadySubstrateArtifact["role"]
): ReadySubstrateArtifact {
  return {
    path: relativePath,
    valid: false,
    required,
    role
  };
}
