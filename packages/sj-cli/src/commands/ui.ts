import { existsSync, promises as fs, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  PRODUCT_METADATA,
  findNearestSourceProductCheckout,
  isSourceProductCheckout,
  resolveSourceUiDesktopBundlePath
} from "@shrey-junior/sj-core";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface UiOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  json?: boolean;
  logger: Logger;
}

interface DesktopLaunchCandidate {
  command: string;
  args: string[];
}

interface DesktopLaunchRequest {
  requestId: string;
  targetRoot: string;
  requestedAt: string;
}

interface DesktopLaunchStatus {
  requestId: string;
  targetRoot: string;
  state: "ready" | "error";
  detail: string;
  reportedAt: string;
}

interface DesktopLaunchLogEntry {
  event: string;
  reportedAt: string;
  requestId?: string;
  targetRoot?: string;
  detail?: string;
  command?: string;
  args?: string[];
}

interface DesktopLaunchResult {
  candidate: DesktopLaunchCandidate;
}

const DESKTOP_BINARY_CANDIDATES = ["kiwi-control-ui", "kiwi-control-desktop"];
const DESKTOP_LAUNCH_WAIT_TIMEOUT_MS = 5_000;
const DESKTOP_LAUNCH_POLL_INTERVAL_MS = 100;
const DESKTOP_LAUNCH_PROBE_SETTLE_MS = 1000;
const DESKTOP_LAUNCH_BRIDGE_DIR_ENV = "KIWI_CONTROL_DESKTOP_BRIDGE_DIR";

export async function runUi(options: UiOptions): Promise<number> {
  if (options.json) {
    const state = await buildRepoControlState({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { profileName: options.profileName } : {})
    });

    options.logger.info(JSON.stringify(state, null, 2));
    return 0;
  }

  await warmDesktopRegistration();

  const launchRequest: DesktopLaunchRequest = {
    requestId: randomUUID(),
    targetRoot: options.targetRoot,
    requestedAt: new Date().toISOString()
  };

  await writeDesktopLaunchRequest(launchRequest);
  await appendDesktopLaunchLog({
    event: "launch-requested",
    requestId: launchRequest.requestId,
    targetRoot: launchRequest.targetRoot
  });

  const launched = await launchDesktopControlSurface(launchRequest, options.repoRoot);
  if (!launched) {
    await clearDesktopLaunchRequest();
    await appendDesktopLaunchLog({
      event: "launch-unavailable",
      requestId: launchRequest.requestId,
      targetRoot: launchRequest.targetRoot
    });
    options.logger.error(buildDesktopUnavailableMessage(options.repoRoot));
    return 1;
  }

  const launchStatus = await waitForDesktopLaunchStatus(launchRequest.requestId, DESKTOP_LAUNCH_WAIT_TIMEOUT_MS);
  if (launchStatus?.state === "ready") {
    await appendDesktopLaunchLog({
      event: "launch-ready",
      requestId: launchStatus.requestId,
      targetRoot: launchStatus.targetRoot,
      detail: launchStatus.detail
    });
    options.logger.info(`Opened ${PRODUCT_METADATA.desktop.appName} for ${options.targetRoot}. The app is visible and loading this repo now.`);
    return 0;
  }

  await clearDesktopLaunchRequest();
  if (launchStatus?.state === "error") {
    await appendDesktopLaunchLog({
      event: "launch-error",
      requestId: launchStatus.requestId,
      targetRoot: launchStatus.targetRoot,
      detail: launchStatus.detail
    });
    options.logger.error(launchStatus.detail || buildDesktopLaunchTimeoutMessage(options.repoRoot));
    return 1;
  }

  await appendDesktopLaunchLog({
    event: "launch-timeout",
    requestId: launchRequest.requestId,
    targetRoot: launchRequest.targetRoot,
    detail: `No matching desktop launch status arrived within ${DESKTOP_LAUNCH_WAIT_TIMEOUT_MS}ms`
  });
  options.logger.error(buildDesktopLaunchTimeoutMessage(options.repoRoot));
  return 1;
}

async function warmDesktopRegistration(): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }

  const installedBundle = buildDesktopLaunchCandidates()
    .find((candidate) => candidate.command === "open" && candidate.args[0]?.endsWith(".app"));
  if (!installedBundle) {
    return;
  }

  await new Promise<void>((resolve) => {
    const child = spawn("open", ["-g", ...installedBundle.args], {
      detached: true,
      stdio: "ignore"
    });
    child.once("error", () => resolve());
    child.once("spawn", () => {
      child.unref();
      setTimeout(resolve, 700);
    });
  });
}

export function buildDesktopUnavailableMessage(repoRoot: string): string {
  if (isSourceProductCheckout(repoRoot)) {
    return `${PRODUCT_METADATA.desktop.appName} desktop is not installed from this source checkout. Run \`${PRODUCT_METADATA.cli.sourceDesktopLauncher}\`.`;
  }

  return `${PRODUCT_METADATA.desktop.appName} desktop is not installed or CLI-launchable on this machine. Install the matching ${PRODUCT_METADATA.desktop.appName} desktop bundle from the GitHub Release.`;
}

export function buildDesktopLaunchTimeoutMessage(repoRoot: string): string {
  if (process.platform === "darwin") {
    return `Open ${PRODUCT_METADATA.desktop.appName} once from Applications, then run ${PRODUCT_METADATA.cli.shortCommand} ui again.`;
  }

  return buildDesktopUnavailableMessage(repoRoot);
}

export function buildDesktopLaunchCandidates(repoRoot?: string, targetRoot?: string): DesktopLaunchCandidate[] {
  const candidates: DesktopLaunchCandidate[] = [];
  let hasExplicitDesktopOverride = false;

  for (const envName of PRODUCT_METADATA.compatibility.desktopEnvVars) {
    const value = process.env[envName]?.trim();
    if (!value) {
      continue;
    }

    hasExplicitDesktopOverride = true;
    candidates.push(buildDesktopCandidateFromEnvValue(value));
  }

  if (hasExplicitDesktopOverride) {
    return candidates;
  }

  if (process.platform === "darwin") {
    for (const installedBundlePath of buildInstalledMacOsDesktopBundlePaths()) {
      candidates.push(buildDesktopCandidateFromEnvValue(installedBundlePath));
    }
  }

  const discoveredSourceRoots = [
    repoRoot,
    findNearestSourceProductCheckout(process.cwd()),
    targetRoot ? findNearestSourceProductCheckout(targetRoot) : null
  ].filter((candidate, index, items): candidate is string => Boolean(candidate) && items.indexOf(candidate) === index);

  for (const sourceRoot of discoveredSourceRoots) {
    const sourceBundlePath = resolveSourceDesktopLaunchBundle(sourceRoot);
    if (!sourceBundlePath) {
      continue;
    }

    const sourceBundleExecutable = resolveMacOsBundleExecutable(sourceBundlePath);
    if (sourceBundleExecutable) {
      candidates.push({
        command: sourceBundleExecutable,
        args: []
      });
    }
    candidates.push(buildDesktopCandidateFromEnvValue(sourceBundlePath));
  }

  if (process.platform === "darwin") {
    candidates.push({
      command: "open",
      args: ["-a", PRODUCT_METADATA.desktop.appName]
    });
  }

  for (const binaryName of DESKTOP_BINARY_CANDIDATES) {
    candidates.push({
      command: binaryName,
      args: []
    });
  }

  return candidates;
}

function buildInstalledMacOsDesktopBundlePaths(): string[] {
  const candidates = [
    path.join("/Applications", `${PRODUCT_METADATA.desktop.appName}.app`),
    path.join(os.homedir(), "Applications", `${PRODUCT_METADATA.desktop.appName}.app`)
  ];

  return candidates.filter((candidate, index, items) => items.indexOf(candidate) === index);
}

export function resolveDesktopLaunchRequestPath(): string {
  return path.join(resolveDesktopLaunchBridgeDir(), "desktop-launch-request.json");
}

export function resolveDesktopLaunchStatusPath(): string {
  return path.join(resolveDesktopLaunchBridgeDir(), "desktop-launch-status.json");
}

export function resolveDesktopLaunchLogPath(): string {
  return path.join(resolveDesktopLaunchBridgeDir(), "desktop-launch-log.json");
}

async function launchDesktopControlSurface(launchRequest: DesktopLaunchRequest, repoRoot?: string): Promise<DesktopLaunchResult | null> {
  for (const candidate of buildDesktopLaunchCandidates(repoRoot, launchRequest.targetRoot)) {
    if (await tryLaunchDesktopCandidate(candidate, launchRequest)) {
      return { candidate };
    }
  }

  return null;
}

function resolveSourceDesktopLaunchBundle(repoRoot?: string): string | null {
  if (!repoRoot || !isSourceProductCheckout(repoRoot)) {
    return null;
  }

  const bundlePath = resolveSourceUiDesktopBundlePath(repoRoot);
  if (!bundlePath || !existsSync(bundlePath)) {
    return null;
  }

  return bundlePath;
}

function resolveMacOsBundleExecutable(bundlePath: string): string | null {
  if (process.platform !== "darwin" || !bundlePath.endsWith(".app")) {
    return null;
  }

  const macOsDirectory = path.join(bundlePath, "Contents", "MacOS");
  if (!existsSync(macOsDirectory)) {
    return null;
  }

  const executable = readdirSync(macOsDirectory, { withFileTypes: true }).find((entry) => entry.isFile());
  if (!executable) {
    return null;
  }

  return path.join(macOsDirectory, executable.name);
}

function buildDesktopCandidateFromEnvValue(value: string): DesktopLaunchCandidate {
  if (process.platform === "darwin" && value.endsWith(".app")) {
    return {
      command: "open",
      args: [value]
    };
  }

  if (value.endsWith(".js")) {
    return {
      command: "node",
      args: [value]
    };
  }

  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(value)) {
    return {
      command: "cmd.exe",
      args: ["/c", value]
    };
  }

  if (process.platform === "win32" && /\.ps1$/i.test(value)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", value]
    };
  }

  return {
    command: value,
    args: []
  };
}

function resolveDesktopLaunchBridgeDir(): string {
  const explicitBridgeDir = process.env[DESKTOP_LAUNCH_BRIDGE_DIR_ENV]?.trim();
  if (explicitBridgeDir) {
    return explicitBridgeDir;
  }

  return path.join(os.tmpdir(), PRODUCT_METADATA.release.artifactPrefix);
}

async function writeDesktopLaunchRequest(request: DesktopLaunchRequest): Promise<void> {
  const requestPath = resolveDesktopLaunchRequestPath();
  await fs.mkdir(path.dirname(requestPath), { recursive: true });
  await fs.rm(resolveDesktopLaunchStatusPath(), { force: true });
  await fs.writeFile(requestPath, JSON.stringify(request, null, 2), "utf8");
}

async function clearDesktopLaunchRequest(): Promise<void> {
  await fs.rm(resolveDesktopLaunchRequestPath(), { force: true });
}

async function waitForDesktopLaunchStatus(requestId: string, timeoutMs: number): Promise<DesktopLaunchStatus | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const status = await readDesktopLaunchStatus();
    if (status?.requestId === requestId) {
      return status;
    }

    await delay(DESKTOP_LAUNCH_POLL_INTERVAL_MS);
  }

  return null;
}

async function readDesktopLaunchStatus(): Promise<DesktopLaunchStatus | null> {
  try {
    const payload = await fs.readFile(resolveDesktopLaunchStatusPath(), "utf8");
    return JSON.parse(payload) as DesktopLaunchStatus;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    return null;
  }
}

async function tryLaunchDesktopCandidate(candidate: DesktopLaunchCandidate, launchRequest: DesktopLaunchRequest): Promise<boolean> {
  await terminateConflictingDesktopProcesses(candidate, launchRequest);

  await appendDesktopLaunchLog({
    event: "launch-attempt",
    requestId: launchRequest.requestId,
    targetRoot: launchRequest.targetRoot,
    command: candidate.command,
    args: candidate.args
  });

  return await new Promise((resolve) => {
    let settled = false;
    let stderrOutput = "";
    const child = spawn(candidate.command, candidate.args, {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"]
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderrOutput = `${stderrOutput}${chunk}`.slice(-2048);
    });

    child.once("error", async (error) => {
      settled = true;
      await appendDesktopLaunchLog({
        event: "launch-attempt-failed",
        requestId: launchRequest.requestId,
        targetRoot: launchRequest.targetRoot,
        command: candidate.command,
        args: candidate.args,
        detail: error.message
      });
      resolve(false);
    });

    child.once("spawn", async () => {
      await appendDesktopLaunchLog({
        event: "launch-spawned",
        requestId: launchRequest.requestId,
        targetRoot: launchRequest.targetRoot,
        command: candidate.command,
        args: candidate.args
      });

      setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        child.unref();
        resolve(true);
      }, DESKTOP_LAUNCH_PROBE_SETTLE_MS);
    });

    child.once("close", async (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      if (code === 0) {
        resolve(true);
        return;
      }

      const failureDetail = [stderrOutput.trim(), code === null ? null : `exit code ${code}`, signal ? `signal ${signal}` : null]
        .filter(Boolean)
        .join(" | ");

      await appendDesktopLaunchLog({
        event: "launch-attempt-failed",
        requestId: launchRequest.requestId,
        targetRoot: launchRequest.targetRoot,
        command: candidate.command,
        args: candidate.args,
        detail: failureDetail || "desktop launch candidate exited before Kiwi Control could open"
      });
      resolve(false);
    });
  });
}

async function terminateConflictingDesktopProcesses(
  candidate: DesktopLaunchCandidate,
  launchRequest: DesktopLaunchRequest
): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }

  const candidateExecutable = resolveDesktopCandidateExecutablePath(candidate);
  if (!candidateExecutable) {
    return;
  }

  const runningProcesses = listRunningDesktopProcesses().filter((processInfo) => !processInfo.command.includes(candidateExecutable));
  if (runningProcesses.length === 0) {
    return;
  }

  for (const processInfo of runningProcesses) {
    try {
      process.kill(processInfo.pid, "SIGTERM");
      await appendDesktopLaunchLog({
        event: "launch-conflict-terminated",
        requestId: launchRequest.requestId,
        targetRoot: launchRequest.targetRoot,
        command: processInfo.command,
        detail: `terminated conflicting desktop process ${processInfo.pid}`
      });
    } catch (error) {
      await appendDesktopLaunchLog({
        event: "launch-conflict-termination-failed",
        requestId: launchRequest.requestId,
        targetRoot: launchRequest.targetRoot,
        command: processInfo.command,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await delay(400);
}

function resolveDesktopCandidateExecutablePath(candidate: DesktopLaunchCandidate): string | null {
  if (path.isAbsolute(candidate.command) && candidate.command.includes(`${PRODUCT_METADATA.desktop.appName}.app/Contents/MacOS/`)) {
    return candidate.command;
  }

  if (candidate.command !== "open") {
    return null;
  }

  const openTarget = candidate.args.find((arg) => arg.endsWith(".app"));
  if (!openTarget || !path.isAbsolute(openTarget)) {
    return null;
  }

  return resolveMacOsBundleExecutable(openTarget);
}

function listRunningDesktopProcesses(): Array<{ pid: number; command: string }> {
  if (process.platform !== "darwin") {
    return [];
  }

  const result = spawnSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf8"
  });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      const [, pidText = "", commandText = ""] = match ?? [];
      if (!match || !pidText || !commandText) {
        return null;
      }

      const pid = Number.parseInt(pidText, 10);
      const command = commandText.trim();
      if (!Number.isFinite(pid) || !command.includes(`${PRODUCT_METADATA.desktop.appName}.app/Contents/MacOS/`)) {
        return null;
      }

      return { pid, command };
    })
    .filter((entry): entry is { pid: number; command: string } => Boolean(entry));
}

async function appendDesktopLaunchLog(entry: Omit<DesktopLaunchLogEntry, "reportedAt">): Promise<void> {
  const logPath = resolveDesktopLaunchLogPath();
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const payload = JSON.stringify({
    ...entry,
    reportedAt: new Date().toISOString()
  });
  await fs.appendFile(logPath, `${payload}\n`, "utf8");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
