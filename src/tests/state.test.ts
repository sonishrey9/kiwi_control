import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  listTaskPacketDirectories,
  loadActiveRoleHints,
  loadContinuitySnapshot,
  loadLatestTaskPacketSet,
  updateActiveRoleHints,
  writeHandoffArtifacts,
  writeLatestTaskPacketSet,
  writePhaseRecord,
  type HandoffRecord,
  type PhaseRecord
} from "../core/state.js";

test("state ledger stores current phase and latest tool-specific handoff", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-state-"));
  const repoRoot = path.join(tempDir, "repo");
  await fs.mkdir(repoRoot, { recursive: true });

  const phase: PhaseRecord = {
    artifactType: "shrey-junior/current-phase",
    version: 1,
    timestamp: "2026-04-02T12:00:00.000Z",
    phaseId: "20260402-120000-phase-1",
    label: "phase 1 complete",
    goal: "stabilize shared routing",
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
      requiredRoles: ["reviewer"]
    },
    authorityFiles: [path.join(repoRoot, "AGENTS.md")],
    validationsRun: ["npm test"],
    warnings: [],
    openIssues: [],
    nextRecommendedStep: "handoff to claude for review"
  };
  await writePhaseRecord(repoRoot, phase);
  await updateActiveRoleHints(repoRoot, {
    activeRole: "backend-specialist",
    supportingRoles: ["review-specialist", "qa-specialist"],
    authoritySource: "repo-local",
    projectType: "node"
  });

  const claudeHandoff: HandoffRecord = {
    artifactType: "shrey-junior/handoff",
    version: 1,
    createdAt: "2026-04-02T12:30:00.000Z",
    toTool: "claude",
    fromPhaseId: phase.phaseId,
    previousTool: "codex",
    summary: "phase 1 complete",
    goal: phase.goal,
    profile: phase.profile,
    mode: phase.mode,
    readFirst: ["AGENTS.md"],
    writeTargets: ["src/core/router.ts"],
    checksToRun: ["npm test", "bash .agent/scripts/verify-contract.sh"],
    stopConditions: ["stop when repo authority conflicts"],
    searchGuidance: {
      inspectCodebaseFirst: true,
      repoDocsFirst: true,
      useExternalLookupWhen: ["repo docs are insufficient"],
      avoidExternalLookupWhen: ["the repo already answers the question"]
    },
    whatChanged: ["src/core/router.ts"],
    validationsPending: ["manual review"],
    risksRemaining: [],
    nextStep: "review the packet and confirm routing",
    status: "ready"
  };
  await writeHandoffArtifacts(repoRoot, "handoff-to-claude", claudeHandoff, "# Handoff\n", "# Brief\n");

  const copilotHandoff: HandoffRecord = {
    ...claudeHandoff,
    createdAt: "2026-04-02T12:45:00.000Z",
    toTool: "copilot",
    nextStep: "use inline assistance only"
  };
  await writeHandoffArtifacts(repoRoot, "handoff-to-copilot", copilotHandoff, "# Handoff\n", "# Brief\n");
  await fs.writeFile(
    path.join(repoRoot, ".agent", "state", "handoff", "._handoff-to-copilot.json"),
    "not real json",
    "utf8"
  );
  await fs.mkdir(path.join(repoRoot, ".agent", "tasks", "run-1"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "run-1", "codex.md"), "packet", "utf8");
  await fs.writeFile(path.join(repoRoot, ".agent", "tasks", "run-1", "._codex.md"), "sidecar", "utf8");
  await writeLatestTaskPacketSet(repoRoot, [".agent/tasks/run-1/codex.md"]);

  const allSnapshot = await loadContinuitySnapshot(repoRoot);
  assert.equal(allSnapshot.latestPhase?.phaseId, phase.phaseId);
  assert.equal(allSnapshot.latestHandoff?.toTool, "copilot");

  const claudeSnapshot = await loadContinuitySnapshot(repoRoot, "claude");
  assert.equal(claudeSnapshot.latestHandoff?.toTool, "claude");
  assert.equal(claudeSnapshot.latestHandoff?.nextStep, "review the packet and confirm routing");

  const packetDirectories = await listTaskPacketDirectories(repoRoot);
  assert.equal(packetDirectories[0]?.fileCount, 1);
  const latestPacketSet = await loadLatestTaskPacketSet(repoRoot);
  assert.equal(latestPacketSet?.artifactType, "shrey-junior/latest-task-packets");
  assert.equal(latestPacketSet?.files[0], ".agent/tasks/run-1/codex.md");
  const activeRoleHints = await loadActiveRoleHints(repoRoot);
  assert.equal(activeRoleHints?.activeRole, "backend-specialist");
  assert.equal(activeRoleHints?.latestTaskPacket, ".agent/state/latest-task-packets.json");
  assert.equal(activeRoleHints?.latestHandoff, ".agent/state/handoff/latest.json");
  assert.equal(activeRoleHints?.readNext.length !== 0, true);
  assert.equal(activeRoleHints?.checksToRun.length !== 0, true);
});
