import { existsSync, promises as fs, readFileSync, readdirSync, realpathSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  PRODUCT_METADATA,
  findNearestSourceProductCheckout,
  isSourceProductCheckout,
  resolveDesktopInstallReceiptPath,
  resolveDesktopLaunchMode,
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

type DesktopLaunchSource = "source-bundle" | "installed-bundle" | "fallback-launcher" | "existing-session";
type DesktopLaunchMode = "installed-user" | "developer-source";

interface DesktopInstallReceipt {
  appVersion: string;
  bundleId: string;
  executablePath: string;
  buildSource: DesktopLaunchSource;
  runtimeMode: DesktopLaunchMode;
  updatedAt: string;
}

interface DesktopLaunchCandidate {
  command: string;
  args: string[];
  launchSource: DesktopLaunchSource;
}

interface DesktopLaunchRequest {
  requestId: string;
  targetRoot: string;
  requestedAt: string;
  launchSource?: DesktopLaunchSource;
}

interface DesktopLaunchStatus {
  requestId: string;
  targetRoot: string;
  state: "ready" | "hydrating" | "error";
  detail: string;
  reportedAt: string;
  revision: number;
  launchSource?: DesktopLaunchSource;
}

interface DesktopLaunchLogEntry {
  event: string;
  reportedAt: string;
  requestId?: string;
  targetRoot?: string;
  detail?: string;
  launchSource?: DesktopLaunchSource;
  command?: string;
  args?: string[];
}

interface DesktopLaunchResult {
  candidate: DesktopLaunchCandidate;
}

interface DesktopLaunchObservation {
  requestId: string;
  targetRoot: string;
  state: "ready" | "hydrating" | "error";
  detail: string;
  reportedAt: string;
  launchSource?: DesktopLaunchSource;
}

const DESKTOP_BINARY_CANDIDATES = ["kiwi-control-ui", "kiwi-control-desktop"];
const DESKTOP_ATTACH_WAIT_TIMEOUT_MS = 1_500;
const DESKTOP_LAUNCH_WAIT_TIMEOUT_MS = 8_000;
const DESKTOP_LAUNCH_POLL_INTERVAL_MS = 100;
const DESKTOP_LAUNCH_PROBE_SETTLE_MS = 1000;
const DESKTOP_LAUNCH_BRIDGE_DIR_ENV = "KIWI_CONTROL_DESKTOP_BRIDGE_DIR";

export async function runUi(options: UiOptions): Promise<number> {
  if (options.json) {
    const state = await buildRepoControlState({
      repoRoot: options.repoRoot,
      targetRoot: options.targetRoot,
      ...(options.profileName ? { profileName: options.profileName } : {}),
      machineAdvisoryOptions: { fastMode: true },
      readOnly: true
    });

    options.logger.info(JSON.stringify(state, null, 2));
    return 0;
  }

  await warmDesktopRegistration(options.repoRoot, options.targetRoot);

  const launchRequest: DesktopLaunchRequest = {
    requestId: randomUUID(),
    targetRoot: options.targetRoot,
    requestedAt: new Date().toISOString()
  };

  const attachStatus = await tryAttachToExistingDesktopSession(launchRequest);
  if (
    attachStatus?.state === "ready"
    && (!("revision" in attachStatus) || typeof attachStatus.revision !== "number" || attachStatus.revision > 0)
  ) {
    await appendDesktopLaunchLog({
      event: "attach-ready",
      requestId: attachStatus.requestId,
      targetRoot: attachStatus.targetRoot,
      detail: attachStatus.detail,
      launchSource: attachStatus.launchSource ?? "existing-session"
    });
    options.logger.info(
      `Attached ${PRODUCT_METADATA.desktop.appName} to the existing session for ${options.targetRoot}. Launch source: ${attachStatus.launchSource ?? "existing-session"}. ${attachStatus.detail}`
    );
    return 0;
  }

  if (attachStatus?.state === "hydrating") {
    await appendDesktopLaunchLog({
      event: "attach-hydrating",
      requestId: attachStatus.requestId,
      targetRoot: attachStatus.targetRoot,
      detail: attachStatus.detail,
      launchSource: attachStatus.launchSource ?? "existing-session"
    });
    options.logger.info(
      `Attached ${PRODUCT_METADATA.desktop.appName} to the existing session for ${options.targetRoot}. Launch source: ${attachStatus.launchSource ?? "existing-session"}. ${attachStatus.detail}`
    );
    return 0;
  }

  if (attachStatus?.state === "error") {
    await clearDesktopLaunchRequest();
    await appendDesktopLaunchLog({
      event: "attach-error",
      requestId: attachStatus.requestId,
      targetRoot: attachStatus.targetRoot,
      detail: attachStatus.detail,
      launchSource: attachStatus.launchSource ?? "existing-session"
    });
    options.logger.error(attachStatus.detail || buildDesktopLaunchTimeoutMessage(options.repoRoot));
    return 1;
  }

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
  if (launchStatus?.state === "ready" && "revision" in launchStatus && launchStatus.revision > 0) {
    await appendDesktopLaunchLog({
      event: "launch-ready",
      requestId: launchStatus.requestId,
      targetRoot: launchStatus.targetRoot,
      detail: launchStatus.detail,
      launchSource: launchStatus.launchSource ?? launched.candidate.launchSource
    });
    options.logger.info(`Opened ${PRODUCT_METADATA.desktop.appName} via ${describeDesktopLaunchCandidate(launched.candidate)} for ${options.targetRoot}. Launch source: ${launchStatus.launchSource ?? launched.candidate.launchSource}. The app is visible and loading this repo now.`);
    return 0;
  }

  if (launchStatus?.state === "hydrating") {
    await appendDesktopLaunchLog({
      event: "launch-hydrating",
      requestId: launchStatus.requestId,
      targetRoot: launchStatus.targetRoot,
      detail: launchStatus.detail,
      launchSource: launchStatus.launchSource ?? launched.candidate.launchSource
    });
    options.logger.info(`Opened ${PRODUCT_METADATA.desktop.appName} via ${describeDesktopLaunchCandidate(launched.candidate)} for ${options.targetRoot}. Launch source: ${launchStatus.launchSource ?? launched.candidate.launchSource}. ${launchStatus.detail}`);
    return 0;
  }

  if (launchStatus?.state === "error") {
    await clearDesktopLaunchRequest();
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
    event: "launch-pending",
    requestId: launchRequest.requestId,
    targetRoot: launchRequest.targetRoot,
    detail: `No matching desktop launch status arrived within ${DESKTOP_LAUNCH_WAIT_TIMEOUT_MS}ms`,
    launchSource: launched.candidate.launchSource
  });
  options.logger.info(
    `${PRODUCT_METADATA.desktop.appName} launched via ${describeDesktopLaunchCandidate(launched.candidate)} (${launched.candidate.launchSource}), but repo hydration is still in progress for ${options.targetRoot}. Watch the desktop app for the final ready state.`
  );
  return 0;
}

async function tryAttachToExistingDesktopSession(
  launchRequest: DesktopLaunchRequest
): Promise<DesktopLaunchStatus | DesktopLaunchObservation | null> {
  const attachRequest: DesktopLaunchRequest = {
    ...launchRequest,
    launchSource: "existing-session"
  };
  await writeDesktopLaunchRequest(attachRequest);
  await appendDesktopLaunchLog({
    event: "attach-requested",
    requestId: attachRequest.requestId,
    targetRoot: attachRequest.targetRoot,
    launchSource: "existing-session",
    detail: "probing for an existing desktop session"
  });
  const attachStatus = await waitForDesktopLaunchStatus(attachRequest.requestId, DESKTOP_ATTACH_WAIT_TIMEOUT_MS);
  if (!attachStatus) {
    await appendDesktopLaunchLog({
      event: "attach-timeout",
      requestId: attachRequest.requestId,
      targetRoot: attachRequest.targetRoot,
      launchSource: "existing-session",
      detail: `no existing session acknowledged within ${DESKTOP_ATTACH_WAIT_TIMEOUT_MS}ms`
    });
  }
  return attachStatus;
}

async function warmDesktopRegistration(repoRoot?: string, targetRoot?: string): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }

  const installedBundle = buildDesktopLaunchCandidates(repoRoot, targetRoot)
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
  if (resolveDesktopLaunchMode(repoRoot) === "developer-source") {
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
  const launchMode = resolveDesktopLaunchMode(repoRoot);

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

  const installedCandidates = buildInstalledDesktopCandidates();
  if (launchMode === "installed-user") {
    candidates.push(...installedCandidates);
  }

  if (launchMode === "developer-source") {
    const discoveredSourceRoots = dedupeResolvedPaths([
      repoRoot,
      findNearestSourceProductCheckout(process.cwd()),
      targetRoot ? findNearestSourceProductCheckout(targetRoot) : null
    ]);

    for (const sourceRoot of discoveredSourceRoots) {
      const sourceBundlePath = resolveSourceDesktopLaunchBundle(sourceRoot);
      if (!sourceBundlePath) {
        continue;
      }

      const sourceBundleExecutable = resolveMacOsBundleExecutable(sourceBundlePath);
      if (sourceBundleExecutable) {
        candidates.push({
          command: sourceBundleExecutable,
          args: [],
          launchSource: "source-bundle"
        });
      }
      candidates.push(buildDesktopCandidateFromEnvValue(sourceBundlePath, "source-bundle"));
    }
    candidates.push(...installedCandidates);
  }

  if (process.platform === "darwin") {
    candidates.push({
      command: "open",
      args: ["-a", PRODUCT_METADATA.desktop.appName],
      launchSource: "fallback-launcher"
    });
  }

  for (const binaryName of DESKTOP_BINARY_CANDIDATES) {
    candidates.push({
      command: binaryName,
      args: [],
      launchSource: "fallback-launcher"
    });
  }

  return dedupeDesktopLaunchCandidates(candidates);
}

function buildInstalledDesktopCandidates(): DesktopLaunchCandidate[] {
  const candidates: DesktopLaunchCandidate[] = [];
  const receipt = loadDesktopInstallReceipt();
  const receiptCandidate = buildDesktopCandidateFromInstallReceipt(receipt);
  if (receiptCandidate) {
    candidates.push(receiptCandidate);
  }

  if (process.platform === "darwin") {
    for (const installedBundlePath of buildInstalledMacOsDesktopBundlePaths()) {
      candidates.push(buildDesktopCandidateFromEnvValue(installedBundlePath, "installed-bundle"));
    }
  }

  if (process.platform === "win32") {
    for (const installedExecutablePath of buildInstalledWindowsDesktopExecutablePaths()) {
      candidates.push({
        command: installedExecutablePath,
        args: [],
        launchSource: "installed-bundle"
      });
    }
  }

  return dedupeDesktopLaunchCandidates(candidates);
}

function loadDesktopInstallReceipt(): DesktopInstallReceipt | null {
  const receiptPath = resolveDesktopInstallReceiptPath();
  if (!existsSync(receiptPath)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(receiptPath, "utf8")) as Partial<DesktopInstallReceipt>;
    if (
      typeof payload.executablePath !== "string"
      || typeof payload.buildSource !== "string"
      || typeof payload.runtimeMode !== "string"
    ) {
      return null;
    }

    return {
      appVersion: typeof payload.appVersion === "string" ? payload.appVersion : "unknown",
      bundleId: typeof payload.bundleId === "string" ? payload.bundleId : PRODUCT_METADATA.desktop.bundleIdentifier,
      executablePath: payload.executablePath,
      buildSource: payload.buildSource as DesktopLaunchSource,
      runtimeMode: payload.runtimeMode as DesktopLaunchMode,
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : ""
    };
  } catch {
    return null;
  }
}

function buildDesktopCandidateFromInstallReceipt(receipt: DesktopInstallReceipt | null): DesktopLaunchCandidate | null {
  if (!receipt || receipt.runtimeMode !== "installed-user" || !existsSync(receipt.executablePath)) {
    return null;
  }

  if (process.platform === "darwin") {
    const bundlePath = resolveMacOsAppBundlePathFromExecutable(receipt.executablePath);
    if (bundlePath) {
      return buildDesktopCandidateFromEnvValue(bundlePath, "installed-bundle");
    }
  }

  return {
    command: receipt.executablePath,
    args: [],
    launchSource: "installed-bundle"
  };
}

function resolveMacOsAppBundlePathFromExecutable(executablePath: string): string | null {
  const segments = executablePath.split(`${path.sep}Contents${path.sep}MacOS${path.sep}`);
  return segments.length === 2 ? segments[0] ?? null : null;
}

function buildInstalledWindowsDesktopExecutablePaths(): string[] {
  const executableName = `${PRODUCT_METADATA.desktop.appName}.exe`;
  const candidates = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", PRODUCT_METADATA.desktop.appName, executableName) : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, PRODUCT_METADATA.desktop.appName, executableName) : null,
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], PRODUCT_METADATA.desktop.appName, executableName) : null
  ];

  return dedupeResolvedPaths(candidates);
}

function dedupeDesktopLaunchCandidates(candidates: DesktopLaunchCandidate[]): DesktopLaunchCandidate[] {
  const seen = new Set<string>();
  const deduped: DesktopLaunchCandidate[] = [];

  for (const candidate of candidates) {
    const comparable = [candidate.command, ...candidate.args].map((part) => resolveComparablePath(part)).join("::");
    if (seen.has(comparable)) {
      continue;
    }
    seen.add(comparable);
    deduped.push(candidate);
  }

  return deduped;
}

function dedupeResolvedPaths(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const resolved = resolveComparablePath(candidate);
    if (seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    deduped.push(candidate);
  }

  return deduped;
}

function resolveComparablePath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return path.resolve(candidate);
  }
}

function describeDesktopLaunchCandidate(candidate: DesktopLaunchCandidate): string {
  const [firstArg = ""] = candidate.args;

  if (
    candidate.command.includes("/src-tauri/target/release/bundle/macos/")
    || firstArg.includes("/src-tauri/target/release/bundle/macos/")
  ) {
    return "the local source bundle";
  }

  if (
    candidate.command === "open"
    && firstArg.endsWith(".app")
    && (firstArg.startsWith("/Applications/") || firstArg.includes("/Applications/"))
  ) {
    return firstArg;
  }

  if (process.platform === "win32" && candidate.launchSource === "installed-bundle") {
    return `${PRODUCT_METADATA.desktop.appName} installed app`;
  }

  if (candidate.command === "open" && firstArg === "-a") {
    return `${PRODUCT_METADATA.desktop.appName} from LaunchServices`;
  }

  if (candidate.command === "node" && firstArg.endsWith(".js")) {
    return "the desktop launcher script";
  }

  return candidate.command;
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
    const candidateRequest: DesktopLaunchRequest = {
      ...launchRequest,
      launchSource: candidate.launchSource
    };
    await writeDesktopLaunchRequest(candidateRequest);
    await appendDesktopLaunchLog({
      event: "launch-requested",
      requestId: candidateRequest.requestId,
      targetRoot: candidateRequest.targetRoot,
      launchSource: candidate.launchSource,
      detail: describeDesktopLaunchCandidate(candidate)
    });
    if (await tryLaunchDesktopCandidate(candidate, candidateRequest)) {
      await appendDesktopLaunchLog({
        event: "launch-dispatched",
        requestId: candidateRequest.requestId,
        targetRoot: candidateRequest.targetRoot,
        launchSource: candidate.launchSource,
        detail: describeDesktopLaunchCandidate(candidate),
        command: candidate.command,
        args: candidate.args
      });
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

function buildDesktopCandidateFromEnvValue(value: string, defaultLaunchSource: DesktopLaunchSource = "fallback-launcher"): DesktopLaunchCandidate {
  const launchSource = inferDesktopLaunchSourceFromValue(value, defaultLaunchSource);
  if (process.platform === "darwin" && value.endsWith(".app")) {
    return {
      command: "open",
      args: [value],
      launchSource
    };
  }

  if (value.endsWith(".js")) {
    return {
      command: "node",
      args: [value],
      launchSource
    };
  }

  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(value)) {
    return {
      command: "cmd.exe",
      args: ["/c", value],
      launchSource
    };
  }

  if (process.platform === "win32" && /\.ps1$/i.test(value)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", value],
      launchSource
    };
  }

  return {
    command: value,
    args: [],
    launchSource
  };
}

function inferDesktopLaunchSourceFromValue(
  value: string,
  defaultLaunchSource: DesktopLaunchSource
): DesktopLaunchSource {
  if (defaultLaunchSource !== "fallback-launcher") {
    return defaultLaunchSource;
  }

  if (value.includes(`${path.sep}src-tauri${path.sep}target${path.sep}release${path.sep}bundle${path.sep}macos${path.sep}`)) {
    return "source-bundle";
  }

  if (
    process.platform === "win32"
    && (
      value.toLowerCase().includes(`${path.sep}program files${path.sep}`)
      || value.toLowerCase().includes(`${path.sep}appdata${path.sep}local${path.sep}programs${path.sep}`)
    )
  ) {
    return "installed-bundle";
  }

  if (value.endsWith(".app") && (value.startsWith("/Applications/") || value.includes(`${path.sep}Applications${path.sep}`))) {
    return "installed-bundle";
  }

  return defaultLaunchSource;
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

async function waitForDesktopLaunchStatus(requestId: string, timeoutMs: number): Promise<DesktopLaunchStatus | DesktopLaunchObservation | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const status = await readDesktopLaunchStatus();
    if (status?.requestId === requestId) {
      return status;
    }

    const observation = await readDesktopLaunchObservation(requestId);
    if (observation) {
      return observation;
    }

    await delay(DESKTOP_LAUNCH_POLL_INTERVAL_MS);
  }

  return null;
}

async function readDesktopLaunchStatus(): Promise<DesktopLaunchStatus | null> {
  try {
    const payload = await fs.readFile(resolveDesktopLaunchStatusPath(), "utf8");
    const parsed = JSON.parse(payload) as Partial<DesktopLaunchStatus>;
    if (
      parsed == null
      || parsed.requestId == null
      || parsed.targetRoot == null
      || parsed.state == null
      || parsed.detail == null
      || parsed.reportedAt == null
      || typeof parsed.revision !== "number"
    ) {
      return null;
    }

    return parsed as DesktopLaunchStatus;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    return null;
  }
}

async function readDesktopLaunchObservation(requestId: string): Promise<DesktopLaunchObservation | null> {
  try {
    const payload = await fs.readFile(resolveDesktopLaunchLogPath(), "utf8");
    const entries = payload
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DesktopLaunchLogEntry)
      .filter((entry) => entry.requestId === requestId);

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!entry) {
        continue;
      }

      if (
        entry.event === "desktop-request-observed"
        || entry.event === "ui-launch-request-received"
        || entry.event === "desktop-repo-state-requested"
      ) {
        const hydratingObservation: DesktopLaunchObservation = {
          requestId,
          targetRoot: entry.targetRoot ?? "",
          state: "hydrating",
          detail: "The app is open and the repo is still hydrating. Watch the desktop for final readiness.",
          reportedAt: entry.reportedAt
        };
        const launchSource = inferLaunchSourceForRequest(entries, index);
        if (launchSource) {
          hydratingObservation.launchSource = launchSource;
        }
        return hydratingObservation;
      }
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      return null;
    }
  }

  return null;
}

async function tryLaunchDesktopCandidate(candidate: DesktopLaunchCandidate, launchRequest: DesktopLaunchRequest): Promise<boolean> {
  await appendDesktopLaunchLog({
    event: "launch-attempt",
    requestId: launchRequest.requestId,
    targetRoot: launchRequest.targetRoot,
    launchSource: candidate.launchSource,
    command: candidate.command,
    args: candidate.args
  });

  return await new Promise((resolve) => {
    let settled = false;
    let stderrOutput = "";
    const settleProcessExit = async (code: number | null, signal: NodeJS.Signals | null) => {
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
        launchSource: candidate.launchSource,
        command: candidate.command,
        args: candidate.args,
        detail: failureDetail || "desktop launch candidate exited before Kiwi Control could open"
      });
      resolve(false);
    };
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
        launchSource: candidate.launchSource,
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
        launchSource: candidate.launchSource,
        command: candidate.command,
        args: candidate.args
      });

      setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        child.stderr?.destroy();
        child.unref();
        resolve(true);
      }, DESKTOP_LAUNCH_PROBE_SETTLE_MS);
    });

    child.once("close", async (code, signal) => {
      await settleProcessExit(code, signal);
    });

    child.once("exit", async (code, signal) => {
      await settleProcessExit(code, signal);
    });
  });
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

function inferLaunchSourceForRequest(
  entries: DesktopLaunchLogEntry[],
  startIndex: number
): DesktopLaunchSource | undefined {
  for (let index = startIndex; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.launchSource) {
      return entry.launchSource;
    }
  }

  return undefined;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
