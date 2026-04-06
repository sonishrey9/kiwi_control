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
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;
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
  }
});

test("ui command still offers installed app bundles after the current workspace source bundle", async () => {
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
  delete process.env.KIWI_CONTROL_DESKTOP;
  delete process.env.SHREY_JUNIOR_DESKTOP;
  process.chdir(sourceRepo);

  try {
    const candidates = buildDesktopLaunchCandidates(installedRoot, path.join(tempDir, "target-repo"));

    if (process.platform === "darwin") {
      assert.equal(candidates[0]?.args.length, 0);
      assert.equal(candidates[0]?.launchSource, "source-bundle");
      assert.equal(await fs.realpath(candidates[0]?.command ?? ""), await fs.realpath(bundleExecutablePath ?? ""));
      assert.equal(candidates[1]?.command, "open");
      assert.equal(candidates[1]?.args.length, 1);
      assert.equal(candidates[1]?.launchSource, "source-bundle");
      assert.equal(await fs.realpath(candidates[1]?.args[0] ?? ""), await fs.realpath(bundlePath ?? ""));
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
  }
});

test("ui command prefers installed app bundles when no source checkout bundle is available", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-installed-bundles-"));
  const installedRoot = path.join(tempDir, "installed-cli-root");
  const previousCwd = process.cwd();

  await fs.mkdir(path.join(installedRoot, "configs"), { recursive: true });
  await fs.writeFile(path.join(installedRoot, "configs", "global.yaml"), "version: 2\n", "utf8");

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
  }
});

test("desktop unavailable messaging distinguishes contributor checkouts from installed CLI usage", async () => {
  const contributorMessage = buildDesktopUnavailableMessage(repoRoot());
  const installedMessage = buildDesktopUnavailableMessage(path.join(os.tmpdir(), "kiwi-control-installed-cli"));

  assert.match(contributorMessage, /npm run ui:dev/);
  assert.match(installedMessage, /Install the matching Kiwi Control desktop bundle from the GitHub Release/);
});
