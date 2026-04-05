import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildMachineAdvisory, buildMachineDoctorFindings } from "@shrey-junior/sj-core/integrations/machine-advisory.js";

test("machine advisory builds fixture-driven machine state from local configs and logs", async () => {
  const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sj-machine-home-"));
  await fs.mkdir(path.join(homeRoot, ".claude"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".codex", "hooks"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".copilot"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".agents", "skills", "docs-playbook"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".codex", "sessions", "2026", "04", "05"), { recursive: true });

  await fs.writeFile(path.join(homeRoot, ".claude.json"), JSON.stringify({ mcpServers: { "code-review-graph": {}, "ccusage": {}, "context-mode": {} } }, null, 2));
  await fs.writeFile(path.join(homeRoot, ".claude", "CLAUDE.md"), "Token-Efficient Output Rules\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".codex", "config.toml"), [
    '[mcp_servers."code-review-graph"]',
    'command = "code-review-graph"',
    '[mcp_servers."lean-ctx"]',
    'command = "lean-ctx"'
  ].join("\n"), "utf8");
  await fs.writeFile(path.join(homeRoot, ".codex", "AGENTS.md"), "Token-Efficient Output Rules\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".codex", "hooks", "lean-ctx-rewrite-codex.sh"), "#!/bin/sh\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".copilot", "mcp-config.json"), JSON.stringify({ mcpServers: { "code-review-graph": {}, "lean-ctx": {} } }, null, 2));
  await fs.writeFile(path.join(homeRoot, ".copilot", "config.json"), JSON.stringify({ installed_plugins: [{ name: "project-planning" }, { name: "frontend-web-dev" }] }, null, 2));
  await fs.writeFile(path.join(homeRoot, ".agents", "skills", "docs-playbook", "SKILL.md"), "# Docs\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".zshrc"), "alias lean-ctx='lean-ctx'\n", "utf8");
  await fs.writeFile(
    path.join(homeRoot, ".codex", "sessions", "2026", "04", "05", "session.jsonl"),
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 1000,
            output_tokens: 200,
            cached_input_tokens: 800,
            reasoning_output_tokens: 50,
            total_tokens: 1200
          }
        }
      }
    }) + "\n",
    "utf8"
  );

  const advisory = await buildMachineAdvisory({
    homeRoot,
    now: new Date("2026-04-05T12:58:01.000Z"),
    commandRunner: async (command, args) => {
      if (command === "which") {
        return {
          code: 0,
          stdout: `/mock/bin/${args[0]}\n`,
          stderr: ""
        };
      }
      return {
        code: 0,
        stdout: `${command} 1.0.0\n`,
        stderr: ""
      };
    },
    ccusagePayload: {
      daily: [
        {
          date: "2026-04-05",
          inputTokens: 703,
          outputTokens: 23556,
          cacheCreationTokens: 461294,
          cacheReadTokens: 18770492,
          totalTokens: 19256045,
          totalCost: 9.2257,
          modelsUsed: ["claude-opus-4-6"]
        }
      ]
    }
  });

  assert.equal(advisory.inventory.some((tool) => tool.name === "code-review-graph" && tool.installed), true);
  assert.equal(advisory.mcpInventory.claudeTotal, 3);
  assert.equal(advisory.mcpInventory.codexTotal, 2);
  assert.equal(advisory.mcpInventory.copilotTotal, 2);
  assert.equal(advisory.optimizationLayers.find((layer) => layer.name === "lean-ctx")?.codex, true);
  assert.equal(advisory.optimizationLayers.find((layer) => layer.name === "token-efficient rules")?.claude, true);
  assert.equal(advisory.skillsCount, 1);
  assert.deepEqual(advisory.copilotPlugins, ["project-planning", "frontend-web-dev"]);
  assert.equal(advisory.usage.claude.available, true);
  assert.equal(advisory.usage.claude.totals.totalCost, 9.2257);
  assert.equal(advisory.usage.codex.available, true);
  assert.equal(advisory.usage.codex.totals.sessions, 1);
  assert.equal(advisory.usage.codex.totals.totalTokens, 1200);
});

test("machine doctor groups missing config and toolchain findings into repair commands", async () => {
  const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sj-machine-home-empty-"));
  const advisory = await buildMachineAdvisory({
    homeRoot,
    now: new Date("2026-04-05T12:58:01.000Z"),
    commandRunner: async () => ({ code: 1, stdout: "", stderr: "" }),
    ccusagePayload: { daily: [] }
  });

  const findings = buildMachineDoctorFindings(advisory, homeRoot);
  assert.equal(findings.some((finding) => finding.category === "toolchain"), true);
  assert.equal(findings.some((finding) => finding.category === "config"), true);
  assert.equal(findings.some((finding) => finding.fixCommand === "ai-setup"), true);
});
