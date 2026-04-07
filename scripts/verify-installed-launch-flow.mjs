#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiModule = await import(pathToFileURL(path.join(repoRoot, "packages", "sj-cli", "dist", "commands", "ui.js")).href);
const { buildDesktopLaunchCandidates } = uiModule;

async function main() {
  if (process.platform !== "darwin") {
    console.log("Installed launch flow verification currently runs on macOS and is scaffolded for Windows through unit tests and static checks.");
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-installed-launch-flow-"));
  const sourceRepo = path.join(tempDir, "repo");
  const installedApp = path.join(tempDir, "Applications", "Kiwi Control.app");
  const installedExecutable = path.join(installedApp, "Contents", "MacOS", "Kiwi Control");
  const sourceBundle = path.join(sourceRepo, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app");
  const sourceExecutable = path.join(sourceBundle, "Contents", "MacOS", "Kiwi Control");
  const receiptPath = path.join(tempDir, "desktop-install.json");
  const previousPreference = process.env.KIWI_CONTROL_DESKTOP_PREFERENCE;
  const previousReceipt = process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
  const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
  const previousLegacyDesktopLauncher = process.env.SHREY_JUNIOR_DESKTOP;
  const previousCwd = process.cwd();

  await fs.mkdir(path.join(sourceRepo, "configs"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "scripts"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "apps", "sj-ui"), { recursive: true });
  await fs.writeFile(path.join(sourceRepo, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "scripts", "run-ui-dev.mjs"), "", "utf8");
  await fs.writeFile(path.join(sourceRepo, "apps", "sj-ui", "package.json"), "{}\n", "utf8");
  await fs.mkdir(path.dirname(installedExecutable), { recursive: true });
  await fs.mkdir(path.dirname(sourceExecutable), { recursive: true });
  await fs.writeFile(installedExecutable, "", "utf8");
  await fs.writeFile(sourceExecutable, "", "utf8");
  await fs.writeFile(
    receiptPath,
    JSON.stringify(
      {
        appVersion: "0.2.0-beta.1",
        bundleId: "com.kiwicontrol.desktop",
        executablePath: installedExecutable,
        buildSource: "installed-bundle",
        runtimeMode: "installed-user",
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    process.chdir(sourceRepo);
    process.env.KIWI_CONTROL_DESKTOP_PREFERENCE = "installed";
    process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = receiptPath;
    delete process.env.KIWI_CONTROL_DESKTOP;
    delete process.env.SHREY_JUNIOR_DESKTOP;

    const candidates = buildDesktopLaunchCandidates(sourceRepo, path.join(tempDir, "user-repo"));

    assert.deepEqual(candidates[0], {
      command: "open",
      args: [installedApp],
      launchSource: "installed-bundle"
    });
    assert.equal(candidates.some((candidate) => candidate.command === sourceExecutable), false);
    console.log("Installed launch flow verification passed.");
  } finally {
    process.chdir(previousCwd);
    restoreEnv("KIWI_CONTROL_DESKTOP_PREFERENCE", previousPreference);
    restoreEnv("KIWI_CONTROL_DESKTOP_RECEIPT_PATH", previousReceipt);
    restoreEnv("KIWI_CONTROL_DESKTOP", previousDesktopLauncher);
    restoreEnv("SHREY_JUNIOR_DESKTOP", previousLegacyDesktopLauncher);
  }
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
