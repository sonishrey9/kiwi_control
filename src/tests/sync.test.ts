import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCanonicalConfig } from "../core/config.js";
import { initOrSyncTarget } from "../core/executor.js";
import { buildTemplateContext } from "../core/router.js";
import { runSync } from "../commands/sync.js";

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
  assert.equal(await fs.access(path.join(target, ".github", "instructions", "frontend.instructions.md")).then(() => true).catch(() => false), false);
  assert.equal(await fs.readFile(path.join(target, ".github", "agents", "qa-specialist.md"), "utf8").then(() => true), true);
  assert.equal(await fs.readFile(path.join(target, ".agent", "roles", "qa-specialist.md"), "utf8").then(() => true), true);
  assert.equal(await fs.readFile(path.join(target, ".agent", "state", "active-role-hints.json"), "utf8").then(() => true), true);
  const currentPhase = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "current-phase.json"), "utf8"));
  assert.equal(currentPhase.artifactType, "shrey-junior/current-phase");
});

test("sync preserves repo-authority profile hints and writes non-generic contract metadata", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-sync-cmd-"));
  const target = path.join(tempDir, "node-service");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "node-service"\n}\n', "utf8");
  await fs.writeFile(path.join(target, "AGENTS.md"), "This repo prefers strict-production for guarded work.\n", "utf8");

  const logs: string[] = [];
  const exitCode = await runSync({
    repoRoot,
    targetRoot: target,
    backup: false,
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

  assert.equal(exitCode, 0);
  const projectYaml = await fs.readFile(path.join(target, ".agent", "project.yaml"), "utf8");
  assert.match(projectYaml, /project_type: "node"|project_type: node/);
  assert.match(projectYaml, /profile_source: "repo-authority"|profile_source: repo-authority/);
  assert.match(projectYaml, /profile: "strict-production"|profile: strict-production/);
  assert.equal(logs.some((line) => line.includes("created: .github/agents/shrey-junior.md") || line.includes("updated: .github/agents/shrey-junior.md")), true);
});

test("sync stands down when repo authority explicitly opts out", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-sync-optout-"));
  await fs.writeFile(
    path.join(tempDir, "AGENTS.md"),
    "Repo authority overrides global preferences.\nDo not use Shrey Junior routing or specialist escalation.\nOperate repo-local only.\n",
    "utf8"
  );

  const logs: string[] = [];
  const exitCode = await runSync({
    repoRoot,
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

  assert.equal(exitCode, 0);
  assert.equal(logs.some((line) => line.includes("repo authority requests repo-local-only behavior; sync stood down")), true);
  const projectExists = await fs
    .access(path.join(tempDir, ".agent", "project.yaml"))
    .then(() => true)
    .catch(() => false);
  assert.equal(projectExists, false);
});
