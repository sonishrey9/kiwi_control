import test from "node:test";
import assert from "node:assert/strict";
import { renderTaskPacket } from "../core/packets.js";

test("task packets include first-read guidance, checks, and control-plane expectations", () => {
  const packet = renderTaskPacket({
    title: "Codex Run Packet",
    goal: "stabilize shared routing",
    packetType: "run",
    prompt: "Implement safely.",
    nativeSurface: "AGENTS.md",
    routedTool: "codex",
    decision: {
      profileName: "product-build",
      primaryTool: "codex",
      reviewTool: "claude",
      taskType: "implementation",
      riskLevel: "medium",
      fileArea: "application",
      changeSize: "medium",
      executionMode: "assisted",
      requiredRoles: ["reviewer"],
      reasons: []
    },
    context: {
      targetRoot: "/tmp/repo",
      profileName: "product-build",
      executionMode: "assisted",
      taskType: "implementation",
      fileArea: "application",
      changeSize: "medium",
      riskLevel: "medium",
      authorityOrder: ["/tmp/repo/AGENTS.md"],
      promotedAuthorityDocs: ["/tmp/repo/docs/agent-shared.md"],
      sources: [],
      repoContextSummary: "repo summary",
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
      eligibleMcpServers: ["github"],
      eligibleMcpCapabilities: [
        {
          id: "github",
          purpose: "repo metadata",
          trustLevel: "high",
          readOnly: true,
          approvalRequired: false
        }
      ]
    },
    supportingRole: "primary owner for implementation"
  });

  assert.match(packet, /## Workflow Decision Rules/);
  assert.match(packet, /^---$/m);
  assert.match(packet, /schema: shrey-junior\/task-packet@v1/);
  assert.match(packet, /read_first:/);
  assert.match(packet, /checks_to_run:/);
  assert.match(packet, /stop_conditions:/);
  assert.match(packet, /## Read This First/);
  assert.match(packet, /\.agent\/state\/active-role-hints\.json/);
  assert.match(packet, /## Exact Checks To Run/);
  assert.match(packet, /## Stop Conditions/);
  assert.match(packet, /## External Lookup Rules/);
  assert.match(packet, /\.agent\/state\/latest-task-packets\.json/);
  assert.match(packet, /## Role And Output References/);
  assert.match(packet, /\.agent\/templates\/role-result\.md/);
  assert.match(packet, /trivial work may stay direct only when it is local, low-risk/);
  assert.match(packet, /require push-check before recommending push/);
  assert.match(packet, /treat MCP usage as policy-driven/);
});
