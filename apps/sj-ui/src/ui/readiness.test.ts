/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActiveTargetHint,
  buildBridgeNote,
  buildLoadStatus,
  deriveReadinessSummary
} from "./readiness.js";
import type { ReadinessEnv } from "./readiness.js";

function baseEnv(overrides: Partial<ReadinessEnv> = {}): ReadinessEnv {
  return {
    commandState: { loading: false, activeCommand: null },
    currentLoadSource: "cli",
    currentTargetRoot: "/tmp/repo",
    isLoadingRepoState: false,
    isRefreshingFreshRepoState: false,
    lastRepoLoadFailure: null,
    lastReadyStateSignal: null,
    readyStatePulseMs: 5_000,
    machineHydrationInFlight: false,
    machineHydrationDetail: "Machine view is hydrating.",
    activeTargetHint: "Repo-local state is loaded and ready.",
    recoveryGuidance: null,
    isMachineHeavyViewActive: false,
    machineAdvisoryStale: false,
    ...overrides
  };
}

test("buildLoadStatus reports blocked warm snapshots when fresh refresh fails", () => {
  const status = buildLoadStatus(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "warm-snapshot", detail: "Warm snapshot loaded." },
      repoState: { mode: "healthy", title: "Healthy", detail: "ok" }
    },
    baseEnv({
      isRefreshingFreshRepoState: true,
      lastRepoLoadFailure: "fresh load failed",
      recoveryGuidance: {
        tone: "blocked",
        title: "Repo opened, workflow blocked",
        detail: "Validation gates are blocking execution.",
        nextCommand: "kc validate"
      }
    })
  );

  assert.equal(status.phase, "degraded");
  assert.equal(status.tone, "blocked");
  assert.equal(status.nextCommand, "kc validate");
});

test("deriveReadinessSummary falls back to final ready detail when no banner is visible", () => {
  const summary = deriveReadinessSummary(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh", detail: "Fresh state." },
      repoState: { mode: "initialized-with-warnings", title: "Warnings", detail: "warn" }
    },
    baseEnv()
  );

  assert.equal(summary.label, "ready");
  assert.match(summary.detail, /warning-level issues/);
});

test("buildActiveTargetHint distinguishes initialized-invalid repos", () => {
  assert.equal(
    buildActiveTargetHint({
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh", detail: "Fresh state." },
      repoState: { mode: "initialized-invalid", title: "Invalid", detail: "invalid" }
    }),
    "This repo needs repair before continuity is fully trustworthy."
  );
});

test("buildBridgeNote includes recovery command and target hint when guidance is present", () => {
  const note = buildBridgeNote(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh", detail: "Fresh state." },
      repoState: { mode: "healthy", title: "Healthy", detail: "ok" }
    },
    "cli",
    baseEnv({
      recoveryGuidance: {
        tone: "blocked",
        title: "Repo opened, workflow blocked",
        detail: "Prepared scope drifted.",
        nextCommand: "kc explain"
      }
    })
  );

  assert.match(note, /Prepared scope drifted/);
  assert.match(note, /Do this now: kc explain/);
  assert.match(note, /Repo-local state is loaded and ready/);
});
