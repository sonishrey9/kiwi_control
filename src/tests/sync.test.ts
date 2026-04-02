import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCanonicalConfig } from "../core/config.js";
import { initOrSyncTarget } from "../core/executor.js";
import { buildTemplateContext } from "../core/router.js";

test("sync dry-run previews writes and backup mode stores touched files", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-sync-"));
  const target = path.join(tempDir, "sample-project");
  await fs.cp(path.join(repoRoot, "examples", "sample-project"), target, { recursive: true });
  await fs.rm(path.join(target, ".agent"), { recursive: true, force: true });
  await fs.rm(path.join(target, "CLAUDE.md"), { force: true });

  const context = buildTemplateContext(target, config, {
    profileName: "strict-production",
    executionMode: "guarded"
  });

  const preview = await initOrSyncTarget(repoRoot, target, config, context, { dryRun: true, diffSummary: true });
  assert.equal(preview.some((result) => result.status === "appended" || result.status === "created"), true);

  const applied = await initOrSyncTarget(repoRoot, target, config, context, {
    backup: true,
    backupLabel: "test-backup"
  });
  assert.equal(applied.some((result) => Boolean(result.backupPath)), true);
  const backupDir = path.join(target, ".agent", "backups", "shrey-junior", "test-backup");
  const backupExists = await fs
    .access(backupDir)
    .then(() => true)
    .catch(() => false);
  assert.equal(backupExists, true);
});
