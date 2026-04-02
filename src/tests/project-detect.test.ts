import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { inspectBootstrapTarget } from "../core/project-detect.js";
import type { LoadedConfig } from "../core/config.js";

function buildConfig(): LoadedConfig {
  return {
    global: {
      defaults: {
        authority_files: ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]
      }
    },
    routing: {
      profiles: {
        "product-build": {},
        "strict-production": {},
        "documentation-heavy": {},
        "data-platform": {}
      }
    }
  } as unknown as LoadedConfig;
}

test("project detection treats a missing target as an empty folder", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-detect-"));
  const target = path.join(tempDir, "new-folder");
  const inspection = await inspectBootstrapTarget(target, buildConfig());

  assert.equal(inspection.targetKind, "empty-folder");
  assert.equal(inspection.missingTarget, true);
  assert.equal(inspection.projectType, "generic");
});

test("project detection identifies python repos and authority profile hints from safe files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-detect-"));
  await fs.mkdir(path.join(tempDir, ".git"));
  await fs.writeFile(path.join(tempDir, "pyproject.toml"), "[project]\nname='demo'\n", "utf8");
  await fs.writeFile(path.join(tempDir, "AGENTS.md"), "Use strict-production for guarded work.\n", "utf8");

  const inspection = await inspectBootstrapTarget(tempDir, buildConfig());
  assert.equal(inspection.targetKind, "existing-repo");
  assert.equal(inspection.projectType, "python");
  assert.equal(inspection.authorityProfileHint, "strict-production");
  assert.deepEqual(inspection.existingAuthorityFiles, ["AGENTS.md"]);
});

test("project detection prefers app-monorepo signals over docs folders", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-detect-"));
  await fs.mkdir(path.join(tempDir, "apps"));
  await fs.mkdir(path.join(tempDir, "packages"));
  await fs.mkdir(path.join(tempDir, "docs"));
  await fs.mkdir(path.join(tempDir, "tests"));
  await fs.writeFile(path.join(tempDir, "docker-compose.yml"), "services: {}\n", "utf8");

  const inspection = await inspectBootstrapTarget(tempDir, buildConfig());
  assert.equal(inspection.projectType, "node");
});

test("project detection notices repo-local opt-out directives", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-detect-"));
  await fs.writeFile(
    path.join(tempDir, "AGENTS.md"),
    "Repo authority overrides global preferences.\nDo not use Shrey Junior routing or specialist escalation.\n",
    "utf8"
  );

  const inspection = await inspectBootstrapTarget(tempDir, buildConfig());
  assert.match(inspection.authorityOptOut ?? "", /Repo authority overrides global preferences/);
});
