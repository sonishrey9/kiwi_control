/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionSummary, buildMachineHeroSummary } from "./view-models.js";

test("decision summary marks execution as guarded when using warm snapshots", () => {
  const summary = buildDecisionSummary(
    {
      validation: { errors: 0, warnings: 1 },
      machineAdvisory: { systemHealth: { criticalCount: 0, warningCount: 1 } },
      repoState: { title: "Healthy" },
      kiwiControl: {
        nextActions: { actions: [{ action: "Run validation" }] },
        executionPlan: { lastError: null },
        execution: { recentExecutions: [{ success: true, timestamp: "2026-04-07T10:00:00.000Z" }] },
        workflow: { steps: [{ status: "success" }] },
        contextView: { confidence: "high" },
        indexing: { partialScan: false },
        runtimeLifecycle: { recentEvents: [{ timestamp: "2026-04-07T10:10:00.000Z" }] },
        feedback: { recentEntries: [{ timestamp: "2026-04-07T10:20:00.000Z" }] }
      }
    },
    {
      isLoadingRepoState: false,
      isRefreshingFreshRepoState: false,
      hasWarmSnapshot: true,
      formatTimestamp: (value) => value
    }
  );

  assert.equal(summary.nextAction, "Run validation");
  assert.equal(summary.executionSafety, "guarded");
  assert.equal(summary.systemHealth, "attention");
});

test("machine hero summary picks the strongest actionable gap", () => {
  const summary = buildMachineHeroSummary({
    systemHealth: { criticalCount: 1, warningCount: 0 },
    optimizationScore: {
      planning: { score: 82, missingSignals: [] },
      execution: { score: 61, missingSignals: ["tmux"] },
      assistant: { score: 73, missingSignals: [] }
    },
    guidance: [
      {
        priority: "critical",
        message: "Install missing CLI telemetry.",
        fixCommand: "kiwi-control usage --refresh"
      }
    ]
  });

  assert.equal(summary.overallStatus, "needs work");
  assert.equal(summary.strongestGapLabel, "Strongest gap");
  assert.equal(summary.nextFixCommand, "kiwi-control usage --refresh");
});
