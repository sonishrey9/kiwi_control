import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildMachineAdvisory, buildMachineDoctorFindings } from "@shrey-junior/sj-core/integrations/machine-advisory.js";
import { runToolchain } from "../commands/toolchain.js";
import { runUsage } from "../commands/usage.js";
import { runDoctor } from "../commands/doctor.js";

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
    'command = "lean-ctx"',
    '[mcp_servers."context-mode"]',
    'command = "context-mode"'
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
  assert.equal(advisory.inventory.some((tool) => tool.name === "ai-dashboard"), false);
  assert.equal(advisory.mcpInventory.claudeTotal, 3);
  assert.equal(advisory.mcpInventory.codexTotal, 3);
  assert.equal(advisory.mcpInventory.copilotTotal, 2);
  assert.equal(advisory.mcpInventory.tokenServers.find((server) => server.name === "context-mode")?.codex, true);
  assert.equal(advisory.optimizationLayers.find((layer) => layer.name === "lean-ctx")?.codex, true);
  assert.equal(advisory.optimizationLayers.find((layer) => layer.name === "context-mode")?.codex, false);
  assert.equal(advisory.optimizationLayers.find((layer) => layer.name === "token-efficient rules")?.claude, true);
  assert.equal(advisory.version, 2);
  assert.equal(advisory.generatedBy, "kiwi-control machine-advisory");
  assert.equal(advisory.windowDays, 7);
  assert.equal(advisory.setupPhases.length, 3);
  assert.equal(advisory.setupPhases[0]?.phase, "Phase 1 — Core");
  assert.equal(advisory.setupPhases.some((phase) => phase.items.some((item) => item.name === "oh-my-codex (OMX)" && item.active)), true);
  assert.equal(advisory.setupPhases.some((phase) => phase.items.some((item) => item.name === "context-mode" && item.active)), true);
  assert.equal(advisory.skillsCount, 1);
  assert.deepEqual(advisory.copilotPlugins, ["project-planning", "frontend-web-dev"]);
  assert.equal(typeof advisory.systemHealth.criticalCount, "number");
  assert.equal(typeof advisory.systemHealth.warningCount, "number");
  assert.equal(typeof advisory.systemHealth.okCount, "number");
  assert.equal(advisory.guidance.every((entry) => typeof entry.priority === "string" && typeof entry.group === "string" && typeof entry.impact === "string"), true);
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

test("machine advisory command surfaces expose near-dashboard sections and richer json fields", async () => {
  const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sj-machine-cli-home-"));
  const previousMachineHome = process.env.KIWI_MACHINE_HOME;
  const previousCi = process.env.CODEX_CI;
  process.env.KIWI_MACHINE_HOME = homeRoot;
  process.env.CODEX_CI = "1";

  await fs.mkdir(path.join(homeRoot, ".claude"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".codex", "hooks"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".copilot"), { recursive: true });
  await fs.mkdir(path.join(homeRoot, ".agents", "skills", "docs-playbook"), { recursive: true });
  await fs.writeFile(path.join(homeRoot, ".claude.json"), JSON.stringify({ mcpServers: { "code-review-graph": {}, "ccusage": {}, "context-mode": {} } }, null, 2));
  await fs.writeFile(path.join(homeRoot, ".claude", "CLAUDE.md"), "Token-Efficient Output Rules\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".codex", "config.toml"), [
    '[mcp_servers."code-review-graph"]',
    'command = "code-review-graph"',
    '[mcp_servers."lean-ctx"]',
    'command = "lean-ctx"',
    '[mcp_servers."context-mode"]',
    'command = "context-mode"'
  ].join("\n"), "utf8");
  await fs.writeFile(path.join(homeRoot, ".codex", "AGENTS.md"), "Token-Efficient Output Rules\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".codex", "hooks", "lean-ctx-rewrite-codex.sh"), "#!/bin/sh\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".copilot", "mcp-config.json"), JSON.stringify({ mcpServers: { "code-review-graph": {}, "lean-ctx": {} } }, null, 2));
  await fs.writeFile(path.join(homeRoot, ".copilot", "config.json"), JSON.stringify({ installed_plugins: [{ name: "project-planning" }] }, null, 2));
  await fs.writeFile(path.join(homeRoot, ".agents", "skills", "docs-playbook", "SKILL.md"), "# Docs\n", "utf8");
  await fs.writeFile(path.join(homeRoot, ".zshrc"), "alias lean-ctx='lean-ctx'\n", "utf8");

  try {
    const toolchainLines: string[] = [];
    const toolchainExit = await runToolchain({
      repoRoot: process.cwd(),
      targetRoot: process.cwd(),
      logger: {
        info(message: string) {
          toolchainLines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    assert.equal(toolchainExit, 0);
    assert.match(toolchainLines.join("\n"), /TOOLCHAIN INVENTORY/);
    assert.match(toolchainLines.join("\n"), /MCP SERVERS/);
    assert.match(toolchainLines.join("\n"), /WHAT AI-SETUP ADDED/);
    assert.match(toolchainLines.join("\n"), /CONFIG HEALTH/);
    assert.match(toolchainLines.join("\n"), /TOKEN USAGE/);
    assert.match(toolchainLines.join("\n"), /HEALTH SUMMARY/);
    assert.match(toolchainLines.join("\n"), /GUIDANCE/);
    assert.match(toolchainLines.join("\n"), /Optimization score intentionally omitted/);

    const toolchainJsonLines: string[] = [];
    await runToolchain({
      repoRoot: process.cwd(),
      targetRoot: process.cwd(),
      json: true,
      logger: {
        info(message: string) {
          toolchainJsonLines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    const toolchainJson = JSON.parse(toolchainJsonLines.join("\n")) as {
      generatedBy: string;
      windowDays: number;
      setupPhases: Array<{ phase: string }>;
    };
    assert.equal(toolchainJson.generatedBy, "kiwi-control machine-advisory");
    assert.equal(toolchainJson.windowDays, 7);
    assert.equal(Array.isArray(toolchainJson.setupPhases), true);

    const usageLines: string[] = [];
    const usageExit = await runUsage({
      repoRoot: process.cwd(),
      targetRoot: process.cwd(),
      logger: {
        info(message: string) {
          usageLines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    assert.equal(usageExit, 0);
    assert.match(usageLines.join("\n"), /Claude Code \(via ccusage\)/);
    assert.match(usageLines.join("\n"), /Codex \(via session logs\)/);
    assert.match(usageLines.join("\n"), /Copilot CLI/);

    const usageJsonLines: string[] = [];
    await runUsage({
      repoRoot: process.cwd(),
      targetRoot: process.cwd(),
      json: true,
      logger: {
        info(message: string) {
          usageJsonLines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    const usageJson = JSON.parse(usageJsonLines.join("\n")) as { days: number; claude: { available: boolean } };
    assert.equal(usageJson.days, 7);
    assert.equal(typeof usageJson.claude.available, "boolean");

    const doctorLines: string[] = [];
    const doctorExit = await runDoctor({
      repoRoot: process.cwd(),
      targetRoot: process.cwd(),
      machine: true,
      logger: {
        info(message: string) {
          doctorLines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    assert.equal([0, 1].includes(doctorExit), true);
    assert.match(doctorLines.join("\n"), /next command:/);
  } finally {
    if (previousMachineHome === undefined) {
      delete process.env.KIWI_MACHINE_HOME;
    } else {
      process.env.KIWI_MACHINE_HOME = previousMachineHome;
    }
    if (previousCi === undefined) {
      delete process.env.CODEX_CI;
    } else {
      process.env.CODEX_CI = previousCi;
    }
  }
});
