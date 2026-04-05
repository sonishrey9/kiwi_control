import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { computeAdaptiveWeights, loadContextFeedback } from "@shrey-junior/sj-core/core/context-feedback.js";
import { loadExecutionLog } from "@shrey-junior/sj-core/core/execution-log.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
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
  assert.match(result.stdout, /kiwi-control toolchain/);
  assert.match(result.stdout, /kiwi-control usage/);
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
  assert.match(result.stdout, /Compatibility alias invoked\./);
  assert.match(result.stdout, /Prefer kiwi-control or kc/);
});

test("unknown commands exit with usage status and corrective guidance", () => {
  const result = runCli(["does-not-exist"]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /kiwi-control usage error:/);
  assert.match(result.stderr, /unknown command: does-not-exist/);
  assert.match(result.stderr, /Core commands: plan, next, retry, resume, prepare, validate, explain, trace, doctor, toolchain, usage, eval, init, status, check, specialists, checkpoint, handoff, ui/);
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
  assert.match(statusResult.stdout, /NEXT ACTION PLAN:/);
  assert.match(statusResult.stdout, /Run: kiwi-control prepare/);
  assert.match(statusResult.stdout, /Run: kiwi-control validate/);

  const checkResult = runCliInCwd(["check"], repoDir);
  assert.equal(checkResult.code, 0);

  const planResult = runCliInCwd(["plan", "describe your task"], repoDir);
  assert.equal(planResult.code, 0);
  assert.match(planResult.stdout, /plan created:/);

  const nextResult = runCliInCwd(["next"], repoDir);
  assert.equal(nextResult.code, 0);
  assert.match(nextResult.stdout, /next command:/);
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
  assert.match(logs.join("\n"), /Prepare bounded context/);
  assert.match(logs.join("\n"), /kiwi-control prepare "update README docs"/);
  assert.match(logs.join("\n"), /NEXT ACTION PLAN:/);
  assert.doesNotMatch(logs.join("\n"), /Continue the active repo task/);

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
  assert.match(secondLogs.join("\n"), /Prepare bounded context/);

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

test("status exposes a compact context tree and the repo state keeps docs branches expanded", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-context-tree-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(path.join(repoDir, "docs"), { recursive: true });
  await fs.mkdir(path.join(repoDir, "src"), { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "context-tree-repo"\n}\n', "utf8");
  await fs.writeFile(path.join(repoDir, "README.md"), "# repo\n", "utf8");
  await fs.writeFile(path.join(repoDir, "docs", "guide.md"), "# guide\n", "utf8");
  await fs.writeFile(path.join(repoDir, "src", "app.ts"), "export const app = true;\n", "utf8");

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
      version: 2,
      timestamp: new Date().toISOString(),
      task: "update README docs",
      include: ["README.md"],
      exclude: [],
      reason: "docs only",
      confidence: "medium",
      signals: {
        changedFiles: ["README.md"],
        recentFiles: ["README.md", "docs/guide.md", "src/app.ts"],
        importNeighbors: [],
        proximityFiles: ["docs/guide.md", "src/app.ts"],
        keywordMatches: ["README.md", "docs/guide.md"],
        repoContextFiles: []
      }
    }, null, 2),
    "utf8"
  );

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
  assert.match(logs.join("\n"), /context tree:/);
  assert.match(logs.join("\n"), /✓ README\.md/);
  assert.match(logs.join("\n"), /▾ • docs\//);
  assert.match(logs.join("\n"), /▸ × src\//);

  const controlState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: repoDir
  });
  const tree = controlState.kiwiControl.contextView.tree;

  const docsNode = tree.nodes.find((node) => node.path === "docs");
  const srcNode = tree.nodes.find((node) => node.path === "src");
  assert.equal(docsNode?.expanded, true);
  assert.equal(srcNode?.expanded, false);
  assert.deepEqual(
    tree.nodes.filter((node) => node.kind === "file").map((node) => node.path),
    ["README.md"]
  );
});

test("successful completion records adaptive feedback and the next similar run can use it", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-feedback-runtime-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.mkdir(path.join(repoDir, "src"), { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "feedback-runtime-repo"\n}\n', "utf8");
  await fs.writeFile(path.join(repoDir, "README.md"), "# repo\n", "utf8");
  await fs.writeFile(path.join(repoDir, "src", "app.ts"), "export const app = true;\n", "utf8");

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

  const prepareResult = runCliInCwd(["prepare", "update README docs"], repoDir);
  assert.equal(prepareResult.code, 0);

  await fs.writeFile(path.join(repoDir, "README.md"), "# repo\n\nUpdated docs.\n", "utf8");

  const validateResult = runCliInCwd(["validate", "update README docs"], repoDir);
  assert.equal(validateResult.code, 0);

  const checkpointResult = runCliInCwd(["checkpoint", "docs milestone"], repoDir);
  assert.equal(checkpointResult.code, 0);

  const feedbackState = await loadContextFeedback(repoDir);
  assert.equal(feedbackState.entries.length, 1);
  assert.equal(feedbackState.entries[0]?.completionSource, "checkpoint");
  assert.equal(feedbackState.entries[0]?.taskScope, "docs::docs");
  assert.deepEqual(feedbackState.entries[0]?.usedFiles, ["README.md"]);

  const repeatedPrepareResult = runCliInCwd(["prepare", "update docs guide"], repoDir);
  assert.equal(repeatedPrepareResult.code, 0);

  const weights = await computeAdaptiveWeights(repoDir, "update docs guide");
  const unrelatedWeights = await computeAdaptiveWeights(repoDir, "fix implementation bug");

  assert.equal(weights.boosted.get("README.md"), 2);
  assert.equal(unrelatedWeights.boosted.has("README.md"), false);
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
  assert.match(logs.join("\n"), /next action: Fix the blocking execution issue — run kiwi-control doctor/);
  assert.match(logs.join("\n"), /generated repo-local state missing/);
  assert.doesNotMatch(logs.join("\n"), /Resume the recorded focus|Continue the active repo task|Capture current progress/);
});
