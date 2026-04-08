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
      repoState: { mode: "healthy", title: "Healthy", detail: "ok" },
      executionState: { revision: 2, lifecycle: "queued", reason: "Run packets were written.", nextCommand: "kc validate" },
      readiness: { label: "Queued", tone: "ready", detail: "Run packets were written.", nextCommand: "kc validate" }
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
      repoState: { mode: "initialized-with-warnings", title: "Warnings", detail: "warn" },
      executionState: { revision: 3, lifecycle: "idle", reason: null, nextCommand: null },
      readiness: { label: "Ready with warnings", tone: "ready", detail: "Fresh repo-local state is ready for repo. The repo is usable, but Kiwi still sees warning-level issues worth addressing.", nextCommand: null }
    },
    baseEnv()
  );

  assert.equal(summary.label, "Ready with warnings");
  assert.match(summary.detail, /warning-level issues/);
});

test("buildActiveTargetHint distinguishes initialized-invalid repos", () => {
  assert.equal(
    buildActiveTargetHint({
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh", detail: "Fresh state." },
      repoState: { mode: "initialized-invalid", title: "Invalid", detail: "invalid" },
      executionState: { revision: 0, lifecycle: "blocked", reason: "Repo contract drifted.", nextCommand: "kc doctor" },
      readiness: { label: "Repo contract blocked", tone: "blocked", detail: "Repo contract drifted.", nextCommand: "kc doctor" }
    }),
    "This repo needs repair before continuity is fully trustworthy."
  );
});

test("buildBridgeNote includes recovery command and target hint when guidance is present", () => {
  const note = buildBridgeNote(
    {
      targetRoot: "/tmp/repo",
      loadState: { source: "fresh", detail: "Fresh state." },
      repoState: { mode: "healthy", title: "Healthy", detail: "ok" },
      executionState: { revision: 4, lifecycle: "blocked", reason: "Prepared scope drifted.", nextCommand: "kc explain" },
      readiness: { label: "Workflow blocked", tone: "blocked", detail: "Prepared scope drifted.", nextCommand: "kc explain" }
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
