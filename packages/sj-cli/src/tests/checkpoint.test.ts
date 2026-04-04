import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { runCheckpoint } from "../commands/checkpoint.js";

test("checkpoint writes git-aware checkpoint artifacts even before the first commit", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-checkpoint-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "README.md"), "# repo\n", "utf8");

  spawnSync("git", ["init"], { cwd: target, encoding: "utf8" });

  await bootstrapTarget(
    {
      repoRoot,
      targetRoot: target
    },
    config
  );

  await runCheckpoint({
    repoRoot,
    targetRoot: target,
    label: "context captured",
    logger: {
      info() {},
      warn() {},
      error() {}
    } as never
  });

  const checkpoint = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "checkpoints", "latest.json"), "utf8"));
  assert.equal(checkpoint.artifactType, "shrey-junior/checkpoint");
  assert.equal(checkpoint.dirtyState.isGitRepo, true);
  assert.equal(checkpoint.gitCommitAfter, null);
  assert.equal(Array.isArray(checkpoint.filesTouched), true);
  assert.equal(Array.isArray(checkpoint.stagedFiles), true);

  const activeRoleHints = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "active-role-hints.json"), "utf8"));
  assert.equal(activeRoleHints.latestCheckpoint, ".agent/state/checkpoints/latest.json");
  assert.match(activeRoleHints.nextSuggestedCommand, /push-check|handoff|status/);
  const markdown = await fs.readFile(path.join(target, ".agent", "state", "checkpoints", "latest.md"), "utf8");
  assert.match(markdown, /# Checkpoint/);
});

test("checkpoint fails when touched files drift outside the prepared scope", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-checkpoint-scope-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "README.md"), "# repo\n", "utf8");
  await fs.writeFile(path.join(target, "app.ts"), "export const app = true;\n", "utf8");

  spawnSync("git", ["init"], { cwd: target, encoding: "utf8" });
  spawnSync("git", ["add", "."], { cwd: target, encoding: "utf8" });
  spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], { cwd: target, encoding: "utf8" });

  await bootstrapTarget(
    {
      repoRoot,
      targetRoot: target
    },
    config
  );

  await fs.writeFile(
    path.join(target, ".agent", "state", "context-selection.json"),
    JSON.stringify({
      artifactType: "kiwi-control/context-selection",
      version: 1,
      timestamp: new Date().toISOString(),
      task: "update README docs",
      include: ["README.md"],
      exclude: [],
      reason: "docs only",
      confidence: "high",
      signals: { changedFiles: ["README.md"], recentFiles: [], importNeighbors: [], proximityFiles: [], keywordMatches: [] }
    }, null, 2),
    "utf8"
  );

  await fs.writeFile(path.join(target, "app.ts"), "export const app = false;\n", "utf8");

  const result = await runCheckpoint({
    repoRoot,
    targetRoot: target,
    label: "scope drift detected",
    logger: {
      info() {},
      warn() {},
      error() {}
    } as never
  });

  assert.equal(result, 1);

  const checkpoint = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "checkpoints", "latest.json"), "utf8"));
  assert.equal(checkpoint.checksFailed.length > 0, true);
  assert.match(checkpoint.checksFailed[0], /Prepared scope violated/);

  const currentPhase = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "current-phase.json"), "utf8"));
  assert.equal(currentPhase.status, "blocked");

  const workflow = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "workflow.json"), "utf8"));
  const checkpointStep = workflow.steps.find((step: { stepId: string }) => step.stepId === "checkpoint-progress");
  assert.equal(workflow.status, "failed");
  assert.equal(checkpointStep?.status, "failed");
  assert.match(checkpointStep?.failureReason ?? "", /Prepared scope violated/);
});
