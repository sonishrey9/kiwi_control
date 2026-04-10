import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { runSetup } from "../commands/setup.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function createLogger(lines: string[]) {
  return {
    info(message: string) {
      lines.push(message);
    },
    warn(message: string) {
      lines.push(message);
    },
    error(message: string) {
      lines.push(message);
    }
  } as never;
}

async function withTempMachineEnv<T>(fn: (ctx: {
  root: string;
  homeRoot: string;
  globalHome: string;
  pathBin: string;
  targetRoot: string;
}) => Promise<T>): Promise<T> {
  const root = repoRoot();
  const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sj-setup-home-"));
  const globalHome = path.join(homeRoot, ".kiwi-control");
  const pathBin = path.join(homeRoot, ".local", "bin");
  const targetRoot = path.join(homeRoot, "repo");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.writeFile(path.join(targetRoot, "package.json"), '{\n  "name": "setup-proof"\n}\n', "utf8");

  const previousHome = process.env.HOME;
  const previousKiwiHome = process.env.KIWI_CONTROL_HOME;
  const previousPathBin = process.env.KIWI_CONTROL_PATH_BIN;
  const previousShell = process.env.SHELL;
  process.env.HOME = homeRoot;
  process.env.KIWI_CONTROL_HOME = globalHome;
  process.env.KIWI_CONTROL_PATH_BIN = pathBin;
  process.env.SHELL = "/bin/zsh";

  try {
    return await fn({ root, homeRoot, globalHome, pathBin, targetRoot });
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    if (previousKiwiHome === undefined) {
      delete process.env.KIWI_CONTROL_HOME;
    } else {
      process.env.KIWI_CONTROL_HOME = previousKiwiHome;
    }
    if (previousPathBin === undefined) {
      delete process.env.KIWI_CONTROL_PATH_BIN;
    } else {
      process.env.KIWI_CONTROL_PATH_BIN = previousPathBin;
    }
    if (previousShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = previousShell;
    }
  }
}

test("setup status json reports ai-setup detection from ~/.local/bin and structured steps", async () => {
  await withTempMachineEnv(async ({ root, homeRoot, targetRoot }) => {
    await fs.mkdir(path.join(homeRoot, ".local", "bin"), { recursive: true });
    await fs.writeFile(path.join(homeRoot, ".local", "bin", "ai-setup"), "#!/usr/bin/env bash\n", "utf8");

    const lines: string[] = [];
    const exitCode = await runSetup({
      repoRoot: root,
      targetRoot,
      subcommand: "status",
      json: true,
      logger: createLogger(lines)
    });

    assert.equal(exitCode, 0);
    const payload = JSON.parse(lines.join("\n")) as {
      aiSetup: { detected: boolean; path: string | null };
      steps: Array<{ id: string }>;
    };
    assert.equal(payload.aiSetup.detected, true);
    assert.match(payload.aiSetup.path ?? "", /ai-setup$/);
    assert.equal(payload.steps.some((entry) => entry.id === "repo-contract"), true);
  });
});

test("setup install global-cli is idempotent across repeated runs", async () => {
  await withTempMachineEnv(async ({ root, pathBin, globalHome, targetRoot }) => {
    const firstLines: string[] = [];
    const firstExit = await runSetup({
      repoRoot: root,
      targetRoot,
      subcommand: "install",
      subject: "global-cli",
      json: true,
      logger: createLogger(firstLines)
    });

    assert.equal(firstExit, 0);
    const firstPayload = JSON.parse(firstLines.join("\n")) as {
      changed: boolean;
      stepResults: Array<{ actionId: string; changed: boolean }>;
    };
    assert.equal(firstPayload.changed, true);
    assert.equal(await fs.access(path.join(globalHome, "bin", "kiwi-control")).then(() => true).catch(() => false), true);
    assert.equal(await fs.access(path.join(pathBin, "kiwi-control")).then(() => true).catch(() => false), true);

    const secondLines: string[] = [];
    const secondExit = await runSetup({
      repoRoot: root,
      targetRoot,
      subcommand: "install",
      subject: "global-cli",
      json: true,
      logger: createLogger(secondLines)
    });

    assert.equal(secondExit, 0);
    const secondPayload = JSON.parse(secondLines.join("\n")) as {
      changed: boolean;
      stepResults: Array<{ actionId: string; changed: boolean }>;
    };
    assert.equal(secondPayload.changed, false);
    assert.equal(secondPayload.stepResults[0]?.changed, false);
  });
});

test("setup repair repo-hygiene appends supported entries once and then becomes a no-op", async () => {
  await withTempMachineEnv(async ({ root, targetRoot }) => {
    await fs.writeFile(path.join(targetRoot, ".gitignore"), "node_modules/\n", "utf8");

    const firstLines: string[] = [];
    await runSetup({
      repoRoot: root,
      targetRoot,
      subcommand: "repair",
      subject: "repo-hygiene",
      json: true,
      logger: createLogger(firstLines)
    });
    const firstPayload = JSON.parse(firstLines.join("\n")) as {
      changed: boolean;
      stepResults: Array<{ changed: boolean }>;
    };
    assert.equal(firstPayload.changed, true);

    const gitignore = await fs.readFile(path.join(targetRoot, ".gitignore"), "utf8");
    assert.match(gitignore, /\.code-review-graph\//);
    assert.match(gitignore, /\.repomix-output\.xml/);

    const secondLines: string[] = [];
    await runSetup({
      repoRoot: root,
      targetRoot,
      subcommand: "repair",
      subject: "repo-hygiene",
      json: true,
      logger: createLogger(secondLines)
    });
    const secondPayload = JSON.parse(secondLines.join("\n")) as {
      changed: boolean;
      stepResults: Array<{ changed: boolean }>;
    };
    assert.equal(secondPayload.changed, false);
    assert.equal(secondPayload.stepResults[0]?.changed, false);
  });
});
