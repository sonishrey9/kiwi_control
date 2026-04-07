import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import { generateInstructions, persistInstructions } from "@shrey-junior/sj-core/core/instruction-generator.js";
import { estimateTokens, persistTokenUsage } from "@shrey-junior/sj-core/core/token-estimator.js";
import { runPrepare } from "../commands/prepare.js";
import { pathExists, readText, readJson } from "@shrey-junior/sj-core/utils/fs.js";

test("instruction generator produces valid markdown document", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-instr-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "app.ts"), "export function main() {}\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);
  await fs.writeFile(path.join(tempDir, "app.ts"), "export function main() { return 1; }\n", "utf8");

  const selection = await contextSelector("update main function", tempDir);
  const instructions = generateInstructions("update main function", selection);

  assert.ok(instructions.raw.includes("# AI Task Instructions"));
  assert.ok(instructions.raw.includes("## GOAL"));
  assert.ok(instructions.raw.includes("update main function"));
  assert.ok(instructions.raw.includes("## ALLOWED FILES"));
  assert.ok(instructions.raw.includes("## FORBIDDEN FILES"));
  assert.ok(instructions.raw.includes("## STEPS"));
  assert.ok(instructions.raw.includes("## CONSTRAINTS"));
  assert.ok(instructions.raw.includes("## VALIDATION"));
  assert.ok(instructions.raw.includes("## STOP CONDITIONS"));
  assert.ok(instructions.constraints.length > 0);
  assert.ok(instructions.validationSteps.length > 0);
  assert.ok(instructions.stopConditions.length > 0);
});

test("instruction generator persists to .agent/context/generated-instructions.md", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-instr-persist-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "lib.ts"), "export const x = 1;\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);

  const selection = await contextSelector("fix x value", tempDir);
  const instructions = generateInstructions("fix x value", selection);
  const outputPath = await persistInstructions(tempDir, instructions);

  assert.ok(await pathExists(outputPath));
  const content = await readText(outputPath);
  assert.ok(content.includes("fix x value"));
  assert.ok(content.includes("CONSTRAINTS"));
});

test("token estimator computes savings percentage", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-token-"));
  await fs.writeFile(path.join(tempDir, "big.ts"), "x".repeat(4000) + "\n", "utf8");
  await fs.writeFile(path.join(tempDir, "small.ts"), "y".repeat(100) + "\n", "utf8");
  await fs.writeFile(path.join(tempDir, "medium.ts"), "z".repeat(2000) + "\n", "utf8");

  const estimate = await estimateTokens(tempDir, ["small.ts"]);

  assert.ok(estimate.selectedTokens > 0);
  assert.ok(estimate.fullRepoTokens > estimate.selectedTokens);
  assert.ok(estimate.savingsPercent > 0);
  assert.ok(estimate.savingsPercent <= 100);
  assert.ok(estimate.fileBreakdown.length >= 3);
  assert.match(estimate.estimationMethod, /rough estimate/i);
  assert.match(estimate.estimateNote, /pricing is intentionally not shown/i);
});

test("token estimator surfaces measured usage from ccusage-compatible Codex session logs when available", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-token-measured-"));
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "sj-codex-home-"));
  const previousCodexHome = process.env.CODEX_HOME;
  await fs.mkdir(path.join(codexHome, "sessions", "2026", "04", "05"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "code.ts"), "export const val = 42;\n", "utf8");
  await fs.writeFile(
    path.join(codexHome, "sessions", "2026", "04", "05", "repo-session.jsonl"),
    [
      JSON.stringify({
        timestamp: "2026-04-05T10:00:00.000Z",
        type: "session_meta",
        payload: { cwd: tempDir }
      }),
      JSON.stringify({
        timestamp: "2026-04-05T10:00:00.100Z",
        type: "turn_context",
        payload: { model: "gpt-5-codex" }
      }),
      JSON.stringify({
        timestamp: "2026-04-05T10:00:01.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 1000,
              cached_input_tokens: 100,
              output_tokens: 250,
              reasoning_output_tokens: 50,
              total_tokens: 1250
            }
          }
        }
      })
    ].join("\n"),
    "utf8"
  );

  process.env.CODEX_HOME = codexHome;
  try {
    const estimate = await estimateTokens(tempDir, ["code.ts"]);
    assert.equal(estimate.measuredUsage.available, true);
    assert.equal(estimate.measuredUsage.source, "ccusage-session");
    assert.equal(estimate.measuredUsage.totalRuns, 1);
    assert.equal(estimate.measuredUsage.totalTokens, 1250);
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
  }
});

test("token estimator persists state to .agent/state/token-usage.json", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-token-persist-"));
  await fs.writeFile(path.join(tempDir, "code.ts"), "export const val = 42;\n", "utf8");

  const estimate = await estimateTokens(tempDir, ["code.ts"]);
  const statePath = await persistTokenUsage(tempDir, "test task", estimate);

  assert.ok(await pathExists(statePath));
  const state = await readJson<{ artifactType: string; savings_percent: number; estimate_note?: string; cost_estimates?: unknown }>(statePath);
  assert.equal(state.artifactType, "kiwi-control/token-usage");
  assert.ok(typeof state.savings_percent === "number");
  assert.match(state.estimate_note ?? "", /pricing is intentionally not shown/i);
  assert.equal("cost_estimates" in state, false);

  const breakdown = await readJson<{ artifactType: string; categories: Array<{ category: string; basis: string }> }>(
    path.join(tempDir, ".agent", "state", "token-breakdown.json")
  );
  assert.equal(breakdown.artifactType, "kiwi-control/token-breakdown");
  assert.equal(breakdown.categories.some((entry) => entry.category === "selection filter" && entry.basis === "measured"), true);
  assert.equal(breakdown.categories.some((entry) => entry.category === "node_modules"), true);
});

test("prepare output clearly labels token counts as rough estimates and omits pricing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-prepare-report-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "README.md"), "# repo\n", "utf8");
  await fs.writeFile(path.join(tempDir, "app.ts"), "export const app = true;\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);
  await fs.writeFile(path.join(tempDir, "README.md"), "# repo\n\nUpdated docs.\n", "utf8");

  const logs: string[] = [];
  const exitCode = await runPrepare({
    repoRoot: tempDir,
    targetRoot: tempDir,
    task: "update README docs",
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  assert.match(logs.join("\n"), /rough estimate/i);
  assert.match(logs.join("\n"), /pricing is intentionally not shown/i);
  assert.match(logs.join("\n"), /How It Works:/i);
  assert.match(logs.join("\n"), /File Analysis:/i);
  assert.match(logs.join("\n"), /Context Trace:/i);
  assert.match(logs.join("\n"), /Indexing:/i);
  assert.match(logs.join("\n"), /Token Breakdown:/i);
  assert.match(logs.join("\n"), /heuristic/i);
  assert.doesNotMatch(logs.join("\n"), /Cost Savings|selected \/ .* full repo \/ .* saved|\$/i);

  const runtimeLifecycle = await readJson<{
    artifactType: string;
    currentStage: string;
    recentEvents: Array<{ type: string }>;
  }>(path.join(tempDir, ".agent", "state", "runtime-lifecycle.json"));
  assert.equal(runtimeLifecycle.artifactType, "kiwi-control/runtime-lifecycle");
  assert.equal(runtimeLifecycle.currentStage, "prepared");
  assert.equal(runtimeLifecycle.recentEvents.some((event) => event.type === "prepare_completed"), true);
});

test("prepare matches repo-local skills and writes workflow state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-prepare-skills-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, ".agent", "skills"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "README.md"), "# Docs\n", "utf8");
  await fs.writeFile(path.join(tempDir, "src.ts"), "export const code = true;\n", "utf8");
  await fs.writeFile(
    path.join(tempDir, ".agent", "skills", "docs-playbook.md"),
    [
      "# Docs Playbook",
      "",
      "## Description",
      "Use for docs and README tasks.",
      "",
      "## Trigger Conditions",
      "- docs",
      "- README",
      "- handbook",
      "",
      "## Execution Template",
      "- Prefer docs files before code files.",
      ""
    ].join("\n"),
    "utf8"
  );
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);
  await fs.writeFile(path.join(tempDir, "README.md"), "# Docs\n\nUpdated.\n", "utf8");

  const logs: string[] = [];
  const exitCode = await runPrepare({
    repoRoot: tempDir,
    targetRoot: tempDir,
    task: "update README docs",
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  assert.match(logs.join("\n"), /Skills:/);
  assert.match(logs.join("\n"), /Docs Playbook/);

  const workflow = await readJson<{
    artifactType: string;
    status: string;
    steps: Array<{
      stepId: string;
      status: string;
      skillsApplied: string[];
      result: { ok: boolean | null; retryCommand: string | null };
    }>;
  }>(
    path.join(tempDir, ".agent", "state", "workflow.json")
  );
  assert.equal(workflow.artifactType, "kiwi-control/workflow");
  assert.equal(workflow.steps.some((step) => step.stepId === "prepare-context" && step.skillsApplied.includes("docs-playbook")), true);
  const prepareStep = workflow.steps.find((step) => step.stepId === "prepare-context");
  assert.equal(prepareStep?.status, "success");
  assert.equal(prepareStep?.result.ok, true);
  assert.equal(prepareStep?.result.retryCommand, 'kiwi-control prepare "update README docs"');
});

test("constraints include all mandatory rules", () => {
  const selection = {
    include: ["file.ts"],
    exclude: ["node_modules"],
    reason: "test",
    confidence: "high" as const,
    signals: { changedFiles: ["file.ts"], recentFiles: [], importNeighbors: [], proximityFiles: [], keywordMatches: [], repoContextFiles: [] }
  };

  const instructions = generateInstructions("test task", selection);

  assert.ok(instructions.constraints.some((c) => c.includes("Minimal edits")));
  assert.ok(instructions.constraints.some((c) => c.includes("No full repository scanning")));
  assert.ok(instructions.constraints.some((c) => c.includes("No refactoring")));
  assert.ok(instructions.constraints.some((c) => c.includes("Prefer repo-local context first")));
  assert.ok(instructions.constraints.some((c) => c.includes("No over-explaining")));
  assert.ok(instructions.constraints.some((c) => c.includes("Modify tests when behavior or contracts change")));
  assert.ok(instructions.constraints.some((c) => c.includes("Read each file before editing")));
});

test("instruction generator includes validation and stop conditions", () => {
  const selection = {
    include: ["app.ts"],
    exclude: [],
    reason: "test",
    confidence: "medium" as const,
    signals: { changedFiles: ["app.ts"], recentFiles: [], importNeighbors: [], proximityFiles: [], keywordMatches: [], repoContextFiles: [] }
  };

  const instructions = generateInstructions("update app", selection);

  assert.ok(instructions.validationSteps.length > 0, "should have validation steps");
  assert.ok(instructions.stopConditions.length > 0, "should have stop conditions");
  assert.ok(instructions.validationSteps.some((v) => v.includes("build")));
  assert.ok(instructions.stopConditions.some((s) => s.includes("STOP")));
  assert.ok(instructions.raw.includes("## VALIDATION"));
  assert.ok(instructions.raw.includes("## STOP CONDITIONS"));
});

test("low confidence selection adds orientation step", () => {
  const selection = {
    include: ["utils.ts"],
    exclude: [],
    reason: "test",
    confidence: "low" as const,
    signals: { changedFiles: [], recentFiles: ["utils.ts"], importNeighbors: [], proximityFiles: [], keywordMatches: [], repoContextFiles: [] }
  };

  const instructions = generateInstructions("refactor utils", selection);

  assert.ok(instructions.steps.some((s) => s.includes("ORIENTATION")));
  assert.ok(instructions.constraints.some((c) => c.includes("LOW")));
  assert.equal(instructions.confidence, "low");
  assert.match(instructions.raw, /Context confidence: \*\*LOW\*\* — /);
});

test("medium confidence keeps instruction language cautious", () => {
  const selection = {
    include: ["auth.ts"],
    exclude: [],
    reason: "partial coverage",
    confidence: "medium" as const,
    signals: {
      changedFiles: ["auth.ts"],
      recentFiles: ["auth.ts"],
      importNeighbors: [],
      proximityFiles: [],
      keywordMatches: ["auth.ts"],
      repoContextFiles: [],
      discovery: {
        totalFiles: 12,
        discoveredFiles: 12,
        analyzedFiles: 12,
        skippedFiles: 0,
        skippedDirectories: 0,
        visitedDirectories: 4,
        maxDepthExplored: 2,
        fileBudgetReached: false,
        directoryBudgetReached: false,
        partialScan: false,
        ignoreRulesApplied: [],
        skipped: []
      }
    }
  };

  const instructions = generateInstructions("fix auth behavior", selection);

  assert.ok(instructions.constraints.some((c) => c.includes("coverage is still partial")));
  assert.ok(instructions.steps.some((s) => s.includes("Context confidence is medium")));
  assert.doesNotMatch(instructions.raw, /strongly correlated/i);
});

test("high confidence avoids overstating certainty", () => {
  const selection = {
    include: ["src/auth/login.ts", "src/auth/token.ts", ".agent/memory/current-focus.json"],
    exclude: [],
    reason: "strong evidence",
    confidence: "high" as const,
    signals: {
      changedFiles: ["src/auth/login.ts"],
      recentFiles: ["src/auth/login.ts", "src/auth/token.ts"],
      importNeighbors: ["src/auth/token.ts"],
      proximityFiles: [],
      keywordMatches: ["src/auth/login.ts", "src/auth/token.ts"],
      repoContextFiles: [".agent/memory/current-focus.json"],
      discovery: {
        totalFiles: 40,
        discoveredFiles: 40,
        analyzedFiles: 40,
        skippedFiles: 0,
        skippedDirectories: 0,
        visitedDirectories: 10,
        maxDepthExplored: 5,
        fileBudgetReached: false,
        directoryBudgetReached: false,
        partialScan: false,
        ignoreRulesApplied: [],
        skipped: []
      }
    }
  };

  const instructions = generateInstructions("fix auth login token flow", selection);

  assert.ok(instructions.constraints.some((c) => c.includes("multiple repo-local signals agree")));
  assert.doesNotMatch(instructions.raw, /strongly correlated/i);
  assert.match(instructions.raw, /Context confidence: \*\*HIGH\*\* — /);
});

test("instruction generator allows external verification for API tasks", () => {
  const selection = {
    include: ["client.ts"],
    exclude: [],
    reason: "api task",
    confidence: "medium" as const,
    signals: { changedFiles: ["client.ts"], recentFiles: [], importNeighbors: [], proximityFiles: [], keywordMatches: [], repoContextFiles: [] }
  };

  const instructions = generateInstructions("update API client behavior", selection);

  assert.ok(instructions.constraints.some((c) => c.includes("External verification is allowed")));
  assert.ok(instructions.steps.some((step) => step.includes("Verify external API")));
  assert.ok(instructions.validationSteps.some((step) => step.includes("source documentation") || step.includes("runtime assumptions")));
});

test("token estimator keeps docs out of wasted files for docs tasks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-token-docs-"));
  await fs.writeFile(path.join(tempDir, "README.md"), "# Guide\n\nUpdate this doc.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "notes.ts"), "export const note = 'ok';\n", "utf8");

  const estimate = await estimateTokens(tempDir, ["README.md"], "update README docs");

  assert.equal(estimate.wastedFiles.files.some((item) => item.file === "README.md"), false);
});

test("token estimator flags docs as optional during implementation tasks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-token-impl-docs-"));
  await fs.writeFile(path.join(tempDir, "README.md"), "# Guide\n\nImplementation notes.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "app.ts"), "export const app = true;\n", "utf8");

  const estimate = await estimateTokens(tempDir, ["README.md", "app.ts"], "fix implementation bug");

  assert.ok(estimate.wastedFiles.files.some((item) => item.file === "README.md"));
});

test("token estimator skips generated dist-types output and counts it as dist savings", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-token-dist-types-"));
  await fs.mkdir(path.join(tempDir, "apps", "sj-ui", "src"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "apps", "sj-ui", "dist-types"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "apps", "sj-ui", "src", "main.ts"), "export const source = true;\n", "utf8");
  await fs.writeFile(path.join(tempDir, "apps", "sj-ui", "dist-types", "main.js"), "export const generated = 'x'.repeat(2000);\n", "utf8");

  const estimate = await estimateTokens(tempDir, ["apps/sj-ui/src/main.ts"], "fix ui readiness");

  assert.equal(estimate.fileBreakdown.some((entry) => entry.file.includes("dist-types")), false);
  assert.ok(
    estimate.tokenBreakdown.categories.some((entry) => entry.category === "dist" && entry.file_count > 0),
    "dist-types should contribute to dist token savings"
  );
});
