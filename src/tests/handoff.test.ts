import test from "node:test";
import assert from "node:assert/strict";
import { buildHandoffRecord, renderHandoffBrief, renderHandoffMarkdown } from "../core/handoff.js";
import type { CompiledContext } from "../core/context.js";
import type { GitState } from "../core/git.js";
import type { PhaseRecord } from "../core/state.js";

test("handoff rendering preserves the previous phase summary and remaining risks", () => {
  const phase: PhaseRecord = {
    artifactType: "shrey-junior/current-phase",
    version: 1,
    timestamp: "2026-04-02T12:00:00.000Z",
    phaseId: "phase-1",
    label: "worker normalization done",
    goal: "stabilize worker normalization",
    profile: "strict-production",
    mode: "guarded",
    tool: "codex",
    status: "complete",
    routingSummary: {
      taskType: "implementation",
      primaryTool: "codex",
      reviewTool: "claude",
      riskLevel: "high",
      fileArea: "application",
      changeSize: "large",
      requiredRoles: ["planner", "reviewer"]
    },
    authorityFiles: ["/tmp/repo/AGENTS.md"],
    validationsRun: ["npm test"],
    warnings: ["follow-up docs review needed"],
    openIssues: ["review packet not signed off"],
    nextRecommendedStep: "handoff to claude for guarded review"
  };
  const context: CompiledContext = {
    targetRoot: "/tmp/repo",
    profileName: "strict-production",
    executionMode: "guarded",
    taskType: "implementation",
    fileArea: "application",
    changeSize: "large",
    riskLevel: "high",
    authorityOrder: ["/tmp/repo/AGENTS.md", "/tmp/repo/CLAUDE.md"],
    promotedAuthorityDocs: ["/tmp/repo/docs/agent-shared.md"],
    sources: [],
    repoContextSummary: "- AGENTS.md: canonical rules",
    validationSteps: ["npm test", "manual review"],
    stableContracts: [],
    keyBoundaryFiles: [],
    releaseCriticalSurfaces: [],
    riskyAreas: [],
    allowedScope: ["requested files only"],
    forbiddenScope: ["global config"],
    completionCriteria: ["tests pass"],
    outputFormat: ["summary"],
    escalationConditions: ["high-risk review required"],
    conflicts: [],
    eligibleMcpServers: [],
    eligibleMcpCapabilities: []
  };
  const gitState: GitState = {
    isGitRepo: true,
    branch: "main",
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    unstagedCount: 1,
    untrackedCount: 0,
    changedFiles: ["src/core/router.ts"],
    clean: false
  };

  const handoff = buildHandoffRecord({
    toTool: "claude",
    currentPhase: phase,
    context,
    gitState
  });

  assert.equal(handoff.status, "blocked");
  assert.equal(handoff.readFirst.includes(".agent/state/active-role-hints.json"), true);
  assert.equal(handoff.validationsPending.includes("manual review"), true);
  const markdown = renderHandoffMarkdown(handoff);
  const brief = renderHandoffBrief(handoff);
  assert.match(markdown, /Handoff To Claude/);
  assert.match(markdown, /worker normalization done/);
  assert.match(markdown, /follow-up docs review needed/);
  assert.match(brief, /Read This First For Claude/);
  assert.match(brief, /handoff to claude for guarded review/);
});
