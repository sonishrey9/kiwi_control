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

const RUNTIME_METADATA_FILE = "daemon.json";
const RUNTIME_HEALTH_TIMEOUT_MS = 4_000;
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
  if (directBinary) {
    return {
      command: directBinary,
      args: ["daemon", "--metadata-file", runtimeMetadataPath()]
    };
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
      runtimeMetadataPath()
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

  if (isSourceProductCheckout(resolveShreyJuniorProductRoot())) {
    return null;
  }

  const executableName = process.platform === "win32" ? "kiwi-control-runtime.exe" : "kiwi-control-runtime";
  const candidates = [
    path.join(resolveGlobalHomeRoot(), "bin", executableName)
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function runtimeMetadataDir(): string {
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
  return path.join(runtimeMetadataDir(), RUNTIME_METADATA_FILE);
}

function isRuntimeSnapshotPayload(value: unknown): value is RuntimeSnapshot {
  return typeof value === "object"
    && value !== null
    && "targetRoot" in value
    && "revision" in value
    && "lifecycle" in value;
}
