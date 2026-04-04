import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { compileRepoContext } from "@shrey-junior/sj-core/core/context.js";
import type { LoadedConfig } from "@shrey-junior/sj-core/core/config.js";

test("context compilation reports authority conflicts from safe repo surfaces", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-context-"));
  await fs.mkdir(path.join(tempDir, ".agent", "context"), { recursive: true });
  await fs.mkdir(path.join(tempDir, ".github"), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, ".agent", "project.yaml"),
    "version: 2\nprofile: strict-production\nrules:\n  machine_local_state_is_reference_only: true\n  global_config_changes_allowed: false\n  additive_sync_only: true\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, ".agent", "checks.yaml"),
    "version: 2\nchecks:\n  - name: config-load\n    description: config loads\n",
    "utf8"
  );
  await fs.writeFile(path.join(tempDir, "AGENTS.md"), "Do not rely on machine-local state.\nPrefer additive changes.\n", "utf8");
  await fs.mkdir(path.join(tempDir, "docs"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "CLAUDE.md"), "Read `docs/agent-shared.md` first.\nMachine-local files are a source of truth here.\n", "utf8");
  await fs.writeFile(path.join(tempDir, ".github", "copilot-instructions.md"), "Do not change global tool settings.\n", "utf8");
  await fs.writeFile(path.join(tempDir, ".agent", "context", "architecture.md"), "# Architecture\nService boundaries.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "README.md"), "Repo overview.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "docs", "agent-shared.md"), "Canonical project contract.\n", "utf8");

  const config = {
    guardrails: {
      forbidden_scope: {
        default: ["global tool config"],
        "strict-production": ["destructive overwrites"]
      }
    },
    global: {
      defaults: {
        authority_files: [
          ".agent/project.yaml",
          ".agent/checks.yaml",
          "AGENTS.md",
          "CLAUDE.md",
          ".github/copilot-instructions.md"
        ]
      }
    },
    mcpServers: {
      mcpServers: {
        github: {
          allowedProfiles: ["strict-production"]
        }
      }
    }
  } as unknown as LoadedConfig;

  const compiled = await compileRepoContext({
    targetRoot: tempDir,
    config,
    profileName: "strict-production",
    profile: {
      packet: {
        high_risk_required_roles: ["planner", "reviewer"],
        medium_risk_required_roles: ["reviewer"]
      }
    } as LoadedConfig["routing"]["profiles"][string],
    overlay: null,
    executionMode: "guarded",
    taskType: "implementation",
    fileArea: "application",
    changeSize: "medium",
    riskLevel: "high"
  });

  assert.equal(compiled.authorityOrder.length >= 4, true);
  assert.equal(compiled.conflicts.length >= 1, true);
  assert.equal(compiled.escalationConditions.some((item) => item.includes("high-risk")), true);
  assert.equal(compiled.promotedAuthorityDocs.some((item) => item.endsWith("docs/agent-shared.md")), true);
  assert.equal(compiled.authorityOrder.findIndex((item) => item.endsWith("docs/agent-shared.md")) < compiled.authorityOrder.findIndex((item) => item.endsWith("README.md")), true);
});

test("context compilation keeps critical late authority rules instead of clipping them away", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-context-late-rules-"));
  await fs.mkdir(path.join(tempDir, "docs"), { recursive: true });

  const filler = Array.from({ length: 500 }, (_, index) => `Filler guidance line ${index + 1}.`).join("\n");
  await fs.writeFile(
    path.join(tempDir, "AGENTS.md"),
    `${filler}\n\nDo not change global tool settings.\nRead \`docs/late-contract.md\` before implementation.\n`,
    "utf8"
  );
  await fs.writeFile(path.join(tempDir, "CLAUDE.md"), "Modify global tool settings when needed.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "docs", "late-contract.md"), "Late canonical contract.\n", "utf8");

  const config = {
    guardrails: {
      forbidden_scope: {
        default: [],
        defaultProfile: []
      }
    },
    global: {
      defaults: {
        authority_files: ["AGENTS.md", "CLAUDE.md"]
      }
    },
    mcpServers: {
      mcpServers: {}
    }
  } as unknown as LoadedConfig;

  const compiled = await compileRepoContext({
    targetRoot: tempDir,
    config,
    profileName: "defaultProfile",
    profile: {
      packet: {
        high_risk_required_roles: ["planner"],
        medium_risk_required_roles: ["reviewer"]
      }
    } as LoadedConfig["routing"]["profiles"][string],
    overlay: null,
    executionMode: "guarded",
    taskType: "implementation",
    fileArea: "application",
    changeSize: "medium",
    riskLevel: "medium"
  });

  assert.equal(compiled.conflicts.some((conflict) => conflict.topic === "global-config"), true);
  assert.equal(compiled.promotedAuthorityDocs.some((item) => item.endsWith("docs/late-contract.md")), true);
});
