import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  resolveDesktopLaunchLogPath,
  resolveDesktopLaunchRequestPath,
  resolveDesktopLaunchStatusPath
} from "../../commands/ui.js";

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
}

export async function withIsolatedDesktopLaunchBridge<T>(
  callback: (paths: {
    bridgeDir: string;
    launchRequestPath: string;
    launchStatusPath: string;
    launchLogPath: string;
  }) => Promise<T>
): Promise<T> {
  const previousBridgeDir = process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR;
  const bridgeDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-control-bridge-test-"));
  process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR = bridgeDir;

  try {
    return await callback({
      bridgeDir,
      launchRequestPath: resolveDesktopLaunchRequestPath(),
      launchStatusPath: resolveDesktopLaunchStatusPath(),
      launchLogPath: resolveDesktopLaunchLogPath()
    });
  } finally {
    if (previousBridgeDir === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_BRIDGE_DIR = previousBridgeDir;
    }

    await fs.rm(bridgeDir, { recursive: true, force: true });
  }
}

export async function waitForMarkerLines(markerPath: string, expectedLineCount: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const contents = await fs.readFile(markerPath, "utf8");
      const lines = contents.trim().split("\n").filter(Boolean);
      if (lines.length >= expectedLineCount) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.fail(`Timed out waiting for ${expectedLineCount} launch marker lines in ${markerPath}`);
}

export async function readLaunchLogEntries(logPath: string): Promise<Array<{ event: string; detail?: string; launchSource?: string }>> {
  const payload = await fs.readFile(logPath, "utf8");
  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event: string; detail?: string; launchSource?: string });
}
