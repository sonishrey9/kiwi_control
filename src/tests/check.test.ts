import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "../core/bootstrap.js";
import { loadCanonicalConfig } from "../core/config.js";
import { runCheck } from "../commands/check.js";

test("check fails for initialized repos missing required contract files", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-check-"));
  const target = path.join(tempDir, "portable-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "portable-repo"\n}\n', "utf8");

  await bootstrapTarget(
    {
      repoRoot,
      targetRoot: target
    },
    config
  );

  await fs.rm(path.join(target, ".github", "workflows", "shrey-junior-contract.yml"), { force: true });

  const logs: string[] = [];
  const exitCode = await runCheck({
    repoRoot,
    targetRoot: target,
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

  assert.equal(exitCode, 1);
  assert.equal(logs.some((line) => line.includes("generated repo-local state missing") && line.includes(".github/workflows/shrey-junior-contract.yml")), true);
});

test("check fails when active-role-hints points at missing continuity artifacts", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const config = await loadCanonicalConfig(repoRoot);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-check-"));
  const target = path.join(tempDir, "portable-repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "pyproject.toml"), "[project]\nname='portable-repo'\n", "utf8");

  await bootstrapTarget(
    {
      repoRoot,
      targetRoot: target
    },
    config
  );

  await fs.writeFile(
    path.join(target, ".agent", "state", "active-role-hints.json"),
    JSON.stringify(
      {
        artifactType: "shrey-junior/active-role-hints",
        version: 1,
        updatedAt: "2026-04-03T00:00:00.000Z",
        activeRole: "python-specialist",
        supportingRoles: ["review-specialist", "qa-specialist"],
        authoritySource: "repo-local",
        projectType: "python",
        readNext: [".agent/state/current-phase.json", ".agent/checks.yaml"],
        nextFileToRead: ".agent/context/architecture.md",
        nextSuggestedCommand: 'shrey-junior checkpoint "milestone" --target <repo>',
        writeTargets: [".agent/tasks/*", ".agent/state/handoff/*"],
        checksToRun: ["bash .agent/scripts/verify-contract.sh"],
        stopConditions: ["stop when repo authority conflicts"],
        nextAction: "Run shrey-junior status --target <repo> before continuing.",
        searchGuidance: {
          inspectCodebaseFirst: true,
          repoDocsFirst: true,
          useExternalLookupWhen: ["repo docs are insufficient"],
          avoidExternalLookupWhen: ["the repo already answers the question"]
        },
        latestCheckpoint: ".agent/state/checkpoints/latest.json",
        latestTaskPacket: ".agent/state/latest-task-packets.json",
        latestHandoff: ".agent/state/handoff/latest.json",
        latestDispatchManifest: null,
        latestReconcile: null
      },
      null,
      2
    ),
    "utf8"
  );

  const logs: string[] = [];
  const exitCode = await runCheck({
    repoRoot,
    targetRoot: target,
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

  assert.equal(exitCode, 1);
  assert.equal(logs.some((line) => line.includes("active role hints pointer is stale") && line.includes("latestTaskPacket")), true);
});
