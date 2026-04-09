import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { writeLatestTaskPacketSet, writeHandoffArtifacts, type HandoffRecord } from "@shrey-junior/sj-core/core/state.js";
import { runAgentPack } from "../commands/agent-pack.js";
import { repoRoot } from "./helpers/desktop-launch.js";

test("agent-pack returns compact general, task, and review pack surfaces", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-agent-pack-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(path.join(target, "src"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "agent-pack-fixture"\n}\n', "utf8");
  await fs.writeFile(
    path.join(target, "src", "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(target, "src", "helper.ts"),
    "export function helper() { return 1; }\n",
    "utf8"
  );

  await runCommand("git", ["init"], target);
  await runCommand("git", ["add", "."], target);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], target);

  await bootstrapTarget({ repoRoot: repoRootPath, targetRoot: target }, config);
  await fs.mkdir(path.join(target, ".agent", "tasks", "sample-run"), { recursive: true });
  await fs.writeFile(path.join(target, ".agent", "tasks", "sample-run", "codex.md"), "# packet\n", "utf8");
  await writeLatestTaskPacketSet(target, [".agent/tasks/sample-run/codex.md"]);
  const handoff: HandoffRecord = {
    artifactType: "shrey-junior/handoff",
    version: 2,
    createdAt: "2026-04-01T00:00:00.000Z",
    toTool: "codex",
    fromRole: "architecture-specialist",
    toRole: "review-specialist",
    taskId: "handoff-agent-pack",
    summary: "Review helper flow",
    goal: "fix helper behavior",
    profile: "product-build",
    mode: "assisted",
    workCompleted: ["Updated helper logic"],
    filesTouched: ["src/helper.ts", "src/main.ts"],
    checksRun: ["npm test"],
    checksPassed: ["npm test"],
    checksFailed: [],
    evidence: [".agent/state/checkpoints/latest.json"],
    openQuestions: [],
    risks: ["helper behavior changed recently"],
    nextFile: "src/main.ts",
    nextCommand: 'kiwi-control validate "fix helper behavior"',
    recommendedMcpPack: "core-pack",
    checkpointPointer: ".agent/state/checkpoints/latest.json",
    readFirst: [".agent/state/checkpoints/latest.json"],
    writeTargets: ["src/main.ts"],
    checksToRun: ["npm test"],
    stopConditions: ["stop on new contract drift"],
    searchGuidance: {
      inspectCodebaseFirst: true,
      repoDocsFirst: true,
      useExternalLookupWhen: [],
      avoidExternalLookupWhen: []
    },
    whatChanged: ["helper logic updated"],
    validationsPending: [],
    risksRemaining: ["helper behavior changed recently"],
    latestCheckpoint: ".agent/state/checkpoints/latest.json",
    checkpointSummary: "Bootstrap seed only.",
    nextStep: "Validate helper behavior.",
    status: "blocked"
  };
  await writeHandoffArtifacts(target, "handoff-review", handoff, "# Handoff\n", "# Brief\n");
  await recordExecutionState(target, {
    type: "prepare-completed",
    lifecycle: "packet-created",
    task: "fix helper behavior",
    sourceCommand: 'kiwi-control prepare "fix helper behavior"',
    reason: 'Prepared scope for "fix helper behavior".',
    nextCommand: 'kiwi-control run "fix helper behavior"'
  });
  await fs.writeFile(path.join(target, "src", "helper.ts"), "export function helper() { return 2; }\n", "utf8");

  const capture = async (options: Omit<Parameters<typeof runAgentPack>[0], "logger">) => {
    const lines: string[] = [];
    const exitCode = await runAgentPack({
      ...options,
      logger: {
        info(message: string) {
          lines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    return {
      exitCode,
      payload: JSON.parse(lines.join("\n")) as Record<string, unknown>
    };
  };

  const general = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    json: true
  });
  assert.equal(general.exitCode, 0);
  assert.equal((general.payload.agentPack as { artifactType: string }).artifactType, "kiwi-control/agent-pack");
  const generalAgentPack = general.payload.agentPack as {
    readFirst: string[];
    packPointers: { readySubstrate: string };
  };
  assert.equal(generalAgentPack.readFirst[0], ".agent/context/agent-pack.json");
  assert.equal(generalAgentPack.readFirst[1], ".agent/state/ready-substrate.json");
  assert.equal(generalAgentPack.packPointers.readySubstrate, ".agent/state/ready-substrate.json");

  const task = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    task: "fix helper behavior",
    json: true
  });
  assert.equal(task.exitCode, 0);
  const taskPack = task.payload.taskPack as {
    artifactType: string;
    task: string | null;
    focus: { files: Array<{ file: string }> };
  };
  assert.equal(taskPack.artifactType, "kiwi-control/task-pack");
  assert.equal(taskPack.task, "fix helper behavior");
  assert.ok(taskPack.focus.files.some((entry) => entry.file === "src/helper.ts"));

  const review = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    review: true,
    json: true
  });
  assert.equal(review.exitCode, 0);
  const reviewPack = review.payload.reviewContextPack as {
    artifactType: string;
    reviewAttention: Array<{ target: string }>;
  };
  assert.equal(reviewPack.artifactType, "kiwi-control/review-context-pack");
  assert.ok(reviewPack.reviewAttention.length > 0);

  const controlState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    readOnly: true
  });
  assert.equal(controlState.kiwiControl.repoIntelligence.agentPackAvailable, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.agentPackPath, ".agent/context/agent-pack.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.taskPackAvailable, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.taskPackPath, ".agent/context/task-pack.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.reviewContextPackAvailable, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.reviewContextPackPath, ".agent/context/review-context-pack.json");
  assert.equal(controlState.kiwiControl.readySubstrate.ready, true);
  assert.equal(controlState.kiwiControl.readySubstrate.toolEntry.path, ".agent/context/agent-pack.json");
});
