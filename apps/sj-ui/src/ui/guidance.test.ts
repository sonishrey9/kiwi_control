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
      validation: { errors: 0 }
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
