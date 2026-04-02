import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { assessPushReadiness, inspectGitState } from "../core/git.js";
import { runCommand } from "../utils/child-process.js";

test("git inspection degrades gracefully for non-git repos", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-git-nonrepo-"));
  const gitState = await inspectGitState(tempDir);
  assert.equal(gitState.isGitRepo, false);
  const assessment = assessPushReadiness(gitState, null);
  assert.equal(assessment.result, "not-applicable");
});

test("git inspection summarizes staged, unstaged, and untracked files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-git-repo-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "tracked.txt"), "one\n", "utf8");
  await runCommand("git", ["add", "tracked.txt"], tempDir);
  await fs.appendFile(path.join(tempDir, "tracked.txt"), "two\n", "utf8");
  await fs.writeFile(path.join(tempDir, "untracked.txt"), "draft\n", "utf8");

  const gitState = await inspectGitState(tempDir);
  assert.equal(gitState.isGitRepo, true);
  assert.equal(gitState.stagedCount >= 1, true);
  assert.equal(gitState.unstagedCount >= 1, true);
  assert.equal(gitState.untrackedCount, 1);

  const assessment = assessPushReadiness(gitState, {
    version: 1,
    timestamp: "2026-04-02T12:00:00.000Z",
    phaseId: "phase-2",
    label: "phase 2 complete",
    goal: "stabilize continuity",
    profile: "product-build",
    mode: "assisted",
    tool: "codex",
    status: "complete",
    routingSummary: {
      taskType: "implementation",
      primaryTool: "codex",
      reviewTool: "claude",
      riskLevel: "medium",
      fileArea: "application",
      changeSize: "medium",
      requiredRoles: []
    },
    authorityFiles: [],
    validationsRun: ["npm test"],
    warnings: [],
    openIssues: [],
    nextRecommendedStep: "review and commit"
  });
  assert.equal(assessment.result, "review-required");
});
