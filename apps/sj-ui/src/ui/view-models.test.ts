/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDecisionSummary,
  buildMachineHeroSummary,
  buildOverviewHeroState,
  buildPackPanelState,
  buildPrimaryBannerState,
  buildTopMetadataGroups,
  isInspectorDefaultOpen
} from "./view-models.js";

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

test("primary banner stays lightweight on blocked overview states", () => {
  const banner = buildPrimaryBannerState({
    activeView: "overview",
    loadStatus: {
      visible: true,
      phase: "ready",
      label: "Workflow blocked",
      detail: "Prepared scope violated by touched files: a, b, c",
      progress: 96,
      tone: "blocked",
      nextCommand: "kc prepare"
    }
  });
  const hero = buildOverviewHeroState({
    state: {
      repoTitle: "Workflow blocked",
      repoDetail: "Prepared scope violated",
      nextActionSummary: "Prepared scope violated",
      primaryAction: {
        action: "Fix the blocking execution issue",
        reason: "Prepared scope violated by touched files: a, b, c",
        priority: "critical"
      }
    } as never,
    currentFocus: "Current focus",
    primaryActionCommand: "kc prepare"
  });

  assert.equal(banner.detail, "Use the primary recovery action below.");
  assert.notEqual(banner.detail, hero.detail);
});

test("top metadata groups stay compact and fold execution mode into the status chip", () => {
  const groups = buildTopMetadataGroups({
    state: {
      projectType: "node",
      executionMode: "assisted",
      validationState: "1 warning",
      decision: {
        nextAction: "Guide",
        blockingIssue: "none",
        systemHealth: "attention",
        executionSafety: "guarded",
        lastChangedAt: "2026-04-10T10:00:00.000Z",
        recentFailures: 1,
        newWarnings: 2
      }
    } as never
  });

  assert.equal(groups.centerItems.length, 4);
  assert.equal(groups.centerItems[1]?.value, "node");
  assert.equal(groups.statusDetail, "assisted · 1 warning");
});

test("inspector defaults closed in execution mode and open in inspection mode", () => {
  assert.equal(isInspectorDefaultOpen("overview", "execution"), false);
  assert.equal(isInspectorDefaultOpen("mcps", "execution"), false);
  assert.equal(isInspectorDefaultOpen("overview", "inspection"), true);
});

test("pack panel groups selected, executable alternatives, and blocked packs cleanly", () => {
  const panel = buildPackPanelState({
    selectedPack: {
      id: "research-pack",
      name: "Research Pack",
      description: "Research",
      guidance: ["research"],
      realismNotes: [],
      suggestedProjectTypes: [],
      executable: true,
      unavailablePackReason: null,
      allowedCapabilityIds: ["exa"],
      preferredCapabilityIds: ["exa"],
      unavailableCapabilityIds: []
    },
    selectedPackSource: "heuristic-default",
    explicitSelection: null,
    available: [
      {
        id: "research-pack",
        name: "Research Pack",
        description: "Research",
        guidance: ["research"],
        realismNotes: [],
        suggestedProjectTypes: [],
        executable: true,
        unavailablePackReason: null,
        allowedCapabilityIds: ["exa"],
        preferredCapabilityIds: ["exa"],
        unavailableCapabilityIds: []
      },
      {
        id: "web-qa-pack",
        name: "Web QA Pack",
        description: "QA",
        guidance: ["qa"],
        realismNotes: [],
        suggestedProjectTypes: [],
        executable: true,
        unavailablePackReason: null,
        allowedCapabilityIds: ["playwright"],
        preferredCapabilityIds: ["playwright"],
        unavailableCapabilityIds: []
      },
      {
        id: "aws-pack",
        name: "AWS Pack",
        description: "AWS",
        guidance: ["aws"],
        realismNotes: [],
        suggestedProjectTypes: [],
        executable: false,
        unavailablePackReason: "blocked",
        allowedCapabilityIds: ["aws-docs"],
        preferredCapabilityIds: ["aws-docs"],
        unavailableCapabilityIds: ["aws-docs"]
      }
    ]
  } as never);

  assert.equal(panel.selectedPackLabel, "Default for this repo");
  assert.equal(panel.selectedPackCard.sourceLabel, "Heuristic default");
  assert.equal(panel.executablePackCards.length, 1);
  assert.equal(panel.executablePackCards[0]?.id, "web-qa-pack");
  assert.equal(panel.blockedPackCards.length, 1);
  assert.equal(panel.blockedPackCards[0]?.id, "aws-pack");
  assert.equal(panel.showClearAction, false);
});
