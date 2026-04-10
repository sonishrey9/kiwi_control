import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { readJson } from "@shrey-junior/sj-core/utils/fs.js";
import { runAgentPack } from "../commands/agent-pack.js";
import { runPack } from "../commands/pack.js";
import { repoRoot } from "./helpers/desktop-launch.js";

function jsonLogger(logs: string[]) {
  return {
    info(message: string) {
      logs.push(message);
    },
    warn() {},
    error() {}
  } as never;
}

test("pack status/set/clear updates runtime-backed pack policy and exported artifacts", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-pack-"));
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
  await runAgentPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: false,
    logger: jsonLogger([])
  });

  const beforeLogs: string[] = [];
  const beforeExit = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "status",
    json: true,
    logger: jsonLogger(beforeLogs)
  });
  assert.equal(beforeExit, 0);
  const before = JSON.parse(beforeLogs.join("\n")) as {
    selectedPack: string;
    selectedPackSource: string;
    explicitSelection: string | null;
    effectiveCapabilityIds: string[];
  };
  assert.equal(before.selectedPackSource, "heuristic-default");
  assert.equal(before.explicitSelection, null);

  const setLogs: string[] = [];
  const setExit = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "set",
    packId: "research-pack",
    json: true,
    logger: jsonLogger(setLogs)
  });
  assert.equal(setExit, 0);
  const setPayload = JSON.parse(setLogs.join("\n")) as {
    changed: boolean;
    selectedPack: string;
    selectedPackSource: string;
    explicitSelection: string | null;
    effectiveCapabilityIds: string[];
    artifactPaths: { selectedPack: string };
  };
  assert.equal(setPayload.changed, true);
  assert.equal(setPayload.selectedPack, "research-pack");
  assert.equal(setPayload.selectedPackSource, "runtime-explicit");
  assert.equal(setPayload.explicitSelection, "research-pack");
  assert.deepEqual(setPayload.effectiveCapabilityIds.includes("exa"), true);
  assert.deepEqual(setPayload.effectiveCapabilityIds.includes("playwright"), false);

  const selectedPackArtifact = await readJson<{
    selectedPack: string;
    selectedPackSource: string;
    explicitSelection: string | null;
  }>(path.join(target, setPayload.artifactPaths.selectedPack));
  assert.equal(selectedPackArtifact.selectedPack, "research-pack");
  assert.equal(selectedPackArtifact.selectedPackSource, "runtime-explicit");
  assert.equal(selectedPackArtifact.explicitSelection, "research-pack");

  const agentPack = await readJson<{ packSelection?: { selectedPack: string } }>(path.join(target, ".agent", "context", "agent-pack.json"));
  const repoMap = await readJson<{ packSelection?: { selectedPack: string } }>(path.join(target, ".agent", "context", "repo-map.json"));
  const readySubstrate = await readJson<{ packSelection?: { selectedPack: string; selectedPackSource: string } }>(path.join(target, ".agent", "state", "ready-substrate.json"));
  assert.equal(agentPack.packSelection?.selectedPack, "research-pack");
  assert.equal(repoMap.packSelection?.selectedPack, "research-pack");
  assert.equal(readySubstrate.packSelection?.selectedPack, "research-pack");
  assert.equal(readySubstrate.packSelection?.selectedPackSource, "runtime-explicit");

  const idempotentLogs: string[] = [];
  const idempotentExit = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "set",
    packId: "research-pack",
    json: true,
    logger: jsonLogger(idempotentLogs)
  });
  assert.equal(idempotentExit, 0);
  const idempotentPayload = JSON.parse(idempotentLogs.join("\n")) as { changed: boolean; selectedPack: string };
  assert.equal(idempotentPayload.changed, false);
  assert.equal(idempotentPayload.selectedPack, "research-pack");

  const clearLogs: string[] = [];
  const clearExit = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "clear",
    json: true,
    logger: jsonLogger(clearLogs)
  });
  assert.equal(clearExit, 0);
  const clearPayload = JSON.parse(clearLogs.join("\n")) as {
    changed: boolean;
    selectedPack: string;
    selectedPackSource: string;
    explicitSelection: string | null;
  };
  assert.equal(clearPayload.changed, true);
  assert.equal(clearPayload.selectedPackSource, "heuristic-default");
  assert.equal(clearPayload.explicitSelection, null);

  const trackedArtifacts = [
    ".agent/state/selected-pack.json",
    ".agent/state/ready-substrate.json",
    ".agent/context/agent-pack.json",
    ".agent/context/repo-map.json"
  ];
  const beforeStatusHashes = await hashFiles(target, trackedArtifacts);
  const statusLogs: string[] = [];
  const statusExit = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "status",
    json: true,
    logger: jsonLogger(statusLogs)
  });
  assert.equal(statusExit, 0);
  const afterStatusHashes = await hashFiles(target, trackedArtifacts);
  assert.deepEqual(afterStatusHashes, beforeStatusHashes);

  const clearAgainLogs: string[] = [];
  const clearAgainExit = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "clear",
    json: true,
    logger: jsonLogger(clearAgainLogs)
  });
  assert.equal(clearAgainExit, 0);
  const clearAgainPayload = JSON.parse(clearAgainLogs.join("\n")) as { changed: boolean };
  assert.equal(clearAgainPayload.changed, false);
  const afterClearAgainHashes = await hashFiles(target, trackedArtifacts);
  assert.deepEqual(afterClearAgainHashes, beforeStatusHashes);
});

test("blocked packs return an exact unavailable reason", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-pack-blocked-"));
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
  const exitCode = await runPack({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "set",
    packId: "aws-pack",
    json: true,
    logger: jsonLogger(logs)
  });
  assert.equal(exitCode, 1);
  const payload = JSON.parse(logs.join("\n")) as {
    ok: boolean;
    selectedPack: string;
    unavailablePackReason: string | null;
  };
  assert.equal(payload.ok, false);
  assert.match(payload.unavailablePackReason ?? "", /AWS Pack is blocked/i);
});

async function hashFiles(targetRoot: string, relativePaths: string[]): Promise<Record<string, string | null>> {
  const hashes: Record<string, string | null> = {};
  for (const relativePath of relativePaths) {
    const fullPath = path.join(targetRoot, relativePath);
    try {
      const content = await fs.readFile(fullPath);
      hashes[relativePath] = createHash("sha256").update(content).digest("hex");
    } catch {
      hashes[relativePath] = null;
    }
  }
  return hashes;
}
