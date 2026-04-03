import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { runSpecialists } from "../commands/specialists.js";
import { runUi } from "../commands/ui.js";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

test("specialists command exposes canonical specialist ids and curated MCP packs in json mode", async () => {
  const logs: string[] = [];
  const exitCode = await runSpecialists({
    repoRoot: repoRoot(),
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
    specialists: Array<{ specialistId: string }>;
    mcpPacks: Array<{ id: string }>;
  };

  assert.equal(payload.specialists.some((entry) => entry.specialistId === "ios-specialist"), true);
  assert.equal(payload.specialists.some((entry) => entry.specialistId === "android-specialist"), true);
  assert.equal(payload.mcpPacks.some((entry) => entry.id === "web-qa-pack"), true);
});

test("ui command returns structured repo-control state in json mode", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ui-"));
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
  const exitCode = await runUi({
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
    repoOverview: Array<{ label: string }>;
    continuity: Array<{ label: string }>;
    memoryBank: Array<{ label: string; present: boolean }>;
    specialists: { recommendedSpecialist: string };
    mcpPacks: { suggestedPack: { id: string } };
    validation: { ok: boolean };
  };

  assert.equal(payload.repoOverview.some((entry) => entry.label === "Project type"), true);
  assert.equal(payload.continuity.some((entry) => entry.label === "Latest checkpoint"), true);
  assert.equal(payload.memoryBank.some((entry) => entry.label === "Repo Facts" && entry.present), true);
  assert.match(payload.specialists.recommendedSpecialist, /-specialist$/);
  assert.equal(typeof payload.mcpPacks.suggestedPack.id, "string");
  assert.equal(payload.validation.ok, true);
});
