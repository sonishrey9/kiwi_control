import test from "node:test";
import assert from "node:assert/strict";
import { renderTaskPacket } from "../core/packets.js";

test("task packets include workflow decision rules and control-plane expectations", () => {
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
  assert.match(packet, /trivial work may stay direct only when it is local, low-risk/);
  assert.match(packet, /require push-check before recommending push/);
  assert.match(packet, /## Control Plane Expectations/);
  assert.match(packet, /treat MCP usage as policy-driven/);
});
