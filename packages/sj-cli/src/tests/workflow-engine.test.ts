import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { executeWorkflowStep, loadWorkflowState } from "@shrey-junior/sj-core/core/workflow-engine.js";

test("workflow engine records failed step execution and increments retry count on rerun", async () => {
  const tempDir = await fsMkdtemp(path.join(os.tmpdir(), "sj-workflow-engine-"));

  const first = await executeWorkflowStep(tempDir, {
    task: "generate packets",
    stepId: "generate-run-packets",
    input: "generate packets",
    expectedOutput: "One or more run packets are written for execution.",
    run: async () => ({ files: [] as string[] }),
    validate: () => ({
      ok: false,
      validation: "Packet output exists and at least one packet was generated.",
      failureReason: "No run packets were generated."
    }),
    summarize: () => ({
      summary: "Generated 0 task packets.",
      files: []
    })
  });

  assert.equal(first.ok, false);

  const afterFailure = await loadWorkflowState(tempDir);
  const failedStep = afterFailure.steps.find((step) => step.stepId === "generate-run-packets");
  assert.equal(afterFailure.status, "failed");
  assert.equal(failedStep?.status, "failed");
  assert.equal(failedStep?.attemptCount, 1);
  assert.equal(failedStep?.retryCount, 0);
  assert.match(failedStep?.failureReason ?? "", /No run packets were generated/);
  assert.equal(failedStep?.result.ok, false);
  assert.match(failedStep?.result.suggestedFix ?? "", /rerun kiwi-control run/i);
  assert.equal(failedStep?.result.retryCommand, 'kiwi-control run "generate packets"');

  const second = await executeWorkflowStep(tempDir, {
    task: "generate packets",
    stepId: "generate-run-packets",
    input: "generate packets",
    expectedOutput: "One or more run packets are written for execution.",
    run: async () => ({ files: ["packet-1.md"] }),
    validate: () => ({
      ok: true,
      validation: "Run packet generation completed and packet artifacts were written."
    }),
    summarize: () => ({
      summary: "Generated 1 task packet.",
      files: ["packet-1.md"]
    })
  });

  assert.equal(second.ok, true);

  const afterRetry = await loadWorkflowState(tempDir);
  const completedStep = afterRetry.steps.find((step) => step.stepId === "generate-run-packets");
  assert.equal(afterRetry.status, "running");
  assert.equal(afterRetry.currentStepId, "validate-outcome");
  assert.equal(completedStep?.status, "success");
  assert.equal(completedStep?.attemptCount, 2);
  assert.equal(completedStep?.retryCount, 1);
  assert.equal(completedStep?.failureReason, null);
  assert.equal(completedStep?.result.ok, true);
  assert.equal(completedStep?.result.summary, "Generated 1 task packet.");
});

async function fsMkdtemp(prefix: string): Promise<string> {
  const { promises: fs } = await import("node:fs");
  return fs.mkdtemp(prefix);
}
