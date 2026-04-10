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
    stale: false,
    systemHealth: { criticalCount: 1, warningCount: 0 },
    setupSummary: {
      installedTools: { readyCount: 3, totalCount: 4 },
      healthyConfigs: { readyCount: 2, totalCount: 3 },
      readyRuntimes: { planning: true, execution: false, assistant: true }
    },
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

  assert.equal(summary.overallStatus, "partial");
  assert.equal(summary.strongestGapLabel, "Strongest gap");
  assert.equal(summary.nextFixCommand, "kiwi-control usage --refresh");
});

test("machine hero summary surfaces stale state before claiming readiness", () => {
  const summary = buildMachineHeroSummary({
    stale: true,
    systemHealth: { criticalCount: 0, warningCount: 0 },
    setupSummary: {
      installedTools: { readyCount: 4, totalCount: 4 },
      healthyConfigs: { readyCount: 3, totalCount: 3 },
      readyRuntimes: { planning: true, execution: true, assistant: true }
    },
    optimizationScore: {
      planning: { score: 90, missingSignals: [] },
      execution: { score: 88, missingSignals: [] },
      assistant: { score: 86, missingSignals: [] }
    },
    guidance: []
  });

  assert.equal(summary.overallStatus, "stale");
  assert.match(summary.title, /stale/i);
});
