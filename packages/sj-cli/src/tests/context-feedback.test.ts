import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildFeedbackSummary, computeAdaptiveWeights, loadContextFeedback, recordContextFeedback } from "@shrey-junior/sj-core/core/context-feedback.js";

test("context feedback scoring is scoped by task category instead of global file history", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-feedback-"));

  await recordContextFeedback(tempDir, {
    task: "update README docs",
    selectedFiles: ["README.md"],
    usedFiles: ["README.md"],
    unusedFiles: [],
    success: true,
    confidence: "high",
    tokensSaved: 100
  });

  const docsWeights = await computeAdaptiveWeights(tempDir, "update docs guide");
  const implementationWeights = await computeAdaptiveWeights(tempDir, "fix implementation bug");

  assert.equal(docsWeights.boosted.get("README.md"), 2);
  assert.equal(implementationWeights.boosted.has("README.md"), false);
});

test("feedback summary stays explicitly limited until enough successful completions exist", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-feedback-limited-"));

  await recordContextFeedback(tempDir, {
    task: "update README docs",
    selectedFiles: ["README.md"],
    usedFiles: ["README.md"],
    unusedFiles: [],
    success: true,
    confidence: "high",
    tokensSaved: 100,
    runKey: "run-1",
    completionSource: "checkpoint"
  });

  const state = await loadContextFeedback(tempDir);
  const summary = await buildFeedbackSummary(tempDir, "update docs guide");

  assert.equal(state.entries[0]?.taskScope, "docs::docs");
  assert.equal(summary.adaptationLevel, "limited");
  assert.match(summary.note, /limited/i);
});
