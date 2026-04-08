import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runUi } from "../commands/ui.js";
import {
  readLaunchLogEntries,
  repoRoot,
  waitForMarkerLines,
  withIsolatedDesktopLaunchBridge
} from "./helpers/desktop-launch.js";

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
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString(),
  revision: 1
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
      const logPayload = await readLaunchLogEntries(launchLogPath);
      assert.equal(exitCode, 0);
      assert.equal(finalMarker.trim(), tempDir);
      assert.match(logs.join("\n"), new RegExp(`Opened Kiwi Control via .* for ${tempDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(logs.join("\n"), /Launch source: fallback-launcher/);
      assert.equal(logPayload.some((entry) => entry.event === "launch-ready" && entry.launchSource === "fallback-launcher"), true);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command returns promptly even when the launcher process remains alive after writing ready status", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-persistent-launcher-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  const pidPath = path.join(tempDir, "launcher.pid");

  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
writeFileSync(${JSON.stringify(pidPath)}, String(process.pid), "utf8");
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "ready",
  detail: "persistent launcher ready",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString(),
  revision: 1
}, null, 2), "utf8");
setInterval(() => {}, 1_000);`,
      "utf8"
    );

    const previousDesktopLauncher = process.env.KIWI_CONTROL_DESKTOP;
    process.env.KIWI_CONTROL_DESKTOP = launcherPath;

    try {
      const launchPromise = runUi({
        repoRoot: repoRoot(),
        targetRoot: tempDir,
        logger: {
          info() {},
          warn() {},
          error() {}
        } as never
      });

      const exitCode = await Promise.race([
        launchPromise,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 4_000))
      ]);

      assert.notEqual(exitCode, "timeout");
      assert.equal(exitCode, 0);
    } finally {
      try {
        const pid = Number.parseInt((await fs.readFile(pidPath, "utf8")).trim(), 10);
        if (Number.isFinite(pid)) {
          process.kill(pid, "SIGTERM");
        }
      } catch {}

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
  reportedAt: new Date().toISOString(),
  revision: 1
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

test("ui command ignores stale launch status entries until the matching request id reports ready", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-stale-status-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: "stale-request-id",
  targetRoot: "stale-target",
  state: "ready",
  detail: "stale ready status should be ignored",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString(),
  revision: 1
}, null, 2), "utf8");
setTimeout(() => {
  writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
    requestId: request.requestId,
    targetRoot: request.targetRoot,
    state: "ready",
    detail: "matching ready status",
    launchSource: request.launchSource,
    reportedAt: new Date().toISOString(),
    revision: 2
  }, null, 2), "utf8");
}, 250);`,
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

      assert.equal(exitCode, 0);
      assert.equal(
        logPayload.some((entry) => entry.event === "launch-ready" && entry.detail === "matching ready status"),
        true
      );
      assert.equal(
        logPayload.some((entry) => entry.event === "launch-ready" && entry.detail === "stale ready status should be ignored"),
        false
      );
      assert.match(logs.join("\n"), /The app is visible and loading this repo now/i);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command reports hydrating success when the desktop has observed the request but has not written ready status yet", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-hydrating-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { appendFileSync, readFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
appendFileSync(${JSON.stringify(launchLogPath)}, JSON.stringify({
  event: "desktop-request-observed",
  reportedAt: new Date().toISOString(),
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  detail: "observed by desktop",
  launchSource: request.launchSource
}) + "\\n", "utf8");`,
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
      assert.equal(exitCode, 0);
      assert.equal(logPayload.some((entry) => entry.event === "launch-hydrating"), true);
      assert.equal(logPayload.some((entry) => entry.event === "launch-hydrating" && entry.launchSource === "fallback-launcher"), true);
      assert.match(logs.join("\n"), /repo is still hydrating/i);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command surfaces explicit desktop launch error statuses as command failures", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-launch-error-"));
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  await withIsolatedDesktopLaunchBridge(async ({ launchRequestPath, launchStatusPath, launchLogPath }) => {
    await fs.rm(launchRequestPath, { force: true });
    await fs.rm(launchStatusPath, { force: true });
    await fs.rm(launchLogPath, { force: true });

    await fs.writeFile(
      launcherPath,
      `import { readFileSync, writeFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
writeFileSync(${JSON.stringify(launchStatusPath)}, JSON.stringify({
  requestId: request.requestId,
  targetRoot: request.targetRoot,
  state: "error",
  detail: "Desktop failed to hydrate the repo state.",
  launchSource: request.launchSource,
  reportedAt: new Date().toISOString(),
  revision: 0
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
      assert.equal(
        logPayload.some((entry) => entry.event === "launch-error" && entry.detail === "Desktop failed to hydrate the repo state."),
        true
      );
      await assert.rejects(fs.access(launchRequestPath));
      assert.match(logs.join("\n"), /Desktop failed to hydrate the repo state/);
    } finally {
      if (previousDesktopLauncher === undefined) {
        delete process.env.KIWI_CONTROL_DESKTOP;
      } else {
        process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
      }
    }
  });
});

test("ui command reports a pending desktop hydration state instead of failing when the app is still opening", async () => {
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

      assert.equal(exitCode, 0);
      assert.equal(logPayload.some((entry) => entry.event === "launch-pending"), true);
      assert.match(logs.join("\n"), /repo hydration is still in progress/i);
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
