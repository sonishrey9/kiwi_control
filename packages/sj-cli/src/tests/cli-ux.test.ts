import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { loadExecutionLog } from "@shrey-junior/sj-core/core/execution-log.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { runStatus } from "../commands/status.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function cliEntrypoint(): string {
  return path.join(repoRoot(), "packages", "sj-cli", "dist", "cli.js");
}

function runCli(args: string[], entrypoint = cliEntrypoint()): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [entrypoint, ...args], {
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  return {
    code: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runCliInCwd(
  args: string[],
  cwd: string,
  entrypoint = cliEntrypoint()
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [entrypoint, ...args], {
    cwd,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  return {
    code: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

test("--help exits cleanly and leads with the installed Kiwi Control command surface", () => {
  const result = runCli(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Kiwi Control/);
  assert.match(result.stdout, /Core commands:/);
  assert.match(result.stdout, /Commands default to the current working directory/);
  assert.match(result.stdout, /kiwi-control init/);
  assert.match(result.stdout, /kiwi-control ui/);
  assert.match(result.stdout, /Inside-folder usage:/);
  assert.match(result.stdout, /kiwi-control handoff --to qa-specialist/);
  assert.match(result.stdout, /Contributor source usage:/);
  assert.match(result.stdout, /npm run ui:dev/);
});

test("compatibility aliases still work but point new usage toward kiwi-control and kc", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-alias-"));
  const aliasPath = path.join(tempDir, "sj");
  await fs.symlink(cliEntrypoint(), aliasPath);

  const result = runCli(["--help"], aliasPath);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Compatibility alias invoked: sj/);
  assert.match(result.stdout, /Prefer kiwi-control or kc/);
});

test("unknown commands exit with usage status and corrective guidance", () => {
  const result = runCli(["does-not-exist"]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /kiwi-control usage error:/);
  assert.match(result.stderr, /unknown command: does-not-exist/);
  assert.match(result.stderr, /Core commands: init, status, check, specialists, checkpoint, handoff, ui/);
});

test("inside-folder workflow uses the current working directory by default", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-inside-folder-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "inside-folder-repo"\n}\n', "utf8");

  const initResult = runCliInCwd(["init"], repoDir);
  assert.equal(initResult.code, 0);

  const statusResult = runCliInCwd(["status"], repoDir);
  assert.equal(statusResult.code, 0);
  assert.match(statusResult.stdout, /repo status:/);
  assert.match(statusResult.stdout, /next action:/);
  assert.match(statusResult.stdout, /token summary:/);

  const checkResult = runCliInCwd(["check"], repoDir);
  assert.equal(checkResult.code, 0);

  const checkpointResult = runCliInCwd(["checkpoint", "inside-folder milestone"], repoDir);
  assert.equal(checkpointResult.code, 0);

  const handoffResult = runCliInCwd(["handoff", "--to", "qa-specialist"], repoDir);
  assert.equal(handoffResult.code, 0);
  assert.match(handoffResult.stdout, /handoff markdown:/);
});

test("status records an out-of-scope completion failure once and points back to prepare", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-scope-failure-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "scope-failure-repo"\n}\n', "utf8");
  await fs.writeFile(path.join(repoDir, "README.md"), "# repo\n", "utf8");
  await fs.writeFile(path.join(repoDir, "app.ts"), "export const app = true;\n", "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: repoDir
    },
    config
  );

  spawnSync("git", ["init"], { cwd: repoDir, encoding: "utf8" });
  spawnSync("git", ["add", "."], { cwd: repoDir, encoding: "utf8" });
  spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], { cwd: repoDir, encoding: "utf8" });

  await fs.writeFile(
    path.join(repoDir, ".agent", "state", "context-selection.json"),
    JSON.stringify({
      artifactType: "kiwi-control/context-selection",
      version: 1,
      timestamp: new Date().toISOString(),
      task: "update README docs",
      include: ["README.md"],
      exclude: [],
      reason: "docs only",
      confidence: "high",
      signals: {
        changedFiles: ["README.md"],
        recentFiles: [],
        importNeighbors: [],
        proximityFiles: [],
        keywordMatches: []
      }
    }, null, 2),
    "utf8"
  );

  await fs.writeFile(path.join(repoDir, "app.ts"), "export const app = false;\n", "utf8");

  const logs: string[] = [];
  const exitCode = await runStatus({
    repoRoot: repoRootPath,
    targetRoot: repoDir,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  assert.match(logs.join("\n"), /Refresh prepared scope/);
  assert.match(logs.join("\n"), /kiwi-control prepare "update README docs"/);

  const executionLog = await loadExecutionLog(repoDir);
  assert.equal(executionLog.entries.length, 1);
  assert.equal(executionLog.entries[0]?.success, false);
  assert.deepEqual(executionLog.entries[0]?.filesTouched, ["app.ts"]);
  assert.deepEqual(executionLog.entries[0]?.outOfScopeFiles, ["app.ts"]);
  assert.equal(executionLog.entries[0]?.completionSource, "repo-control");

  const secondLogs: string[] = [];
  const secondExitCode = await runStatus({
    repoRoot: repoRootPath,
    targetRoot: repoDir,
    logger: {
      info(message: string) {
        secondLogs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(secondExitCode, 0);
  assert.match(secondLogs.join("\n"), /Refresh prepared scope/);

  const executionLogAfterRepeat = await loadExecutionLog(repoDir);
  assert.equal(executionLogAfterRepeat.entries.length, 1);
});

test("status records a successful completion when touched files stay inside the prepared scope", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-scope-success-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "scope-success-repo"\n}\n', "utf8");
  await fs.writeFile(path.join(repoDir, "README.md"), "# repo\n", "utf8");
  await fs.writeFile(path.join(repoDir, "app.ts"), "export const app = true;\n", "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: repoDir
    },
    config
  );

  spawnSync("git", ["init"], { cwd: repoDir, encoding: "utf8" });
  spawnSync("git", ["add", "."], { cwd: repoDir, encoding: "utf8" });
  spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], { cwd: repoDir, encoding: "utf8" });

  await fs.writeFile(
    path.join(repoDir, ".agent", "state", "context-selection.json"),
    JSON.stringify({
      artifactType: "kiwi-control/context-selection",
      version: 1,
      timestamp: new Date().toISOString(),
      task: "update README docs",
      include: ["README.md"],
      exclude: [],
      reason: "docs only",
      confidence: "high",
      signals: {
        changedFiles: ["README.md"],
        recentFiles: [],
        importNeighbors: [],
        proximityFiles: [],
        keywordMatches: []
      }
    }, null, 2),
    "utf8"
  );

  await fs.writeFile(path.join(repoDir, "README.md"), "# repo\n\nUpdated docs.\n", "utf8");

  const logs: string[] = [];
  const exitCode = await runStatus({
    repoRoot: repoRootPath,
    targetRoot: repoDir,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  assert.doesNotMatch(logs.join("\n"), /Refresh prepared scope/);

  const executionLog = await loadExecutionLog(repoDir);
  assert.equal(executionLog.entries.length, 1);
  assert.equal(executionLog.entries[0]?.success, true);
  assert.deepEqual(executionLog.entries[0]?.filesTouched, ["README.md"]);
  assert.deepEqual(executionLog.entries[0]?.outOfScopeFiles ?? [], []);
});

test("status prioritizes live repo validation issues over stale continuity actions", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-live-validation-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "live-validation-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: repoDir
    },
    config
  );

  await fs.rm(path.join(repoDir, ".agent", "memory", "repo-facts.json"), { force: true });

  const logs: string[] = [];
  const exitCode = await runStatus({
    repoRoot: repoRootPath,
    targetRoot: repoDir,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  assert.match(logs.join("\n"), /next action: Restore \.agent\/memory\/repo-facts\.json — run kiwi-control check/);
  assert.doesNotMatch(logs.join("\n"), /Resume the recorded focus|Continue the active repo task|Capture current progress/);
});
