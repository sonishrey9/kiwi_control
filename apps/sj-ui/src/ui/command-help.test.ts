/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBlockedWorkflowEntries,
  buildExplainCommandEntries,
  buildExplainSelectionEntries,
  buildTerminalHelpEntries,
  formatCliCommand
} from "./command-help.js";

test("formatCliCommand normalizes kiwi-control commands and appends target for repo-scoped commands", () => {
  assert.equal(
    formatCliCommand('kiwi-control explain', '/tmp/demo repo'),
    'kc explain --target "/tmp/demo repo"'
  );
  assert.equal(
    formatCliCommand('kc sync --dry-run --diff-summary', "/tmp/demo"),
    'kc sync --dry-run --diff-summary --target /tmp/demo'
  );
});

test("formatCliCommand preserves non-repo commands and existing targets", () => {
  assert.equal(formatCliCommand("kc help", "/tmp/demo"), "kc help");
  assert.equal(
    formatCliCommand('kc status --target "/tmp/demo"', "/tmp/other"),
    'kc status --target /tmp/demo'
  );
  assert.equal(formatCliCommand("echo hello", "/tmp/demo"), "echo hello");
});

test("buildTerminalHelpEntries switches between init and sync guidance by repo mode", () => {
  const uninitialized = buildTerminalHelpEntries({
    targetRoot: "/tmp/repo",
    repoMode: "repo-not-initialized"
  });
  const healthy = buildTerminalHelpEntries({
    targetRoot: "/tmp/repo",
    repoMode: "healthy"
  });

  assert.equal(uninitialized.some((entry) => entry.command === 'kc init --target /tmp/repo'), true);
  assert.equal(healthy.some((entry) => entry.command === 'kc sync --dry-run --diff-summary --target /tmp/repo'), true);
  assert.equal(healthy[0]?.command, "kc help");
});

test("buildExplainSelectionEntries exposes selection reasons and dependency chains", () => {
  const entries = buildExplainSelectionEntries([
    {
      file: "client/web/src/index.tsx",
      reasons: ["keyword match", "repo context"],
      selectionWhy: "Selected because of repo context, task fit.",
      dependencyChain: ["AGENTS.md", "client/web/src/index.tsx"]
    }
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.title, "client/web/src/index.tsx");
  assert.match(entries[0]?.note ?? "", /Selected because of repo context/);
  assert.match(entries[0]?.note ?? "", /chain: AGENTS\.md -> client\/web\/src\/index\.tsx/);
});

test("buildExplainCommandEntries deduplicates repeated commands and keeps target-aware formatting", () => {
  const entries = buildExplainCommandEntries({
    targetRoot: "/tmp/repo",
    recoveryGuidance: {
      tone: "blocked",
      title: "Repo opened, workflow blocked",
      detail: "Validation is blocking execution.",
      nextCommand: "kc explain",
      followUpCommand: null
    },
    executionPlan: {
      lastError: {
        reason: "Prepared scope violated.",
        fixCommand: "kc explain",
        retryCommand: "kc explain"
      },
      nextCommands: ["kiwi-control explain", "kc validate", "kc validate"]
    }
  });

  assert.equal(entries[0]?.command, "kc explain --target /tmp/repo");
  assert.equal(entries.some((entry) => entry.command === "kc validate --target /tmp/repo"), true);
  assert.equal(entries.filter((entry) => entry.command === "kc explain --target /tmp/repo").length, 1);
});

test("buildBlockedWorkflowEntries gives a concrete unblock workflow from the blocked plan", () => {
  const entries = buildBlockedWorkflowEntries({
    targetRoot: "/tmp/repo",
    recoveryGuidance: {
      tone: "blocked",
      title: "Repo opened, workflow blocked",
      detail: "Prepared scope violated by touched files.",
      nextCommand: "kc explain",
      followUpCommand: null
    },
    executionPlan: {
      blocked: true,
      currentStepIndex: 2,
      steps: [
        { id: "prepare", command: 'kc prepare "task"', validation: "Prepare bounded scope first.", status: "success" },
        { id: "execute", command: 'kc run "task"', validation: "Make the selected change.", status: "pending" },
        { id: "validate", command: 'kc validate "task"', validation: "Re-check the selected files after the fix.", status: "failed" }
      ],
      lastError: {
        reason: "Prepared scope violated by touched files.",
        fixCommand: "kc explain",
        retryCommand: 'kc validate "task"'
      },
      nextCommands: ['kc validate "task"', 'kc checkpoint "validated-progress"']
    }
  });

  assert.equal(entries.length >= 3, true);
  assert.equal(entries[0]?.title, "Inspect the blocker");
  assert.equal(entries[0]?.command, "kc explain --target /tmp/repo");
  assert.equal(entries.some((entry) => entry.command.includes("kc validate") && entry.command.includes("--target /tmp/repo")), true);
  assert.equal(entries.some((entry) => entry.command.includes("kc checkpoint") && entry.command.includes("--target /tmp/repo")), true);
});
