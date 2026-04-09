import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import {
  buildRuntimeDecision,
  buildRuntimeDecisionAction
} from "@shrey-junior/sj-core/core/runtime-decision.js";
import { runRuntime } from "../commands/runtime.js";
import { repoRoot } from "./helpers/desktop-launch.js";

test("runtime --json exposes structured launch identity and canonical snapshot", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-proof-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "runtime-proof"\n}\n', "utf8");

  await bootstrapTarget({ repoRoot: repoRootPath, targetRoot: target }, config);
  await recordExecutionState(target, {
    type: "prepare-completed",
    lifecycle: "packet-created",
    task: "runtime proof",
    sourceCommand: 'kiwi-control prepare "runtime proof"',
    reason: 'Prepared 1 selected files for "runtime proof".',
    nextCommand: 'kiwi-control run "runtime proof"',
    decision: buildRuntimeDecision({
      currentStepId: "generate_packets",
      currentStepStatus: "pending",
      nextCommand: 'kiwi-control run "runtime proof"',
      readinessLabel: "Packet created",
      readinessTone: "ready",
      readinessDetail: 'Prepared 1 selected files for "runtime proof".',
      nextAction: buildRuntimeDecisionAction(
        "Generate run packets",
        'kiwi-control run "runtime proof"',
        'Prepared 1 selected files for "runtime proof".',
        "high"
      ),
      decisionSource: "runtime-proof-test"
    })
  });

  const previousRuntimeDir = process.env.KIWI_CONTROL_RUNTIME_DIR;
  process.env.KIWI_CONTROL_RUNTIME_DIR = path.join(tempDir, ".runtime");

  const logs: string[] = [];
  let exitCode = 1;
  try {
    exitCode = await runRuntime({
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
  } finally {
    if (previousRuntimeDir === undefined) {
      delete process.env.KIWI_CONTROL_RUNTIME_DIR;
    } else {
      process.env.KIWI_CONTROL_RUNTIME_DIR = previousRuntimeDir;
    }
  }

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    identity: {
      launchMode: string;
      callerSurface: string;
      packagingSourceCategory: string;
      binaryPath: string;
      binarySha256: string;
      runtimeVersion: string;
      targetTriple: string;
      startedAt: string;
      metadataPath: string;
    };
    snapshot: {
      lifecycle: string;
      decision: { currentStepId: string; decisionSource: string };
    };
    derivedFreshness: Array<{ outputName: string }>;
  };

  assert.equal(payload.identity.callerSurface, "cli");
  assert.match(payload.identity.launchMode, /direct-binary|dev-cargo-fallback|sidecar/);
  assert.equal(typeof payload.identity.binaryPath, "string");
  assert.equal(payload.identity.binarySha256.length > 10, true);
  assert.equal(typeof payload.identity.runtimeVersion, "string");
  assert.equal(typeof payload.identity.targetTriple, "string");
  assert.equal(payload.snapshot.lifecycle, "packet_created");
  assert.equal(payload.snapshot.decision.currentStepId, "generate_packets");
  assert.equal(payload.snapshot.decision.decisionSource, "runtime-proof-test");
  assert.equal(Array.isArray(payload.derivedFreshness), true);
});

test("runtime --refresh-derived rewrites stale derived artifacts without changing canonical revision", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-runtime-refresh-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "runtime-refresh"\n}\n', "utf8");

  await bootstrapTarget({ repoRoot: repoRootPath, targetRoot: target }, config);
  await recordExecutionState(target, {
    type: "prepare-completed",
    lifecycle: "packet-created",
    task: "runtime refresh",
    sourceCommand: 'kiwi-control prepare "runtime refresh"',
    reason: 'Prepared 1 selected files for "runtime refresh".',
    nextCommand: 'kiwi-control run "runtime refresh"',
    decision: buildRuntimeDecision({
      currentStepId: "generate_packets",
      currentStepStatus: "pending",
      nextCommand: 'kiwi-control run "runtime refresh"',
      readinessLabel: "Packet created",
      readinessTone: "ready",
      readinessDetail: 'Prepared 1 selected files for "runtime refresh".',
      nextAction: buildRuntimeDecisionAction(
        "Generate run packets",
        'kiwi-control run "runtime refresh"',
        'Prepared 1 selected files for "runtime refresh".',
        "high"
      ),
      decisionSource: "runtime-refresh-test"
    })
  });

  for (const [relativePath, payload] of [
    [".agent/state/execution-plan.json", { stale: true }],
    [".agent/state/workflow.json", { stale: true }],
    [".agent/state/runtime-lifecycle.json", { stale: true }],
    [".agent/state/decision-logic.json", { stale: true }]
  ] as const) {
    const fullPath = path.join(target, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  const previousRuntimeDir = process.env.KIWI_CONTROL_RUNTIME_DIR;
  process.env.KIWI_CONTROL_RUNTIME_DIR = path.join(tempDir, ".runtime");

  const logs: string[] = [];
  let exitCode = 1;
  try {
    exitCode = await runRuntime({
      repoRoot: repoRootPath,
      targetRoot: target,
      refreshDerived: true,
      json: true,
      logger: {
        info(message: string) {
          logs.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
  } finally {
    if (previousRuntimeDir === undefined) {
      delete process.env.KIWI_CONTROL_RUNTIME_DIR;
    } else {
      process.env.KIWI_CONTROL_RUNTIME_DIR = previousRuntimeDir;
    }
  }

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    snapshot: { revision: number; lifecycle: string };
    derivedFreshness: Array<{ outputName: string; freshness: string; sourceRevision: number | null }>;
  };

  assert.equal(payload.snapshot.revision, 1);
  assert.equal(payload.snapshot.lifecycle, "packet_created");
  assert.deepEqual(
    payload.derivedFreshness.map((entry) => entry.outputName).sort((left, right) => left.localeCompare(right)),
    ["execution-events", "execution-state"]
  );
  assert.equal(
    payload.derivedFreshness.every((entry) => entry.freshness === "fresh" && entry.sourceRevision === 1),
    true
  );
  assert.equal(payload.derivedFreshness.some((entry) => entry.outputName === "repo-control-snapshot"), false);

  const executionPlan = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "execution-plan.json"), "utf8"));
  const workflow = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "workflow.json"), "utf8"));
  const runtimeLifecycle = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "runtime-lifecycle.json"), "utf8"));
  const decisionLogic = JSON.parse(await fs.readFile(path.join(target, ".agent", "state", "decision-logic.json"), "utf8"));
  assert.equal(executionPlan.artifactType, "kiwi-control/execution-plan");
  assert.equal(workflow.artifactType, "kiwi-control/workflow");
  assert.equal(runtimeLifecycle.artifactType, "kiwi-control/runtime-lifecycle");
  assert.equal(decisionLogic.artifactType, "kiwi-control/decision-logic");
  await assert.rejects(fs.access(path.join(target, ".agent", "state", "repo-control-snapshot.json")));
});
