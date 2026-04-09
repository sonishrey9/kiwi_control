import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
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
      compactContextPack: string;
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
    compactContextPack: {
      artifactType: string;
      mode: string;
      task: string | null;
      files: Array<{ file: string; score: number; reasons: string[]; matchedTerms: string[]; matchedSymbols: string[] }>;
      modules: Array<{ id: string; score: number }>;
      clusters: Array<{ id: string; score: number }>;
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
  assert.ok(payload.impactMap.clusters.some((entry) => entry.id === "src" && entry.score > 0));
  assert.ok(payload.compactContextPack.files.some((entry) => entry.file === "src/helper.ts"));
  assert.ok(payload.compactContextPack.files.some((entry) => entry.file === "src/main.ts"));
  assert.ok(payload.compactContextPack.files.some((entry) => entry.file === "src/helper.ts" && entry.matchedSymbols.includes("helper")));
  assert.ok(payload.compactContextPack.files.every((entry) => typeof entry.score === "number"));
  assert.ok(payload.compactContextPack.modules.length > 0);
  assert.ok(payload.compactContextPack.modules.some((entry) => entry.score > 0));
  assert.ok(payload.compactContextPack.clusters.some((entry) => entry.id === "src" && entry.score > 0));

  const controlState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    readOnly: true
  });
  assert.equal(controlState.kiwiControl.repoIntelligence.available, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.repoMapPath, ".agent/context/repo-map.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.compactContextPackAvailable, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.compactContextPackPath, ".agent/context/compact-context-pack.json");
  assert.equal(controlState.kiwiControl.repoIntelligence.compactContextPackTask, "fix helper behavior");
  assert.ok(controlState.kiwiControl.repoIntelligence.impactedFiles.includes("src/main.ts"));
});
