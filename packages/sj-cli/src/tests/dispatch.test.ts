import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildDispatchManifest, collectDispatchOutputs, loadLatestDispatchManifest, writeDispatchCollection, writeDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";
import { loadActiveRoleHints, updateActiveRoleHints } from "@shrey-junior/sj-core/core/state.js";

test("dispatch manifest writes role assignments and collect tracks completed outputs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-dispatch-"));
  const repoRoot = path.join(tempDir, "repo");
  await fs.mkdir(path.join(repoRoot, ".agent", "tasks", "fanout-1"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "fanout-1", "planner.md"), "planner packet", "utf8");
  await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "fanout-1", "implementer.md"), "implementer packet", "utf8");
  await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "fanout-1", "reviewer.md"), "reviewer packet", "utf8");
  await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "fanout-1", "tester.md"), "tester packet", "utf8");
  await updateActiveRoleHints(repoRoot, {
    activeRole: "architecture-specialist",
    supportingRoles: ["review-specialist", "qa-specialist"],
    authoritySource: "repo-local",
    projectType: "node"
  });

  const manifest = buildDispatchManifest({
    targetRoot: repoRoot,
    goal: "stabilize billing flow",
    createdAt: "2026-04-02T15:00:00.000Z",
    profileName: "strict-production",
    executionMode: "guarded",
    decision: {
      profileName: "strict-production",
      primaryTool: "codex",
      reviewTool: "claude",
      taskType: "implementation",
      riskLevel: "high",
      fileArea: "application",
      changeSize: "large",
      executionMode: "guarded",
      requiredRoles: ["planner", "reviewer", "tester"],
      reasons: []
    },
    context: {
      targetRoot: repoRoot,
      profileName: "strict-production",
      executionMode: "guarded",
      taskType: "implementation",
      fileArea: "application",
      changeSize: "large",
      riskLevel: "high",
      authorityOrder: [path.join(repoRoot, "AGENTS.md")],
      promotedAuthorityDocs: [path.join(repoRoot, "docs", "agent-shared.md")],
      sources: [],
      repoContextSummary: "- AGENTS.md: canonical guidance",
      validationSteps: ["npm test"],
      stableContracts: [],
      keyBoundaryFiles: [],
      releaseCriticalSurfaces: [],
      riskyAreas: [],
      allowedScope: ["repo-local files"],
      forbiddenScope: ["global config"],
      completionCriteria: ["tests pass"],
      outputFormat: ["summary"],
      escalationConditions: ["review required"],
      conflicts: [],
      eligibleMcpServers: [],
      eligibleMcpCapabilities: []
    },
    continuity: {
      latestPhase: null,
      latestHandoff: null,
      latestCheckpoint: null,
      currentFocus: null
    },
    packetRelativePaths: {
      planner: ".agent/tasks/fanout-1/planner.md",
      implementer: ".agent/tasks/fanout-1/implementer.md",
      reviewer: ".agent/tasks/fanout-1/reviewer.md",
      tester: ".agent/tasks/fanout-1/tester.md"
    },
    roleTools: {
      planner: "claude",
      implementer: "codex",
      reviewer: "claude",
      tester: "claude"
    }
  });

  await writeDispatchManifest(repoRoot, manifest);
  await fs.mkdir(path.join(repoRoot, ".agent", "state", "dispatch", "._dispatch-sidecar"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, ".agent", "state", "dispatch", "._dispatch-sidecar", "manifest.json"), "{}", "utf8");
  const loaded = await loadLatestDispatchManifest(repoRoot);
  assert.equal(loaded?.dispatchId, manifest.dispatchId);
  assert.equal(loaded?.artifactType, "shrey-junior/dispatch-manifest");
  assert.equal(loaded?.roleAssignments.length, 4);
  assert.equal(loaded?.readFirst.includes(".agent/state/active-role-hints.json"), true);
  const activeRoleHints = await loadActiveRoleHints(repoRoot);
  assert.equal(activeRoleHints?.latestDispatchManifest, ".agent/state/dispatch/latest-manifest.json");

  const plannerResultPath = path.join(repoRoot, loaded!.roleAssignments.find((item) => item.role === "planner")!.expectedMarkdownPath);
  const reviewerResultPath = path.join(repoRoot, loaded!.roleAssignments.find((item) => item.role === "reviewer")!.expectedJsonPath);
  await fs.mkdir(path.dirname(plannerResultPath), { recursive: true });
  await fs.writeFile(plannerResultPath, "# Planner\nagreement: keep stable contracts\nvalidation: manual review\n", "utf8");
  await fs.writeFile(
    reviewerResultPath,
    JSON.stringify({ status: "blocked", summary: "Reviewer found a cross-cutting risk", conflicts: ["reviewer disagrees with the current sequencing"] }, null, 2),
    "utf8"
  );

  const collection = await collectDispatchOutputs(repoRoot, loaded!);
  assert.equal(collection.overallStatus, "blocked");
  assert.equal(collection.artifactType, "shrey-junior/dispatch-collect");
  assert.equal(collection.completedRoles.includes("planner"), true);
  assert.equal(collection.roleResults.find((item) => item.role === "reviewer")?.status, "blocked");

  await writeDispatchCollection(repoRoot, loaded!, collection);
});
