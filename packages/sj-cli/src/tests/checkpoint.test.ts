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
