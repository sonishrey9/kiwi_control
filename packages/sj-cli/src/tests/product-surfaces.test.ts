import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { runSpecialists } from "../commands/specialists.js";
import {
  buildDesktopLaunchCandidates,
  buildDesktopUnavailableMessage,
  resolveDesktopLaunchLogPath,
  resolveDesktopLaunchRequestPath,
  resolveDesktopLaunchStatusPath,
  runUi
} from "../commands/ui.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

async function withIsolatedDesktopLaunchBridge<T>(
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

test("specialists command exposes canonical specialist ids and curated MCP packs in json mode", async () => {
  const logs: string[] = [];
  const exitCode = await runSpecialists({
    repoRoot: repoRoot(),
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    specialists: Array<{ specialistId: string }>;
    mcpPacks: Array<{ id: string }>;
  };

  assert.equal(payload.specialists.some((entry) => entry.specialistId === "ios-specialist"), true);
  assert.equal(payload.specialists.some((entry) => entry.specialistId === "android-specialist"), true);
  assert.equal(payload.mcpPacks.some((entry) => entry.id === "web-qa-pack"), true);
});

test("ui command returns structured repo-control state in json mode", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-"));
  const target = path.join(tempDir, "portable-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "portable-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    repoState: { mode: string };
    repoOverview: Array<{ label: string }>;
    continuity: Array<{ label: string }>;
    memoryBank: Array<{ label: string; present: boolean }>;
    specialists: { recommendedSpecialist: string };
    mcpPacks: { suggestedPack: { id: string } };
    validation: { ok: boolean };
  };

  assert.equal(payload.repoState.mode, "healthy");
  assert.equal(payload.repoOverview.some((entry) => entry.label === "Project type"), true);
  assert.equal(payload.continuity.some((entry) => entry.label === "Latest checkpoint"), true);
  assert.equal(payload.memoryBank.some((entry) => entry.label === "Repo Facts" && entry.present), true);
  assert.match(payload.specialists.recommendedSpecialist, /-specialist$/);
  assert.equal(typeof payload.mcpPacks.suggestedPack.id, "string");
  assert.equal(payload.validation.ok, true);
});

test("ui command reports repo-not-initialized for an uninitialized generic repo while still returning json", async () => {
  const repoRootPath = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-empty-"));
  const target = path.join(tempDir, "empty-repo");
  await fs.mkdir(target, { recursive: true });

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    repoState: { mode: string; detail: string };
    validation: { warnings: number };
  };

  assert.equal(payload.repoState.mode, "repo-not-initialized");
  assert.match(payload.repoState.detail, /kiwi-control init in this folder/);
  assert.equal(payload.validation.warnings > 0, true);
});

test("ui command reports initialized-invalid for drifted repo-local state while still returning json", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-invalid-"));
  const target = path.join(tempDir, "invalid-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "invalid-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  await fs.rm(path.join(target, ".agent", "memory", "repo-facts.json"), { force: true });

  const logs: string[] = [];
  const exitCode = await runUi({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    repoState: { mode: string };
    validation: { errors: number };
  };

  assert.equal(payload.repoState.mode, "initialized-invalid");
  assert.equal(payload.validation.errors > 0, true);
});

test("ui command waits for a matching ready status before reporting desktop launch success", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-launcher-"));
  const markerPath = path.join(tempDir, "launched.txt");
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const requestPath = ${JSON.stringify(launchRequestPath)};
const statusPath = ${JSON.stringify(launchStatusPath)};
const request = JSON.parse(readFileSync(requestPath, "utf8"));
writeFileSync(${JSON.stringify(markerPath)}, \`\${request.targetRoot}\\n\`, "utf8");
writeFileSync(statusPath, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "ready",
  detail: "visible window shown",
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn() {},
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const marker = await fs.readFile(markerPath, "utf8");
          assert.match(marker, /launched/);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const finalMarker = await fs.readFile(markerPath, "utf8");
      assert.equal(exitCode, 0);
      assert.equal(finalMarker.trim(), tempDir);
      assert.match(logs.join("\n"), new RegExp(`Opened Kiwi Control for ${tempDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command refreshes the desktop launch request for repeated repo opens", async () => {
  const firstTarget = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-first-"));
  const secondTarget = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-second-"));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-repeat-"));
  const markerPath = path.join(tempDir, "launches.txt");
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });
    await fs.writeFile(
      launcherPath,
      `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
appendFileSync(${JSON.stringify(markerPath)}, \`\${request.requestId}|\${request.targetRoot}\\n\`, "utf8");
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "ready",
  detail: "retargeted window",
  reportedAt: new Date().toISOString()
}, null, 2), "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logger = {
        info() {},
        warn() {},
        error() {}
      } as never;

      await runUi({
        repoRoot: repoRoot(),
        targetRoot: firstTarget,
        logger
      });

      await waitForMarkerLines(markerPath, 1);

      await runUi({
        repoRoot: repoRoot(),
        targetRoot: secondTarget,
        logger
      });

      await waitForMarkerLines(markerPath, 2);

      const launchLines = (await fs.readFile(markerPath, "utf8")).trim().split("\n");
      const [firstLaunch, secondLaunch] = launchLines.map((line) => {
        const [requestId, targetRoot] = line.split("|");
        return { requestId, targetRoot };
      });

      assert.ok(firstLaunch);
      assert.ok(secondLaunch);
      assert.equal(firstLaunch.targetRoot, firstTarget);
      assert.equal(secondLaunch.targetRoot, secondTarget);
      assert.notEqual(firstLaunch.requestId, secondLaunch.requestId);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command prefers a locally built Kiwi Control app bundle when the source checkout has one", async () => {
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

  const candidates = buildDesktopLaunchCandidates(sourceRepo);

  if (process.platform === "darwin") {
    assert.deepEqual(candidates[0], {
      command: bundleExecutablePath,
      args: []
    });
    assert.deepEqual(candidates[1], {
      command: "open",
      args: [bundlePath]
    });
  } else {
    assert.equal(candidates.some((candidate) => candidate.args.includes("Kiwi Control.app")), false);
  }
});

test("ui command prefers a locally built Kiwi Control app bundle from the current workspace even when the installed CLI root is elsewhere", async () => {
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
  process.chdir(sourceRepo);

  try {
    const candidates = buildDesktopLaunchCandidates(installedRoot, path.join(tempDir, "target-repo"));

    if (process.platform === "darwin") {
      assert.equal(candidates[0]?.args.length, 0);
      assert.equal(await fs.realpath(candidates[0]?.command ?? ""), await fs.realpath(bundleExecutablePath ?? ""));
      assert.equal(candidates[1]?.command, "open");
      assert.deepEqual(candidates[1]?.args.length, 1);
      assert.equal(await fs.realpath(candidates[1]?.args[0] ?? ""), await fs.realpath(bundlePath ?? ""));
    } else {
      assert.equal(candidates.some((candidate) => candidate.args.includes("Kiwi Control.app")), false);
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

test("ui command times out with one exact next step when the desktop never acknowledges readiness", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-timeout-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync } from "node:fs";
readFileSync(${JSON.stringify(launchRequestPath)}, "utf8");`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);

      assert.equal(exitCode, 1);
      assert.equal(logPayload.some((entry) => entry.event === "launch-timeout"), true);
      if (process.platform === "darwin") {
        assert.match(logs.join("\n"), /Open Kiwi Control once from Applications, then run kc ui again/);
      } else {
        assert.match(logs.join("\n"), /Install the matching Kiwi Control desktop bundle from the GitHub Release|Run `npm run ui:dev`/);
      }
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command treats a launcher that exits non-zero immediately as unavailable instead of timing out", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-exit-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `process.stderr.write("desktop missing\\n");
process.exit(1);`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const logs: string[] = [];
      const exitCode = await runUi({
        repoRoot: path.join(os.tmpdir(), "kiwi-control-installed-cli"),
        targetRoot: tempDir,
        logger: {
          info(message: string) {
            logs.push(message);
          },
          warn(message: string) {
            logs.push(message);
          },
          error(message: string) {
            logs.push(message);
          }
        } as never
      });

      const logPayload = await readLaunchLogEntries(launchLogPath);

      assert.equal(exitCode, 1);
      assert.equal(logPayload.some((entry) => entry.event === "launch-attempt-failed" && /desktop missing/.test(entry.detail ?? "")), true);
      assert.match(logs.join("\n"), /Install the matching Kiwi Control desktop bundle from the GitHub Release/);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

async function waitForMarkerLines(markerPath: string, expectedLineCount: number): Promise<void> {
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

async function readLaunchLogEntries(logPath: string): Promise<Array<{ event: string; detail?: string }>> {
  const payload = await fs.readFile(logPath, "utf8");
  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event: string; detail?: string });
}
