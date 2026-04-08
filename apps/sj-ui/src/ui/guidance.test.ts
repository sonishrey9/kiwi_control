/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBlockedActionGuidance,
  deriveExecutionPlanFailureGuidance,
  deriveRepoRecoveryGuidance
} from "./guidance.js";

test("repo recovery guidance prefers a degraded cached snapshot message when fresh load fails", () => {
  const guidance = deriveRepoRecoveryGuidance(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "warm-snapshot" },
      repoState: { mode: "healthy", detail: "ok" },
      validation: { errors: 0 },
      executionState: { lifecycle: "idle", reason: null, nextCommand: null },
      readiness: { label: "Queued", detail: "Cached repo state is loaded.", nextCommand: null }
    },
    { lastRepoLoadFailure: "bridge timed out" }
  );

  assert.equal(guidance?.tone, "degraded");
  assert.match(guidance?.detail ?? "", /bridge timed out/);
  assert.equal(guidance?.actionLabel, "Reload state");
});

test("repo recovery guidance uses fix command for blocked execution plans", () => {
  const guidance = deriveRepoRecoveryGuidance(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh" },
      repoState: { mode: "healthy", detail: "ok" },
      validation: { errors: 0 },
      executionState: { lifecycle: "blocked", reason: "Prepared scope drifted.", nextCommand: "kc explain" },
      readiness: { label: "Workflow blocked", detail: "Prepared scope drifted.", nextCommand: "kc explain" },
      kiwiControl: {
        executionPlan: {
          blocked: true,
          lastError: {
            reason: "Prepared scope drifted.",
            fixCommand: "kc explain",
            retryCommand: "kc validate"
          },
          nextCommands: ["kc next"]
        }
      }
    },
    { lastRepoLoadFailure: null }
  );

  assert.equal(guidance?.tone, "blocked");
  assert.equal(guidance?.nextCommand, "kc explain");
});

test("repo recovery guidance prefers runtime recovery over compatibility plan errors", () => {
  const guidance = deriveRepoRecoveryGuidance(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh" },
      repoState: { mode: "healthy", detail: "ok" },
      validation: { errors: 0 },
      executionState: { lifecycle: "blocked", reason: "Runtime blocked the workflow.", nextCommand: "kc validate" },
      readiness: { label: "Workflow blocked", detail: "Runtime blocked the workflow.", nextCommand: "kc validate" },
      runtimeDecision: {
        currentStepId: "validate",
        currentStepLabel: "Validate outcome",
        currentStepStatus: "failed",
        nextCommand: "kc validate",
        readinessLabel: "Workflow blocked",
        readinessTone: "blocked",
        readinessDetail: "Runtime blocked the workflow.",
        nextAction: {
          action: "Re-run validation",
          command: "kc validate",
          reason: "Runtime blocked the workflow.",
          priority: "critical"
        },
        recovery: {
          kind: "blocked",
          reason: "Runtime blocked the workflow.",
          fixCommand: "kc validate",
          retryCommand: "kc run"
        },
        decisionSource: "runtime-transition"
      },
      kiwiControl: {
        executionPlan: {
          blocked: true,
          lastError: {
            reason: "Compatibility plan is stale.",
            fixCommand: "kc explain",
            retryCommand: "kc retry"
          },
          nextCommands: ["kc next"]
        }
      }
    },
    { lastRepoLoadFailure: null }
  );

  assert.equal(guidance?.tone, "blocked");
  assert.equal(guidance?.nextCommand, "kc validate");
  assert.match(guidance?.detail ?? "", /Runtime blocked the workflow/);
  assert.doesNotMatch(guidance?.detail ?? "", /Compatibility plan is stale/);
});

test("execution plan failure guidance preserves fix and retry commands", () => {
  const guidance = deriveExecutionPlanFailureGuidance({
    reason: "Validation failed.",
    fixCommand: "kc explain",
    retryCommand: "kc validate"
  });

  assert.equal(guidance?.nextCommand, "kc explain");
  assert.equal(guidance?.followUpCommand, "kc validate");
});

test("blocked action guidance labels checkpoint and handoff specifically", () => {
  assert.equal(
    buildBlockedActionGuidance("checkpoint", "Need a saved repo state first.", "kc status").title,
    "Checkpoint unavailable"
  );
  assert.equal(
    buildBlockedActionGuidance("handoff", "Need a specialist target.", "kc specialists").title,
    "Handoff unavailable"
  );
});
