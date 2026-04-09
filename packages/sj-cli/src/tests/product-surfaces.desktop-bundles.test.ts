import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  buildDesktopLaunchCandidates,
  buildDesktopUnavailableMessage
} from "../commands/ui.js";
import { repoRoot } from "./helpers/desktop-launch.js";

test("ui command prefers the local source bundle before installed app bundles when running from a source checkout", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-source-bundle-"));
  const sourceRepo = path.join(tempDir, "repo");
  const bundlePath =
    process.platform === "darwin"
      ? path.join(sourceRepo, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app")
      : null;
  const bundleExecutablePath =
    process.platform === "darwin" && bundlePath
      ? path.join(bundlePath, "Contents", "MacOS", "Kiwi Control")
      : null;

  await fs.mkdir(path.join(sourceRepo, "configs"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "scripts"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "apps", "sj-ui"), { recursive: true });
  await fs.writeFile(path.join(sourceRepo, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "scripts", "run-ui-dev.mjs"), "", "utf8");
  await fs.writeFile(path.join(sourceRepo, "apps", "sj-ui", "package.json"), "{}\n", "utf8");

  if (bundleExecutablePath) {
    await fs.mkdir(path.dirname(bundleExecutablePath), { recursive: true });
    await fs.writeFile(bundleExecutablePath, "", "utf8");
  }

  const previousCwd = process.cwd();
  const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
  const previousLegacyDesktopLauncher = process.env.SHREY_JUNIOR_DESKTOP;
  const previousReceiptPath = process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;
  process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = path.join(tempDir, "desktop-install.json");
  process.chdir(sourceRepo);

  try {
    const candidates = buildDesktopLaunchCandidates(sourceRepo);

    if (process.platform === "darwin") {
      assert.deepEqual(candidates[0], {
        command: bundleExecutablePath,
        args: [],
        launchSource: "source-bundle"
      });
      assert.deepEqual(candidates[1], {
        command: "open",
        args: [bundlePath],
        launchSource: "source-bundle"
      });
      assert.deepEqual(candidates[2], {
        command: "open",
        args: ["/Applications/Kiwi Control.app"],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[3], {
        command: "open",
        args: [path.join(os.homedir(), "Applications", "Kiwi Control.app")],
        launchSource: "installed-bundle"
      });
    } else {
      assert.equal(candidates.some((candidate) => candidate.args.includes("Kiwi Control.app")), false);
    }
  } finally {
    process.chdir(previousCwd);
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
    if (previousLegacyDesktopLauncher === undefined) {
      delete process.env.SHREY_JUNIOR_DESKTOP;
    } else {
      process.env.SHREY_JUNIOR_DESKTOP = previousLegacyDesktopLauncher;
    }
    if (previousReceiptPath === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = previousReceiptPath;
    }
  }
});

test("installed-user launch mode ignores a source checkout in the current workspace when the CLI itself is installed", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-source-cwd-bundle-"));
  const sourceRepo = path.join(tempDir, "repo");
  const installedRoot = path.join(tempDir, "installed-cli-root");
  const bundlePath =
    process.platform === "darwin"
      ? path.join(sourceRepo, "apps", "sj-ui", "src-tauri", "target", "release", "bundle", "macos", "Kiwi Control.app")
      : null;
  const bundleExecutablePath =
    process.platform === "darwin" && bundlePath
      ? path.join(bundlePath, "Contents", "MacOS", "Kiwi Control")
      : null;

  await fs.mkdir(path.join(sourceRepo, "configs"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "packages", "sj-cli"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "scripts"), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, "apps", "sj-ui"), { recursive: true });
  await fs.writeFile(path.join(sourceRepo, "configs", "global.yaml"), "version: 2\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "packages", "sj-cli", "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(sourceRepo, "scripts", "run-ui-dev.mjs"), "", "utf8");
  await fs.writeFile(path.join(sourceRepo, "apps", "sj-ui", "package.json"), "{}\n", "utf8");

  await fs.mkdir(path.join(installedRoot, "configs"), { recursive: true });
  await fs.writeFile(path.join(installedRoot, "configs", "global.yaml"), "version: 2\n", "utf8");

  if (bundleExecutablePath) {
    await fs.mkdir(path.dirname(bundleExecutablePath), { recursive: true });
    await fs.writeFile(bundleExecutablePath, "", "utf8");
  }

  const previousCwd = process.cwd();
  const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
  const previousLegacyDesktopLauncher = process.env.SHREY_JUNIOR_DESKTOP;
  const previousReceiptPath = process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;
  process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = path.join(tempDir, "desktop-install.json");
  process.chdir(sourceRepo);

  try {
    const candidates = buildDesktopLaunchCandidates(installedRoot, path.join(tempDir, "target-repo"));

    if (process.platform === "darwin") {
      assert.deepEqual(candidates[0], {
        command: "open",
        args: ["/Applications/Kiwi Control.app"],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[1], {
        command: "open",
        args: [path.join(os.homedir(), "Applications", "Kiwi Control.app")],
        launchSource: "installed-bundle"
      });
      assert.equal(candidates.some((candidate) => candidate.command === bundleExecutablePath), false);
      assert.equal(candidates.some((candidate) => candidate.args[0] === bundlePath), false);
    } else {
      assert.equal(candidates.some((candidate) => candidate.args.includes("Kiwi Control.app")), false);
    }
  } finally {
    process.chdir(previousCwd);
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
    if (previousLegacyDesktopLauncher === undefined) {
      delete process.env.SHREY_JUNIOR_DESKTOP;
    } else {
      process.env.SHREY_JUNIOR_DESKTOP = previousLegacyDesktopLauncher;
    }
    if (previousReceiptPath === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = previousReceiptPath;
    }
  }
});

test("ui command prefers installed app bundles when no source checkout bundle is available", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-installed-bundles-"));
  const installedRoot = path.join(tempDir, "installed-cli-root");
  const previousCwd = process.cwd();
  const previousReceiptPath = process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;

  await fs.mkdir(path.join(installedRoot, "configs"), { recursive: true });
  await fs.writeFile(path.join(installedRoot, "configs", "global.yaml"), "version: 2\n", "utf8");

  process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = path.join(tempDir, "desktop-install.json");
  process.chdir(tempDir);

  try {
    const candidates = buildDesktopLaunchCandidates(installedRoot, path.join(tempDir, "target-repo"));

    if (process.platform === "darwin") {
      assert.deepEqual(candidates[0], {
        command: "open",
        args: ["/Applications/Kiwi Control.app"],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[1], {
        command: "open",
        args: [path.join(os.homedir(), "Applications", "Kiwi Control.app")],
        launchSource: "installed-bundle"
      });
      assert.deepEqual(candidates[2], {
        command: "open",
        args: ["-a", "Kiwi Control"],
        launchSource: "fallback-launcher"
      });
    }
  } finally {
    process.chdir(previousCwd);
    if (previousReceiptPath === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = previousReceiptPath;
    }
  }
});

test("desktop unavailable messaging distinguishes contributor checkouts from installed CLI usage", async () => {
  const contributorMessage = buildDesktopUnavailableMessage(repoRoot());
  const installedMessage = buildDesktopUnavailableMessage(path.join(os.tmpdir(), "kiwi-control-installed-cli"));

  assert.match(contributorMessage, /npm run ui:dev/);
  assert.match(installedMessage, /Install the matching Kiwi Control desktop bundle from the GitHub Release/);
});

test("installed-user preference uses the installed desktop receipt before source bundle candidates", async () => {
  if (process.platform !== "darwin") {
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-installed-preference-"));
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
  await fs.mkdir(path.dirname(sourceExecutable), { recursive: true });
  await fs.mkdir(path.dirname(installedExecutable), { recursive: true });
  await fs.writeFile(sourceExecutable, "", "utf8");
  await fs.writeFile(installedExecutable, "", "utf8");
  await fs.writeFile(
    receiptPath,
    JSON.stringify({
      appVersion: "0.2.0-beta.1",
      bundleId: "com.kiwicontrol.desktop",
      executablePath: installedExecutable,
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      updatedAt: new Date().toISOString()
    }),
    "utf8"
  );

  process.chdir(sourceRepo);
  process.env.KIWI_CONTROL_DESKTOP_PREFERENCE = "installed";
  process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = receiptPath;
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;

  try {
    const candidates = buildDesktopLaunchCandidates(sourceRepo, path.join(tempDir, "user-repo"));
    assert.deepEqual(candidates[0], {
      command: "open",
      args: [installedApp],
      launchSource: "installed-bundle"
    });
    assert.equal(candidates.some((candidate) => candidate.command === sourceExecutable), false);
  } finally {
    process.chdir(previousCwd);
    if (previousPreference === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_PREFERENCE;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_PREFERENCE = previousPreference;
    }
    if (previousReceipt === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH;
    } else {
      process.env.KIWI_CONTROL_DESKTOP_RECEIPT_PATH = previousReceipt;
    }
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
    if (previousLegacyDesktopLauncher === undefined) {
      delete process.env.SHREY_JUNIOR_DESKTOP;
    } else {
      process.env.SHREY_JUNIOR_DESKTOP = previousLegacyDesktopLauncher;
    }
  }
});
