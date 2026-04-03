import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PRODUCT_METADATA, isSourceProductCheckout } from "@shrey-junior/sj-core";
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
  targetRoot: string;
  requestedAt: string;
}

const DESKTOP_BINARY_CANDIDATES = ["kiwi-control-ui", "kiwi-control-desktop"];

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

  await writeDesktopLaunchRequest(options.targetRoot);
  const launched = await launchDesktopControlSurface();
  if (launched) {
    options.logger.info(`Launched ${PRODUCT_METADATA.desktop.appName} for ${options.targetRoot}. It will load this repo automatically.`);
    return 0;
  }

  await clearDesktopLaunchRequest();
  options.logger.error(buildDesktopUnavailableMessage(options.repoRoot));
  return 1;
}

export function buildDesktopUnavailableMessage(repoRoot: string): string {
  if (isSourceProductCheckout(repoRoot)) {
    return `${PRODUCT_METADATA.desktop.appName} desktop is not installed from this source checkout. Run \`${PRODUCT_METADATA.cli.sourceDesktopLauncher}\`.`;
  }

  return `${PRODUCT_METADATA.desktop.appName} desktop is not installed or CLI-launchable on this machine. Install the matching ${PRODUCT_METADATA.desktop.appName} desktop bundle from the GitHub Release.`;
}

export function buildDesktopLaunchCandidates(): DesktopLaunchCandidate[] {
  const candidates: DesktopLaunchCandidate[] = [];

  for (const envName of PRODUCT_METADATA.compatibility.desktopEnvVars) {
    const value = process.env[envName]?.trim();
    if (!value) {
      continue;
    }

    candidates.push(buildDesktopCandidateFromEnvValue(value));
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

export function resolveDesktopLaunchRequestPath(): string {
  return path.join(os.tmpdir(), PRODUCT_METADATA.release.artifactPrefix, "desktop-launch-request.json");
}

async function launchDesktopControlSurface(): Promise<boolean> {
  for (const candidate of buildDesktopLaunchCandidates()) {
    if (await tryLaunchDesktopCandidate(candidate)) {
      return true;
    }
  }

  return false;
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

async function writeDesktopLaunchRequest(targetRoot: string): Promise<void> {
  const requestPath = resolveDesktopLaunchRequestPath();
  await fs.mkdir(path.dirname(requestPath), { recursive: true });
  const request: DesktopLaunchRequest = {
    targetRoot,
    requestedAt: new Date().toISOString()
  };
  await fs.writeFile(requestPath, JSON.stringify(request, null, 2), "utf8");
}

async function clearDesktopLaunchRequest(): Promise<void> {
  await fs.rm(resolveDesktopLaunchRequestPath(), { force: true });
}

async function tryLaunchDesktopCandidate(candidate: DesktopLaunchCandidate): Promise<boolean> {
  return await new Promise((resolve) => {
    const child = spawn(candidate.command, candidate.args, {
      detached: true,
      stdio: "ignore"
    });

    child.once("error", () => {
      resolve(false);
    });

    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}
