import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { recordExecutionState } from "@shrey-junior/sj-core/core/execution-state.js";
import { writeHandoffArtifacts, writeLatestTaskPacketSet, type HandoffRecord } from "@shrey-junior/sj-core/core/state.js";
import { runRepoMap } from "../commands/repo-map.js";
import { repoRoot } from "./helpers/desktop-launch.js";

test("repo-map builds compact repo intelligence artifacts and a changed-area context pack", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-repo-map-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(path.join(target, "src"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "repo-map-fixture"\n}\n', "utf8");
  await fs.writeFile(
    path.join(target, "src", "main.ts"),
    'import { helper } from "./helper.js";\nimport { runWorker } from "./worker.js";\nexport function run() { return helper() + runWorker(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(target, "src", "helper.ts"),
    "export function helper() { return 1; }\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(target, "src", "worker.ts"),
    'import { helper } from "./helper.js";\nexport function runWorker() { return helper(); }\n',
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
    taskId: "handoff-repo-map",
    summary: "Review the helper flow",
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
  await fs.writeFile(
    path.join(target, "src", "helper.ts"),
    "export function helper() { return 2; }\n",
    "utf8"
  );

  const logs: string[] = [];
  const exitCode = await runRepoMap({
    repoRoot: repoRootPath,
    targetRoot: target,
    changed: true,
    task: "fix helper behavior",
    json: true,
    logger: {
      info(message: string) {
        logs.push(message);
      },
      warn() {},
      error() {}
    } as never
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(logs.join("\n")) as {
    artifactPaths: {
      repoMap: string;
      symbolIndex: string;
      dependencyGraph: string;
      impactMap: string;
      decisionGraph: string;
      historyGraph: string;
      reviewGraph: string;
      compactContextPack: string;
      reviewContextPack: string;
    };
    repoMap: {
      artifactType: string;
      entryPoints: string[];
      keyModules: Array<{ id: string }>;
    };
    symbolIndex: {
      artifactType: string;
      symbols: Array<{ symbol: string; file: string; kind: string }>;
    };
    dependencyGraph: {
      artifactType: string;
      edges: Array<{ from: string; to: string; kind: string }>;
      fileRelationships: Array<{ file: string; imports: string[]; importedBy: string[] }>;
    };
    impactMap: {
      artifactType: string;
      changedFiles: string[];
      impactedFiles: string[];
      dependencyChains: Record<string, string[]>;
      rankedFiles: Array<{ file: string; score: number; reasons: string[] }>;
      rankedModules: Array<{ id: string; score: number; topFiles: string[] }>;
      clusters: Array<{ id: string; score: number; topFiles: string[] }>;
    };
    decisionGraph: {
      artifactType: string;
      importantDecisions: Array<{ kind: string; relatedFiles: string[] }>;
      nodes: Array<{ kind: string; label: string }>;
    };
    historyGraph: {
      artifactType: string;
      hotspotFiles: Array<{ file: string; touches: number }>;
      hotspotModules: Array<{ id: string; touches: number }>;
      repeatedTouchModules: Array<{ id: string; touches: number }>;
      changeClusters: Array<{ id: string; touches: number }>;
    };
    reviewGraph: {
      artifactType: string;
      fileRisks: Array<{ file: string; score: number; reasons: string[] }>;
      moduleRisks: Array<{ id: string; score: number }>;
      reviewAttention: Array<{ kind: string; target: string; score: number }>;
      globalSignals: Array<{ signal: string }>;
    };
    compactContextPack: {
      artifactType: string;
      mode: string;
      task: string | null;
      files: Array<{ file: string; score: number; reasons: string[]; matchedTerms: string[]; matchedSymbols: string[] }>;
      modules: Array<{ id: string; score: number }>;
      clusters: Array<{ id: string; score: number }>;
    };
    reviewContextPack: {
      artifactType: string;
      currentTask: string | null;
      decisions: Array<{ kind: string }>;
      hotspots: Array<{ kind: string; target: string }>;
      reviewAttention: Array<{ kind: string; target: string }>;
    };
  };

  assert.equal(payload.repoMap.artifactType, "kiwi-control/repo-map");
  assert.equal(payload.symbolIndex.artifactType, "kiwi-control/symbol-index");
  assert.equal(payload.dependencyGraph.artifactType, "kiwi-control/dependency-graph");
  assert.equal(payload.impactMap.artifactType, "kiwi-control/impact-map");
  assert.equal(payload.compactContextPack.artifactType, "kiwi-control/compact-context-pack");
  assert.equal(payload.compactContextPack.mode, "changed");
  assert.equal(payload.compactContextPack.task, "fix helper behavior");
  assert.equal(payload.artifactPaths.repoMap, ".agent/context/repo-map.json");
  assert.equal(payload.artifactPaths.compactContextPack, ".agent/context/compact-context-pack.json");
  assert.equal(payload.artifactPaths.decisionGraph, ".agent/state/decision-graph.json");
  assert.equal(payload.artifactPaths.historyGraph, ".agent/state/history-graph.json");
  assert.equal(payload.artifactPaths.reviewGraph, ".agent/state/review-graph.json");
  assert.equal(payload.artifactPaths.reviewContextPack, ".agent/context/review-context-pack.json");
  assert.ok(payload.repoMap.entryPoints.some((entry) => entry.endsWith("src/main.ts")));
  assert.ok(payload.symbolIndex.symbols.some((entry) => entry.symbol === "helper" && entry.file === "src/helper.ts"));
  assert.ok(
    payload.dependencyGraph.edges.some(
      (edge) => edge.from === "src/main.ts" && edge.to === "src/helper.ts" && edge.kind === "import"
    )
  );
  assert.ok(payload.impactMap.changedFiles.includes("src/helper.ts"));
  assert.ok(payload.impactMap.impactedFiles.includes("src/main.ts"));
  assert.ok(payload.impactMap.impactedFiles.includes("src/worker.ts"));
  assert.deepEqual(payload.impactMap.dependencyChains["src/main.ts"], ["src/helper.ts", "src/main.ts"]);
  assert.equal(payload.impactMap.rankedFiles[0]?.file, "src/helper.ts");
  assert.ok(payload.impactMap.rankedFiles.some((entry) => entry.file === "src/main.ts" && entry.score > 0));
  assert.ok(payload.impactMap.rankedModules.some((entry) => entry.score > 0));
  assert.ok(payload.impactMap.clusters.some((entry) => entry.id.startsWith("src") && entry.score > 0));
  assert.equal(payload.decisionGraph.artifactType, "kiwi-control/decision-graph");
  assert.ok(payload.decisionGraph.nodes.some((entry) => entry.kind === "checkpoint"));
  assert.ok(payload.decisionGraph.nodes.some((entry) => entry.kind === "handoff"));
  assert.ok(payload.decisionGraph.nodes.some((entry) => entry.kind === "execution-event"));
  assert.ok(payload.decisionGraph.importantDecisions.some((entry) => entry.relatedFiles.includes("src/helper.ts")));
  assert.equal(payload.historyGraph.artifactType, "kiwi-control/history-graph");
  assert.ok(payload.historyGraph.hotspotFiles.some((entry) => entry.file === "src/helper.ts" && entry.touches >= 1));
  assert.ok(payload.historyGraph.hotspotModules.some((entry) => entry.id.startsWith("src") && entry.touches >= 1));
  assert.ok(payload.historyGraph.changeClusters.some((entry) => entry.id.startsWith("src") && entry.touches >= 1));
  assert.equal(payload.reviewGraph.artifactType, "kiwi-control/review-graph");
  assert.ok(payload.reviewGraph.fileRisks.some((entry) => entry.file === "src/helper.ts" && entry.score > 0));
  assert.ok(payload.reviewGraph.moduleRisks.some((entry) => entry.id.startsWith("src") && entry.score > 0));
  assert.ok(payload.reviewGraph.reviewAttention.length > 0);
  assert.ok(payload.reviewGraph.globalSignals.length > 0);
  assert.ok(payload.compactContextPack.files.some((entry) => entry.file === "src/helper.ts"));
  assert.ok(payload.compactContextPack.files.some((entry) => entry.file === "src/main.ts"));
  assert.ok(payload.compactContextPack.files.some((entry) => entry.file === "src/helper.ts" && entry.matchedSymbols.includes("helper")));
  assert.ok(payload.compactContextPack.files.every((entry) => typeof entry.score === "number"));
  assert.ok(payload.compactContextPack.modules.length > 0);
  assert.ok(payload.compactContextPack.modules.some((entry) => entry.score > 0));
  assert.ok(payload.compactContextPack.clusters.some((entry) => entry.id.startsWith("src") && entry.score > 0));
  assert.equal(payload.reviewContextPack.artifactType, "kiwi-control/review-context-pack");
  assert.equal(payload.reviewContextPack.currentTask, "fix helper behavior");
  assert.ok(payload.reviewContextPack.decisions.length > 0);
  assert.ok(payload.reviewContextPack.hotspots.some((entry) => entry.target === "src/helper.ts"));
  assert.ok(payload.reviewContextPack.reviewAttention.length > 0);

  const controlState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    readOnly: true
  });
  assert.equal(controlState.kiwiControl.repoIntelligence.available, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.repoMapPath, ".agent/context/repo-map.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.decisionGraphPath, ".agent/state/decision-graph.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.historyGraphPath, ".agent/state/history-graph.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.reviewGraphPath, ".agent/state/review-graph.json");
  assert.ok(controlState.kiwiControl.repoIntelligence.importantDecisions > 0);
  assert.ok(controlState.kiwiControl.repoIntelligence.hotspotFiles > 0);
  assert.ok(controlState.kiwiControl.repoIntelligence.reviewRiskTargets > 0);
  assert.equal(controlState.kiwiControl.repoIntelligence.compactContextPackAvailable, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.compactContextPackPath, ".agent/context/compact-context-pack.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.compactContextPackTask, "fix helper behavior");
  assert.ok(controlState.kiwiControl.repoIntelligence.impactedFiles.includes("src/main.ts"));
});
