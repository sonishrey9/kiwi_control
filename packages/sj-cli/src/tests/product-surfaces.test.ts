import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { runSpecialists } from "../commands/specialists.js";
import { buildDesktopUnavailableMessage, resolveDesktopLaunchRequestPath, runUi } from "../commands/ui.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
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

test("ui command launches an env-configured desktop launcher when not in json mode", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-launcher-"));
  const markerPath = path.join(tempDir, "launched.txt");
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  const launchRequestPath = resolveDesktopLaunchRequestPath();

  await fs.rm(launchRequestPath, { force: true });

  await fs.writeFile(
    launcherPath,
    `import { readFileSync, writeFileSync } from "node:fs";
const requestPath = ${JSON.stringify(launchRequestPath)};
const request = JSON.parse(readFileSync(requestPath, "utf8"));
writeFileSync(${JSON.stringify(markerPath)}, \`\${request.targetRoot}\\n\`, "utf8");`,
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
    assert.match(logs.join("\n"), new RegExp(`Launched Kiwi Control for ${tempDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  } finally {
    await fs.rm(launchRequestPath, { force: true });
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
  }
});

test("ui command refreshes the desktop launch request for repeated repo opens", async () => {
  const firstTarget = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-first-"));
  const secondTarget = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-second-"));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-repeat-"));
  const markerPath = path.join(tempDir, "launches.txt");
  const launcherPath = path.join(tempDir, "desktop-launcher.js");
  const launchRequestPath = resolveDesktopLaunchRequestPath();

  await fs.rm(launchRequestPath, { force: true });
  await fs.writeFile(
    launcherPath,
    `import { appendFileSync, readFileSync } from "node:fs";
const request = JSON.parse(readFileSync(${JSON.stringify(launchRequestPath)}, "utf8"));
appendFileSync(${JSON.stringify(markerPath)}, \`\${request.targetRoot}\\n\`, "utf8");`,
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
    assert.deepEqual(launchLines, [firstTarget, secondTarget]);
  } finally {
    await fs.rm(launchRequestPath, { force: true });
    if (previousDesktopLauncher === undefined) {
      delete process.env.KIWI_CONTROL_DESKTOP;
    } else {
      process.env.KIWI_CONTROL_DESKTOP = previousDesktopLauncher;
    }
  }
});

test("desktop unavailable messaging distinguishes contributor checkouts from installed CLI usage", async () => {
  const contributorMessage = buildDesktopUnavailableMessage(repoRoot());
  const installedMessage = buildDesktopUnavailableMessage(path.join(os.tmpdir(), "kiwi-control-installed-cli"));

  assert.match(contributorMessage, /npm run ui:dev/);
  assert.match(installedMessage, /Install the matching Kiwi Control desktop bundle from the GitHub Release/);
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
