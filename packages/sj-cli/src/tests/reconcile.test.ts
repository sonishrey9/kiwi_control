import test from "node:test";
import assert from "node:assert/strict";
import { buildReconcileReport } from "@shrey-junior/sj-core/core/reconcile.js";

test("reconcile report blocks on explicit conflicts and missing required role outputs", () => {
  const manifest = {
    dispatchId: "dispatch-1",
    roleAssignments: [
      { role: "planner", required: true },
      { role: "implementer", required: true },
      { role: "reviewer", required: true },
      { role: "tester", required: false }
    ],
    authorityFiles: ["/tmp/repo/AGENTS.md"],
    promotedDocs: ["/tmp/repo/docs/agent-shared.md"]
  } as const;

  const collection = {
    parsingBasis: "structured",
    completedRoles: ["planner", "implementer"],
    missingRoles: ["reviewer", "tester"],
    fallbackRoles: [],
    malformedRoles: [],
    partialRoles: [],
    roleResults: [
      {
        role: "planner",
        status: "complete",
        summary: "planner done",
        validations: ["manual review"],
        risks: [],
        agreements: ["planner and implementer agree on stable contracts"],
        conflicts: [],
        touchedFiles: [],
        nextSteps: [],
        sourcePaths: [],
        sourceKind: "structured-json",
        missingFields: [],
        parsingWarnings: []
      },
      {
        role: "implementer",
        status: "complete",
        summary: "implementer done",
        validations: [],
        risks: ["needs reviewer confirmation"],
        agreements: [],
        conflicts: ["implementer and reviewer sequencing conflict"],
        touchedFiles: [],
        nextSteps: [],
        sourcePaths: [],
        sourceKind: "structured-frontmatter",
        missingFields: [],
        parsingWarnings: []
      }
    ]
  } as const;

  const report = buildReconcileReport(
    manifest as never,
    collection as never,
    {
      promotedAuthorityDocs: ["/tmp/repo/docs/agent-shared.md"],
      authorityOrder: ["/tmp/repo/AGENTS.md"],
      targetRoot: "/tmp/repo"
    } as never
  );

  assert.equal(report.artifactType, "shrey-junior/reconcile-report");
  assert.equal(report.status, "blocked");
  assert.equal(report.analysisBasis, "mostly-structured");
  assert.equal(report.conflicts.length > 0, true);
  assert.equal(report.roleStatusGaps.some((item) => item.includes("required role output missing: reviewer")), true);
  assert.equal(report.readFirst[0], ".agent/state/active-role-hints.json");
  assert.equal(report.readFirst[1], ".agent/state/current-phase.json");
  assert.equal(report.readFirst[2], ".agent/state/checkpoints/latest.json");
});
