import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { listEligibleMcpCapabilities, resolveRoleSpecialists } from "@shrey-junior/sj-core/core/specialists.js";

test("specialist registry exposes the hardened universal specialists", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const config = await loadCanonicalConfig(repoRoot);

  for (const specialistId of ["frontend-specialist", "backend-specialist", "fullstack-specialist", "review-specialist"]) {
    assert.ok(config.specialists.specialists[specialistId], `missing ${specialistId}`);
  }

  const selected = resolveRoleSpecialists({
    config,
    profileName: "product-build",
    taskType: "implementation",
    fileArea: "application",
    roleTools: {
      implementer: "codex",
      reviewer: "claude"
    }
  });

  assert.equal(selected.implementer?.specialistId, "fullstack-specialist");
  assert.equal(selected.reviewer?.specialistId, "review-specialist");
});

test("fullstack and review specialists get useful MCP capability coverage", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const config = await loadCanonicalConfig(repoRoot);

  const fullstack = listEligibleMcpCapabilities({
    config,
    profileName: "product-build",
    specialistId: "fullstack-specialist",
    tool: "codex"
  }).map((item) => item.id);

  const review = listEligibleMcpCapabilities({
    config,
    profileName: "strict-production",
    specialistId: "review-specialist",
    tool: "claude"
  }).map((item) => item.id);

  assert.ok(fullstack.includes("context7"));
  assert.ok(fullstack.includes("docker"));
  assert.ok(review.includes("github"));
  assert.ok(review.includes("sequential-thinking"));
});
