import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildDispatchManifest, collectDispatchOutputs, writeDispatchManifest } from "@shrey-junior/sj-core/core/dispatch.js";

async function makeManifest(repoRoot: string) {
  await fs.mkdir(path.join(repoRoot, ".agent", "tasks", "fanout-1"), { recursive: true });
  for (const role of ["planner", "implementer", "reviewer", "tester"]) {
    await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "fanout-1", `${role}.md`), `${role} packet`, "utf8");
  }

  const manifest = buildDispatchManifest({
    targetRoot: repoRoot,
    goal: "stabilize review flow",
    createdAt: "2026-04-02T16:00:00.000Z",
    profileName: "strict-production",
    executionMode: "guarded",
    decision: {
      profileName: "strict-production",
      primaryTool: "claude",
      reviewTool: "codex",
      taskType: "review",
      riskLevel: "high",
      fileArea: "application",
      changeSize: "medium",
      executionMode: "guarded",
      requiredRoles: ["planner", "reviewer", "tester"],
      reasons: []
    },
    context: {
      targetRoot: repoRoot,
      profileName: "strict-production",
      executionMode: "guarded",
      taskType: "review",
      fileArea: "application",
      changeSize: "medium",
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
      reviewer: "codex",
      tester: "claude"
    }
  });
  await writeDispatchManifest(repoRoot, manifest);
  return manifest;
}

test("collect prefers structured role results and reports fallback and partial fields", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-collect-"));
  const repoRoot = path.join(tempDir, "repo");
  const manifest = await makeManifest(repoRoot);
  const resultsDir = path.join(repoRoot, ".agent", "state", "dispatch", manifest.dispatchId, "results");
  await fs.mkdir(resultsDir, { recursive: true });

  await fs.writeFile(
    path.join(resultsDir, "planner.json"),
    JSON.stringify(
      {
        role: "planner",
        status: "complete",
        summary: "Plan is aligned.",
        agreements: ["keep stable contracts"],
        conflicts: [],
        validations: ["manual review"],
        risks: [],
        touched_files: ["src/core/router.ts"],
        next_steps: ["handoff to implementer"]
      },
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    path.join(resultsDir, "reviewer.md"),
    [
      "---",
      "role: reviewer",
      "status: complete",
      "summary: Reviewer approved the narrow fix.",
      "agreements:",
      "  - packet scope is acceptable",
      "validations:",
      "  - manual review",
      "touched_files:",
      "  - src/commands/status.ts",
      "next_steps:",
      "  - ask tester to confirm",
      "---",
      "",
      "Structured reviewer output"
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(
    path.join(resultsDir, "tester.md"),
    "# Tester\nagreement: smoke test passed\nvalidation: npm test\nrisk: none\nnext_step: checkpoint if reviewer agrees\n",
    "utf8"
  );

  const collection = await collectDispatchOutputs(repoRoot, manifest);
  assert.equal(collection.parsingBasis, "mixed");
  assert.deepEqual(collection.fallbackRoles, ["tester"]);
  assert.equal(collection.partialRoles.some((item) => item.role === "reviewer"), true);
  assert.equal(collection.roleResults.find((item) => item.role === "planner")?.sourceKind, "structured-json");
  assert.equal(collection.roleResults.find((item) => item.role === "reviewer")?.sourceKind, "structured-frontmatter");
  assert.equal(collection.roleResults.find((item) => item.role === "tester")?.sourceKind, "heuristic-markdown");
});

test("collect flags malformed structured outputs when fallback is unavailable", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-collect-invalid-"));
  const repoRoot = path.join(tempDir, "repo");
  const manifest = await makeManifest(repoRoot);
  const resultsDir = path.join(repoRoot, ".agent", "state", "dispatch", manifest.dispatchId, "results");
  await fs.mkdir(resultsDir, { recursive: true });

  await fs.writeFile(path.join(resultsDir, "implementer.json"), "{invalid json", "utf8");

  const collection = await collectDispatchOutputs(repoRoot, manifest);
  assert.deepEqual(collection.malformedRoles, ["implementer"]);
  assert.equal(collection.roleResults.find((item) => item.role === "implementer")?.status, "blocked");
});
