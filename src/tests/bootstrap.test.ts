import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "../core/bootstrap.js";
import { loadCanonicalConfig } from "../core/config.js";

test("bootstrap dry-run works against a missing folder without writing files", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-bootstrap-"));
  const target = path.join(tempDir, "brand-new-project");

  const plan = await bootstrapTarget(
    {
      repoRoot,
      targetRoot: target,
      dryRun: true
    },
    config
  );

  assert.equal(plan.inspection.targetKind, "empty-folder");
  assert.equal(plan.results.some((result) => result.status === "created"), true);
  const targetExists = await fs
    .access(target)
    .then(() => true)
    .catch(() => false);
  assert.equal(targetExists, false);
});

test("bootstrap applies repo-local overlays into a new folder", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-bootstrap-"));
  const target = path.join(tempDir, "python-service");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "pyproject.toml"), "[project]\nname='python-service'\n", "utf8");

  const plan = await bootstrapTarget(
    {
      repoRoot,
      targetRoot: target
    },
    config
  );

  assert.equal(plan.inspection.projectType, "python");
  const overlay = await fs.readFile(path.join(target, ".agent", "project.yaml"), "utf8");
  assert.match(overlay, /project_type: "python"|project_type: python/);
  assert.equal(await fs.readFile(path.join(target, "CLAUDE.md"), "utf8").then(() => true), true);
});

test("bootstrap preserves repo authority profile over explicit profile flags", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-bootstrap-"));
  await fs.writeFile(path.join(tempDir, "AGENTS.md"), "This repo prefers strict-production for guarded work.\n", "utf8");

  const plan = await bootstrapTarget(
    {
      repoRoot,
      targetRoot: tempDir,
      explicitProfileName: "product-build",
      dryRun: true
    },
    config
  );

  assert.equal(plan.profileName, "strict-production");
  assert.equal(plan.profileSource, "repo-authority");
});

test("bootstrap suggests backend-capable specialists for shallow app monorepos", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-bootstrap-"));
  const previousHome = process.env.SHREY_JUNIOR_HOME;
  process.env.SHREY_JUNIOR_HOME = path.join(tempDir, ".missing-global-home");

  try {
    const target = path.join(tempDir, "app-monorepo");
    await fs.mkdir(path.join(target, "apps"), { recursive: true });
    await fs.mkdir(path.join(target, "packages"), { recursive: true });
    await fs.mkdir(path.join(target, "tests"), { recursive: true });
    await fs.writeFile(path.join(target, "docker-compose.yml"), "services: {}\n", "utf8");

    const plan = await bootstrapTarget(
      {
        repoRoot,
        targetRoot: target,
        dryRun: true
      },
      config
    );

    assert.equal(plan.inspection.projectType, "node");
    assert.match(plan.starterSpecialists.join(","), /backend-specialist/);
  } finally {
    if (previousHome === undefined) {
      delete process.env.SHREY_JUNIOR_HOME;
    } else {
      process.env.SHREY_JUNIOR_HOME = previousHome;
    }
  }
});

test("bootstrap stands down when repo authority explicitly opts out", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-bootstrap-"));
  await fs.writeFile(
    path.join(tempDir, "AGENTS.md"),
    "Repo authority overrides global preferences.\nDo not use Shrey Junior routing or specialist escalation.\nOperate repo-local only.\n",
    "utf8"
  );

  const plan = await bootstrapTarget(
    {
      repoRoot,
      targetRoot: tempDir,
      dryRun: true
    },
    config
  );

  assert.equal(plan.results.length, 0);
  assert.match(plan.warnings.join(" "), /repo authority requests repo-local-only behavior/);
});
