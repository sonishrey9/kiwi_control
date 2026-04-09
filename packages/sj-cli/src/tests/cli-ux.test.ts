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
import { failWorkflowStep } from "@shrey-junior/sj-core/core/workflow-engine.js";
import { transitionRuntimeExecutionState } from "@shrey-junior/sj-core/runtime/client.js";
import { runGuide } from "../commands/guide.js";
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
  assert.match(result.stdout, /kiwi-control guide/);
  assert.match(result.stdout, /Inside-folder usage:/);
  assert.match(result.stdout, /kiwi-control handoff --to qa-specialist/);
  assert.match(result.stdout, /Contributor source usage:/);
  assert.match(result.stdout, /npm run ui:dev/);
});

test("guide --json prints machine-clean json without spinner noise", () => {
  const result = runCli(["guide", "--json", "--target", repoRoot()]);

  assert.equal(result.code, 0);
  assert.doesNotMatch(result.stdout, /Guide ready|✔|\u001b\[/);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});

test("status --json stays read-only and defers heavy machine advisory work", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-status-readonly-"));
  const target = path.join(tempDir, "portable-repo");
  const machineHome = path.join(tempDir, "machine-home");
  await fs.mkdir(target, { recursive: true });
  await fs.mkdir(machineHome, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "portable-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: target
    },
    config
  );

  const previousMachineHome = process.env.KIWI_MACHINE_HOME;
  process.env.KIWI_MACHINE_HOME = machineHome;

  try {
    const logs: string[] = [];
    const exitCode = await runStatus({
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
      machineAdvisory: { note: string };
    };
    assert.match(payload.machineAdvisory.note, /fast mode/i);

    for (const relativePath of [
      ".agent/state/decision-logic.json",
      ".agent/state/execution-plan.json",
      ".agent/state/repo-control-snapshot.json"
    ]) {
      await assert.rejects(fs.access(path.join(target, relativePath)));
    }
  } finally {
    if (previousMachineHome === undefined) {
      delete process.env.KIWI_MACHINE_HOME;
    } else {
      process.env.KIWI_MACHINE_HOME = previousMachineHome;
    }
  }
});

test("guide stays read-only and does not persist an execution plan", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-guide-readonly-"));
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
  const exitCode = await runGuide({
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
  assert.doesNotThrow(() => JSON.parse(logs.join("\n")));
  await assert.rejects(fs.access(path.join(target, ".agent", "state", "execution-plan.json")));
});

test("guide rejects stray positionals and hints when target path was likely unquoted", () => {
  const result = runCli([
    "guide",
    "--json",
    "--target",
    "/Volumes/shrey",
    "ssd/my",
    "ssd-playground/My-learning-playground/remote-jobs"
  ]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /guide does not accept positional arguments/);
  assert.match(result.stderr, /If your --target path contains spaces, wrap it in quotes/);
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
  assert.match(result.stderr, /Core commands: plan, next, retry, resume, guide, prepare, validate, explain, trace, doctor, parity, runtime, repo-map, toolchain, usage, eval, init, status, check, specialists, checkpoint, handoff, ui/);
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
  assert.match(statusResult.stdout, /COMPATIBILITY\/DEBUG EXECUTION PLAN SNAPSHOT:/);
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

  const guideResult = runCliInCwd(["guide"], repoDir);
  assert.equal(guideResult.code, 0);
  assert.match(guideResult.stdout, /goal:/);
  assert.match(guideResult.stdout, /impact preview:/);
});

test("sync dry-run works from inside the repo folder without requiring --target", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-sync-inside-folder-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "inside-folder-sync-repo"\n}\n', "utf8");

  const result = runCliInCwd(["sync", "--dry-run", "--diff-summary"], repoDir);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /created: \.agent\/project\.yaml|updated: \.agent\/project\.yaml|unchanged: \.agent\/project\.yaml/);
});

test("doctor points missing repo-local state at a target-aware sync command", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-doctor-sync-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "doctor-sync-repo"\n}\n', "utf8");

  const result = runCli(["doctor", "--target", repoDir]);
  assert.equal([0, 1].includes(result.code), true);
  assert.match(result.stdout, new RegExp(`fix command: kiwi-control sync --target \"${repoDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\" --dry-run --diff-summary`));
});

test("explain prefers the blocked workflow recovery command over a stale next step", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-explain-blocked-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "explain-blocked-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: repoDir
    },
    config
  );

  await failWorkflowStep(repoDir, {
    task: "stabilize product surface launch semantics",
    stepId: "generate-run-packets",
    failureReason: "Run packets could not be generated for the current repo guidance state.",
    validation: "Generate run packets before execution can continue."
  });

  const result = runCli(["explain", "--target", repoDir]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /blocking issue:/);
  assert.match(result.stdout, /fix command:/);
  assert.match(result.stdout, /retry command:/);

  const fixCommandMatch = result.stdout.match(/fix command:\s+(.+)/);
  const nextCommandMatch = result.stdout.match(/next command:\s+(.+)/);
  assert.ok(fixCommandMatch?.[1]);
  assert.ok(nextCommandMatch?.[1]);
  assert.equal(nextCommandMatch?.[1]?.trim(), fixCommandMatch?.[1]?.trim());
});

test("next and trace prefer the blocked workflow recovery command over stale next steps", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-next-trace-blocked-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "next-trace-blocked-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: repoDir
    },
    config
  );

  await failWorkflowStep(repoDir, {
    task: "stabilize product surface launch semantics",
    stepId: "generate-run-packets",
    failureReason: "Run packets could not be generated for the current repo guidance state.",
    validation: "Generate run packets before execution can continue."
  });

  const nextResult = runCli(["next", "--json", "--target", repoDir]);
  assert.equal(nextResult.code, 0);
  const nextPayload = JSON.parse(nextResult.stdout) as {
    nextCommand: string | null;
    fixCommand?: string;
    retryCommand?: string;
  };
  assert.equal(nextPayload.nextCommand, nextPayload.fixCommand);
  assert.match(nextPayload.nextCommand ?? "", /kiwi-control run/);

  const traceResult = runCli(["trace", "--json", "--target", repoDir]);
  assert.equal(traceResult.code, 0);
  const tracePayload = JSON.parse(traceResult.stdout) as {
    nextCommand: string | null;
  };
  assert.match(tracePayload.nextCommand ?? "", /kiwi-control run/);
});

test("validate prints a fix-first recovery command when prepared scope drift blocks execution", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-validate-blocked-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "validate-blocked-repo"\n}\n', "utf8");
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
  spawnSync("git", ["checkout", "-b", "main"], { cwd: repoDir, encoding: "utf8" });
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

  const result = runCli(["validate", "update README docs", "--target", repoDir]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Prepared scope violated by touched files: app\.ts/);
  assert.match(result.stdout, /fix command:/);
  assert.match(result.stdout, /retry command:/);
  assert.match(result.stdout, /kiwi-control prepare "update README docs"/);
  assert.match(result.stdout, /kiwi-control validate "update README docs"/);
});

test("status surfaces an out-of-scope recovery path without recording execution entries", async () => {
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
  assert.match(logs.join("\n"), /COMPATIBILITY\/DEBUG EXECUTION PLAN SNAPSHOT:/);
  assert.doesNotMatch(logs.join("\n"), /Continue the active repo task/);

  const executionLog = await loadExecutionLog(repoDir);
  assert.equal(executionLog.entries.length, 0);

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
  assert.equal(executionLogAfterRepeat.entries.length, 0);
});

test("status stays read-only even when touched files remain inside the prepared scope", async () => {
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
  assert.equal(executionLog.entries.length, 0);
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

test("status prefers runtime decision state over stale compatibility execution plan", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-runtime-decision-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "runtime-decision-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot: repoRootPath,
      targetRoot: repoDir
    },
    config
  );

  await failWorkflowStep(repoDir, {
    task: "stale compatibility task",
    stepId: "validate-outcome",
    failureReason: "Compatibility plan says validation is blocked.",
    validation: "Old validation failed."
  });

  await transitionRuntimeExecutionState({
    targetRoot: repoDir,
    actor: "test",
    eventType: "prepare-completed",
    lifecycle: "packet_created",
    task: "runtime-authoritative task",
    sourceCommand: 'kiwi-control prepare "runtime-authoritative task"',
    reason: "Prepared scope is ready.",
    nextCommand: 'kiwi-control run "runtime-authoritative task"',
    blockedBy: [],
    decision: {
      currentStepId: "generate_packets",
      currentStepLabel: "Generate run packets",
      currentStepStatus: "pending",
      nextCommand: 'kiwi-control run "runtime-authoritative task"',
      readinessLabel: "Packet created",
      readinessTone: "ready",
      readinessDetail: "Prepared scope is ready.",
      nextAction: {
        action: "Generate run packets",
        command: 'kiwi-control run "runtime-authoritative task"',
        reason: "Prepared scope is ready.",
        priority: "high"
      },
      recovery: null,
      decisionSource: "runtime-transition"
    }
  });

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
  assert.match(logs.join("\n"), /execution state: packet-created/);
  assert.match(logs.join("\n"), /current step: generate_packets/);
  assert.match(logs.join("\n"), /next action: Generate run packets — run kiwi-control run "runtime-authoritative task"/);
  assert.doesNotMatch(logs.join("\n"), /Compatibility plan says validation is blocked/);
});
