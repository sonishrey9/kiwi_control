import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { isSourceProductCheckout, resolveGlobalHomeRoot, resolveShreyJuniorProductRoot } from "../runtime.js";

export interface RuntimeDaemonMetadata {
  pid: number;
  port: number;
  baseUrl: string;
  startedAt: string;
  launchMode?: string;
  callerSurface?: string;
  packagingSourceCategory?: string;
  binaryPath?: string | null;
  binarySha256?: string | null;
  runtimeVersion?: string | null;
  targetTriple?: string | null;
  metadataPath?: string | null;
}

export interface RuntimeIdentity {
  launchMode: string;
  callerSurface: string;
  packagingSourceCategory: string;
  binaryPath: string;
  binarySha256: string;
  runtimeVersion: string;
  targetTriple: string;
  startedAt: string;
  metadataPath: string;
}

export interface RuntimeReadiness {
  label: string;
  tone: string;
  detail: string;
  nextCommand: string | null;
}

export interface RuntimeDecisionAction {
  action: string;
  command: string | null;
  reason: string;
  priority: "critical" | "high" | "normal" | "low";
}

export interface RuntimeDecisionRecovery {
  kind: "blocked" | "failed";
  reason: string;
  fixCommand: string | null;
  retryCommand: string | null;
}

export interface RuntimeDecision {
  currentStepId: "prepare" | "generate_packets" | "execute_packet" | "validate" | "checkpoint" | "handoff" | "idle";
  currentStepLabel: string;
  currentStepStatus: "pending" | "running" | "success" | "failed";
  nextCommand: string | null;
  readinessLabel: string;
  readinessTone: "ready" | "blocked" | "failed";
  readinessDetail: string;
  nextAction: RuntimeDecisionAction | null;
  recovery: RuntimeDecisionRecovery | null;
  decisionSource: string;
  updatedAt?: string;
}

export interface RuntimeExecutionArtifacts {
  [key: string]: string[];
}

export interface RuntimeExecutionEvent {
  eventId: number | null;
  revision: number;
  operationId: string | null;
  eventType: string;
  lifecycle: "idle" | "packet_created" | "queued" | "running" | "blocked" | "failed" | "completed";
  task: string | null;
  sourceCommand: string | null;
  reason: string | null;
  nextCommand: string | null;
  blockedBy: string[];
  artifacts: RuntimeExecutionArtifacts;
  actor: string;
  recordedAt: string;
}

export interface RuntimeDerivedOutputStatus {
  outputName: string;
  path: string;
  freshness: string;
  sourceRevision: number | null;
  generatedAt: string | null;
  invalidatedAt: string | null;
  lastError: string | null;
}

export interface RuntimeSnapshot {
  targetRoot: string;
  revision: number;
  operationId: string | null;
  task: string | null;
  sourceCommand: string | null;
  lifecycle: "idle" | "packet_created" | "queued" | "running" | "blocked" | "failed" | "completed";
  reason: string | null;
  nextCommand: string | null;
  blockedBy: string[];
  artifacts: RuntimeExecutionArtifacts;
  lastUpdatedAt: string | null;
  lastEvent: RuntimeExecutionEvent | null;
  readiness: RuntimeReadiness;
  decision?: RuntimeDecision | null;
  derivedFreshness: RuntimeDerivedOutputStatus[];
}

export interface RuntimeEventList {
  targetRoot: string;
  latestRevision: number;
  events: RuntimeExecutionEvent[];
}

export interface OpenTargetRequest {
  targetRoot: string;
  rootLabel?: string;
  projectType?: string;
  profileName?: string;
}

export interface TransitionExecutionStateRequest {
  targetRoot: string;
  actor?: string;
  triggerCommand?: string;
  eventType: string;
  lifecycle: RuntimeSnapshot["lifecycle"];
  task?: string | null;
  sourceCommand?: string | null;
  reason?: string | null;
  nextCommand?: string | null;
  blockedBy?: string[];
  artifacts?: RuntimeExecutionArtifacts;
  operationId?: string | null;
  reuseOperation?: boolean;
  clearTask?: boolean;
  decision?: RuntimeDecision | null;
  invalidateOutputs?: string[];
  materializeOutputs?: string[];
}

export interface MaterializeDerivedOutputsRequest {
  targetRoot: string;
  outputs: string[];
}

export interface PersistDerivedOutputRequest {
  targetRoot: string;
  outputName: string;
  payload: unknown;
  sourceRevision?: number | null;
}

export interface RefreshRuntimeDerivedOutputsRequest {
  targetRoot: string;
}

export interface RuntimeProof {
  identity: RuntimeIdentity;
  snapshot: RuntimeSnapshot;
  derivedFreshness: RuntimeDerivedOutputStatus[];
}

export interface RepoGraphCompatibilityArtifacts {
  repoMap?: string | null;
  symbolIndex?: string | null;
  dependencyGraph?: string | null;
  impactMap?: string | null;
  decisionGraph?: string | null;
  historyGraph?: string | null;
  reviewGraph?: string | null;
}

export interface RepoGraphStatus {
  targetRoot: string;
  ready: boolean;
  status: string;
  freshness: string;
  graphRevision: number | null;
  sourceRevision: number | null;
  sourceRuntimeRevision: number | null;
  runtimeRevisionDrift: number;
  stale: boolean;
  generatedAt: string | null;
  sourceKind: string | null;
  sourceDigest: string | null;
  graphAuthorityPath: string;
  graphAuthorityKind: string;
  nodeCount: number;
  edgeCount: number;
  moduleCount: number;
  symbolCount: number;
  artifactPath: string | null;
  compatibilityHash: string | null;
  compatibilityExportReady: boolean;
  compatibilityInSync: boolean;
  compatibilityArtifacts: RepoGraphCompatibilityArtifacts | null;
}

export interface RepoGraphSnapshot<T = unknown> {
  status: RepoGraphStatus;
  graph?: T | null;
  nodes?: RepoGraphNode[];
  edges?: RepoGraphEdge[];
  modules?: RepoGraphModule[];
}

export interface RepoGraphNode {
  nodeId: string;
  nodeKind: string;
  path: string | null;
  moduleId: string | null;
  symbol: string | null;
  displayLabel: string;
  language: string | null;
  attributes: unknown;
}

export interface RepoGraphEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeKind: string;
  weight: number | null;
  evidence: unknown;
}

export interface RepoGraphModule {
  moduleId: string;
  displayLabel: string;
  summary: string | null;
  attributes: unknown;
}

export interface RepoGraphNodeResult {
  status: RepoGraphStatus;
  queryResolution: RepoGraphQueryResolution | null;
  node: RepoGraphNode | null;
  matches: RepoGraphNode[];
  incoming: RepoGraphEdge[];
  outgoing: RepoGraphEdge[];
}

export interface RepoGraphQueryResolution {
  queriedValue: string;
  resolvedNodeId: string | null;
  resolvedModuleId: string | null;
  resolution: string;
  candidates: string[];
}

export interface PersistRuntimeRepoGraphRequest {
  targetRoot: string;
  sourceKind: string;
  summary?: string | null;
  sourceRevision?: number | null;
  graph?: unknown;
  artifactPath?: string | null;
  compatibilityHash?: string | null;
  compatibilityArtifacts: RepoGraphCompatibilityArtifacts;
  nodes: RepoGraphNode[];
  edges: RepoGraphEdge[];
  modules: RepoGraphModule[];
}

const RUNTIME_METADATA_FILE = "daemon.json";
const RUNTIME_HEALTH_TIMEOUT_MS = 20_000;
const RUNTIME_START_TIMEOUT_MS = 20_000;
const RUNTIME_START_POLL_MS = 200;

export async function openRuntimeTarget(request: OpenTargetRequest): Promise<RuntimeSnapshot> {
  return runtimeRequest<RuntimeSnapshot>("/open-target", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function getRuntimeSnapshot(targetRoot: string): Promise<RuntimeSnapshot> {
  return runtimeRequest<RuntimeSnapshot>(`/runtime-snapshot?targetRoot=${encodeURIComponent(path.resolve(targetRoot))}`);
}

export async function listRuntimeExecutionEvents(
  targetRoot: string,
  afterRevision?: number
): Promise<RuntimeEventList> {
  const search = new URLSearchParams({ targetRoot: path.resolve(targetRoot) });
  if (typeof afterRevision === "number") {
    search.set("afterRevision", String(afterRevision));
  }
  return runtimeRequest<RuntimeEventList>(`/execution-events?${search.toString()}`);
}

export async function transitionRuntimeExecutionState(
  request: TransitionExecutionStateRequest
): Promise<RuntimeSnapshot> {
  return runtimeRequest<RuntimeSnapshot>("/transition-execution-state", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function materializeRuntimeDerivedOutputs(
  request: MaterializeDerivedOutputsRequest
): Promise<RuntimeSnapshot> {
  return runtimeRequest<RuntimeSnapshot>("/materialize-derived-outputs", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function getRuntimeIdentity(): Promise<RuntimeIdentity> {
  return runtimeRequest<RuntimeIdentity>("/runtime-identity");
}

export async function persistRuntimeDerivedOutput(
  request: PersistDerivedOutputRequest
): Promise<RuntimeSnapshot> {
  return runtimeRequest<RuntimeSnapshot>("/persist-derived-output", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function refreshRuntimeDerivedOutputs(
  request: RefreshRuntimeDerivedOutputsRequest
): Promise<RuntimeSnapshot> {
  return runtimeRequest<RuntimeSnapshot>("/refresh-derived-outputs", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function persistRuntimeRepoGraph<T = unknown>(
  request: PersistRuntimeRepoGraphRequest
): Promise<RepoGraphSnapshot<T>> {
  return runtimeRequest<RepoGraphSnapshot<T>>("/repo-graph", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function getRuntimeRepoGraph<T = unknown>(
  targetRoot: string
): Promise<RepoGraphSnapshot<T>> {
  return runtimeRequest<RepoGraphSnapshot<T>>(`/repo-graph?targetRoot=${encodeURIComponent(path.resolve(targetRoot))}`);
}

export async function getRuntimeRepoGraphStatus(targetRoot: string): Promise<RepoGraphStatus> {
  return runtimeRequest<RepoGraphStatus>(`/repo-graph-status?targetRoot=${encodeURIComponent(path.resolve(targetRoot))}`);
}

export async function queryRuntimeRepoGraph(
  targetRoot: string,
  kind: "node" | "file" | "module" | "symbol" | "neighbors" | "impact",
  query: { nodeId?: string; path?: string; moduleId?: string; symbol?: string }
): Promise<RepoGraphNodeResult> {
  const search = new URLSearchParams({ targetRoot: path.resolve(targetRoot) });
  if (query.nodeId) search.set("nodeId", query.nodeId);
  if (query.path) search.set("path", query.path);
  if (query.moduleId) search.set("moduleId", query.moduleId);
  if (query.symbol) search.set("symbol", query.symbol);
  return runtimeRequest<RepoGraphNodeResult>(`/repo-graph/${kind}?${search.toString()}`);
}

export async function ensureRuntimeDaemon(): Promise<RuntimeDaemonMetadata> {
  const existing = await readRuntimeMetadata();
  if (existing && (await runtimeDaemonHealthy(existing))) {
    return existing;
  }

  await fs.mkdir(runtimeMetadataDir(), { recursive: true });
  const launch = resolveRuntimeLaunch();
  const child = spawn(launch.command, launch.args, {
    cwd: resolveShreyJuniorProductRoot(),
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();

  const startedAt = Date.now();
  while (Date.now() - startedAt < RUNTIME_START_TIMEOUT_MS) {
    const metadata = await readRuntimeMetadata();
    if (metadata && (await runtimeDaemonHealthy(metadata))) {
      return metadata;
    }
    await new Promise((resolve) => setTimeout(resolve, RUNTIME_START_POLL_MS));
  }

  throw new Error("Kiwi runtime daemon did not become healthy in time.");
}

async function runtimeRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  return runtimeRequestWithMetadata<T>(pathname, init);
}

async function runtimeRequestWithMetadata<T>(
  pathname: string,
  init?: RequestInit,
  metadataOverride?: RuntimeDaemonMetadata | null,
  allowRestart = true
): Promise<T> {
  const metadata = metadataOverride ?? await ensureRuntimeDaemon();
  const url = `${metadata.baseUrl}${pathname}`;
  const headers = new Headers(init?.headers);
  const requestInit: RequestInit = {
    method: init?.method ?? "GET",
    headers,
    signal: AbortSignal.timeout(RUNTIME_HEALTH_TIMEOUT_MS)
  };
  if (init?.body !== undefined) {
    headers.set("content-type", "application/json");
    requestInit.body = init.body;
  }
  const response = await fetch(url, requestInit);
  if (!response.ok) {
    const detail = await response.text();
    if (allowRestart && response.status === 404) {
      const restarted = await restartRuntimeDaemon(metadata);
      return runtimeRequestWithMetadata<T>(pathname, init, restarted, false);
    }
    throw new Error(detail || `Kiwi runtime request failed: ${response.status}`);
  }
  const payload = await response.json() as T;
  if (allowRestart && isRuntimeSnapshotPayload(payload) && !payload.decision) {
    const restarted = await restartRuntimeDaemon(metadata);
    return runtimeRequestWithMetadata<T>(pathname, init, restarted, false);
  }
  return payload;
}

async function runtimeDaemonHealthy(metadata: RuntimeDaemonMetadata): Promise<boolean> {
  try {
    const response = await fetch(`${metadata.baseUrl}/health`, {
      signal: AbortSignal.timeout(RUNTIME_HEALTH_TIMEOUT_MS)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function readRuntimeMetadata(): Promise<RuntimeDaemonMetadata | null> {
  const metadataPath = runtimeMetadataPath();
  if (!existsSync(metadataPath)) {
    return null;
  }
  try {
    const payload = JSON.parse(await fs.readFile(metadataPath, "utf8")) as RuntimeDaemonMetadata;
    if (!payload?.baseUrl || typeof payload.port !== "number") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function resolveRuntimeLaunch(): { command: string; args: string[] } {
  const directBinary = resolveRuntimeBinaryPath();
  const metadataPath = runtimeMetadataPath();
  const callerSurface = resolveRuntimeCallerSurface();
  const packagingSourceCategory = directBinary
    ? resolveRuntimePackagingSourceCategory(directBinary)
    : "dev-cargo-fallback";
  const launchMode = directBinary
    ? resolveRuntimeLaunchMode(directBinary, packagingSourceCategory)
    : "dev-cargo-fallback";
  const targetTriple = currentRustTargetTriple();
  if (directBinary) {
    return {
      command: directBinary,
      args: [
        "daemon",
        "--metadata-file",
        metadataPath,
        "--launch-mode",
        launchMode,
        "--caller-surface",
        callerSurface,
        "--packaging-source-category",
        packagingSourceCategory,
        "--binary-path",
        directBinary,
        "--target-triple",
        targetTriple
      ]
    };
  }

  if (!allowDevRuntimeFallback()) {
    throw new Error(
      "Kiwi runtime binary is not staged. Run `node scripts/prepare-runtime-sidecar.mjs` first, or set KIWI_CONTROL_ALLOW_DEV_RUNTIME_FALLBACK=1 for an explicit cargo fallback."
    );
  }

  const cargoCommand = process.platform === "win32" ? "cargo.exe" : "cargo";
  return {
    command: cargoCommand,
    args: [
      "run",
      "--manifest-path",
      path.join(resolveShreyJuniorProductRoot(), "crates", "kiwi-runtime", "Cargo.toml"),
      "--quiet",
      "--bin",
      "kiwi-control-runtime",
      "--",
      "daemon",
      "--metadata-file",
      metadataPath,
      "--launch-mode",
      launchMode,
      "--caller-surface",
      callerSurface,
      "--packaging-source-category",
      packagingSourceCategory,
      "--binary-path",
      path.join(resolveShreyJuniorProductRoot(), "crates", "kiwi-runtime", "Cargo.toml"),
      "--target-triple",
      targetTriple
    ]
  };
}

async function restartRuntimeDaemon(
  existing: RuntimeDaemonMetadata | null
): Promise<RuntimeDaemonMetadata> {
  if (existing?.pid) {
    try {
      process.kill(existing.pid, "SIGTERM");
    } catch {
      // Best-effort only. A replacement daemon can still be launched.
    }
  }
  await fs.rm(runtimeMetadataPath(), { force: true }).catch(() => null);
  return ensureRuntimeDaemon();
}

function resolveRuntimeBinaryPath(): string | null {
  const envOverride = process.env.KIWI_CONTROL_RUNTIME_BIN?.trim()
    || process.env.SHREY_JUNIOR_RUNTIME_BIN?.trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }

  const productRoot = resolveShreyJuniorProductRoot();
  const stagedBinary = resolveStagedRuntimeBinaryPath(productRoot);
  if (stagedBinary) {
    return stagedBinary;
  }

  if (isSourceProductCheckout(productRoot)) {
    return null;
  }

  return null;
}

function runtimeMetadataDir(): string {
  const metadataFileOverride = process.env.KIWI_CONTROL_RUNTIME_METADATA_FILE?.trim()
    || process.env.SHREY_JUNIOR_RUNTIME_METADATA_FILE?.trim();
  if (metadataFileOverride) {
    return path.dirname(path.resolve(metadataFileOverride));
  }
  const override = process.env.KIWI_CONTROL_RUNTIME_DIR?.trim()
    || process.env.SHREY_JUNIOR_RUNTIME_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }

  const globalHomeRoot = resolveGlobalHomeRoot();
  if (globalHomeRoot && globalHomeRoot !== ".") {
    return path.join(globalHomeRoot, "runtime");
  }

  return path.join(os.tmpdir(), "kiwi-control-runtime");
}

function runtimeMetadataPath(): string {
  const metadataFileOverride = process.env.KIWI_CONTROL_RUNTIME_METADATA_FILE?.trim()
    || process.env.SHREY_JUNIOR_RUNTIME_METADATA_FILE?.trim();
  if (metadataFileOverride) {
    return path.resolve(metadataFileOverride);
  }
  return path.join(runtimeMetadataDir(), RUNTIME_METADATA_FILE);
}

function isRuntimeSnapshotPayload(value: unknown): value is RuntimeSnapshot {
  return typeof value === "object"
    && value !== null
    && "targetRoot" in value
    && "revision" in value
    && "lifecycle" in value;
}

function resolveRuntimeLaunchMode(binaryPath: string, packagingSourceCategory: string): string {
  if (packagingSourceCategory === "dev-cargo-fallback") {
    return "dev-cargo-fallback";
  }
  if (packagingSourceCategory === "bundled-sidecar" || packagingSourceCategory === "source-bundle-sibling") {
    return "sidecar";
  }
  void binaryPath;
  return "direct-binary";
}

function resolveStagedRuntimeBinaryPath(productRoot: string): string | null {
  const executableName = currentRuntimeExecutableName();
  const sidecarTriple = currentRustTargetTriple();
  const candidates = isSourceProductCheckout(productRoot)
    ? [
        path.join(productRoot, "apps", "sj-ui", "src-tauri", "binaries", `kiwi-control-runtime-${sidecarTriple}${process.platform === "win32" ? ".exe" : ""}`),
        path.join(productRoot, "packages", "sj-core", "dist", "runtime", "bin", executableName)
      ]
    : [
        path.join(productRoot, "bin", executableName)
      ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function resolveRuntimeCallerSurface(): string {
  return process.env.KIWI_CONTROL_RUNTIME_CALLER_SURFACE?.trim()
    || process.env.SHREY_JUNIOR_RUNTIME_CALLER_SURFACE?.trim()
    || "cli";
}

function resolveRuntimePackagingSourceCategory(binaryPath: string): string {
  const override = process.env.KIWI_CONTROL_RUNTIME_PACKAGING_SOURCE_CATEGORY?.trim()
    || process.env.SHREY_JUNIOR_RUNTIME_PACKAGING_SOURCE_CATEGORY?.trim();
  if (override) {
    return override;
  }

  const normalizedBinaryPath = path.resolve(binaryPath);
  const productRoot = resolveShreyJuniorProductRoot();
  if (isSourceProductCheckout(productRoot)) {
    if (normalizedBinaryPath.includes(`${path.sep}.app${path.sep}Contents${path.sep}MacOS${path.sep}`)) {
      return "source-bundle-sibling";
    }
    return "local-staged";
  }
  if (normalizedBinaryPath.includes(`${path.sep}runtime${path.sep}bin${path.sep}`)) {
    return "runtime-bundle";
  }
  return "env-override";
}

function currentRuntimeExecutableName(): string {
  return process.platform === "win32" ? "kiwi-control-runtime.exe" : "kiwi-control-runtime";
}

function currentRustTargetTriple(): string {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "aarch64-apple-darwin";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "x86_64-apple-darwin";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "aarch64-unknown-linux-gnu";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "x86_64-unknown-linux-gnu";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "aarch64-pc-windows-msvc";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }

  throw new Error(`Unsupported runtime target: ${process.platform}/${process.arch}`);
}

function allowDevRuntimeFallback(): boolean {
  const value = process.env.KIWI_CONTROL_ALLOW_DEV_RUNTIME_FALLBACK?.trim().toLowerCase()
    || process.env.SHREY_JUNIOR_ALLOW_DEV_RUNTIME_FALLBACK?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
