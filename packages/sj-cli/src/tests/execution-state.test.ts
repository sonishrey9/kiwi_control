import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  executionEventsPath,
  executionStatePath,
  loadExecutionState,
  recordExecutionState
} from "@shrey-junior/sj-core/core/execution-state.js";
import { deriveRepoReadiness } from "@shrey-junior/sj-core/core/repo-readiness.js";

test("execution state records revisions, events, and preserves the active operation", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-execution-state-"));

  const first = await recordExecutionState(tempDir, {
    type: "prepare-completed",
    lifecycle: "packet-created",
    task: "stabilize cli ui truth",
    sourceCommand: 'kiwi-control prepare "stabilize cli ui truth"',
    reason: "Prepared scope is ready.",
    nextCommand: 'kiwi-control run "stabilize cli ui truth"',
    artifacts: {
      instructions: [".agent/context/generated-instructions.md"]
    }
  });

  const second = await recordExecutionState(tempDir, {
    type: "run-packetized",
    lifecycle: "queued",
    reuseOperation: true,
    reason: "Run packets were written.",
    nextCommand: 'kiwi-control validate "stabilize cli ui truth"',
    artifacts: {
      packets: [".agent/state/latest-task-packets.json"]
    }
  });

  assert.equal(first.revision, 1);
  assert.equal(second.revision, 2);
  assert.equal(first.operationId, second.operationId);
  assert.equal(second.lifecycle, "queued");
  assert.deepEqual(second.artifacts.instructions, [".agent/context/generated-instructions.md"]);
  assert.deepEqual(second.artifacts.packets, [".agent/state/latest-task-packets.json"]);

  const stored = await loadExecutionState(tempDir, { allowLegacyFallback: false });
  assert.equal(stored.revision, 2);
  assert.equal(stored.lastEvent?.type, "run-packetized");
  assert.equal(stored.lastEvent?.lifecycle, "queued");

  const eventLog = await fs.readFile(executionEventsPath(tempDir), "utf8");
  assert.match(eventLog, /prepare-completed/);
  assert.match(eventLog, /run-packetized/);
  await fs.access(executionStatePath(tempDir));
});

test("execution state derives a blocked fallback from legacy execution artifacts when canonical state is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-execution-legacy-"));
  await fs.mkdir(path.join(tempDir, ".agent", "state"), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, ".agent", "state", "execution-plan.json"),
    JSON.stringify({
      artifactType: "kiwi-control/execution-plan",
      version: 2,
      task: "stabilize cli ui truth",
      state: "blocked",
      nextCommands: ['kiwi-control validate "stabilize cli ui truth"'],
      lastError: {
        reason: "Prepared scope violated by touched files: app.ts",
        fixCommand: 'kiwi-control prepare "stabilize cli ui truth"'
      },
      updatedAt: new Date().toISOString()
    }, null, 2),
    "utf8"
  );

  const fallback = await loadExecutionState(tempDir);
  assert.equal(fallback.revision, 0);
  assert.equal(fallback.lifecycle, "blocked");
  assert.match(fallback.reason ?? "", /Prepared scope violated/);
  assert.equal(fallback.nextCommand, 'kiwi-control prepare "stabilize cli ui truth"');
});

test("repo readiness uses canonical blocked execution truth", () => {
  const readiness = deriveRepoReadiness({
    repoState: {
      mode: "healthy",
      title: "Repo state is healthy",
      detail: "Repo-local state is readable."
    },
    validation: {
      errors: 0,
      warnings: 0
    },
    executionState: {
      artifactType: "kiwi-control/execution-state",
      version: 1,
      revision: 4,
      operationId: "op-1",
      task: "stabilize cli ui truth",
      sourceCommand: 'kiwi-control validate "stabilize cli ui truth"',
      lifecycle: "blocked",
      reason: "Prepared scope violated by touched files: app.ts",
      nextCommand: 'kiwi-control prepare "stabilize cli ui truth"',
      blockedBy: ["Prepared scope violated by touched files: app.ts"],
      lastUpdatedAt: new Date().toISOString(),
      artifacts: {},
      lastEvent: null
    }
  });

  assert.equal(readiness.label, "Workflow blocked");
  assert.equal(readiness.tone, "blocked");
  assert.equal(readiness.nextCommand, 'kiwi-control prepare "stabilize cli ui truth"');
});
