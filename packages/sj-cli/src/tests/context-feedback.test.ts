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
  assert.equal(summary.basedOnPastRuns, false);
});

test("adaptive weights can retrieve similar successful task patterns without forcing unrelated tasks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-feedback-retrieval-"));

  await recordContextFeedback(tempDir, {
    task: "update README docs",
    selectedFiles: ["README.md"],
    usedFiles: ["README.md"],
    unusedFiles: [],
    success: true,
    confidence: "high",
    tokensSaved: 100,
    runKey: "run-1"
  });

  await recordContextFeedback(tempDir, {
    task: "improve handbook wording",
    selectedFiles: ["guidebook.md"],
    usedFiles: ["guidebook.md"],
    unusedFiles: [],
    success: true,
    confidence: "high",
    tokensSaved: 90,
    runKey: "run-2"
  });

  await recordContextFeedback(tempDir, {
    task: "refine docs handbook copy",
    selectedFiles: ["guidebook.md"],
    usedFiles: ["guidebook.md"],
    unusedFiles: [],
    success: true,
    confidence: "high",
    tokensSaved: 95,
    runKey: "run-3"
  });

  const similar = await computeAdaptiveWeights(tempDir, "polish handbook docs");
  const unrelated = await computeAdaptiveWeights(tempDir, "fix payment webhook bug");
  const summary = await buildFeedbackSummary(tempDir, "polish handbook docs");

  assert.equal(similar.basedOnPastRuns, true);
  assert.ok(similar.reusedPattern, "expected a reused pattern label");
  assert.equal(similar.similarRuns.length >= 2, true);
  assert.equal(summary.basedOnPastRuns, true);
  assert.ok(summary.reusedPattern, "expected feedback summary to surface reused pattern");
  assert.equal(summary.similarTasks.length >= 2, true);
  assert.equal(unrelated.basedOnPastRuns, false);
});
