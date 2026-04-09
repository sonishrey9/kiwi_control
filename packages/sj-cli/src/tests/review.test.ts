import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import { runReview } from "../commands/review.js";
import { repoRoot } from "./helpers/desktop-launch.js";

test("review builds a compact review pack for the working tree and an explicit base ref", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-review-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(path.join(target, "src"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "review-fixture"\n}\n', "utf8");
  await fs.writeFile(
    path.join(target, "src", "main.ts"),
    'import { helper } from "./helper.js";\nimport { worker } from "./worker.js";\nexport function run() { return helper() + worker(); }\n',
    "utf8"
  );
  await fs.writeFile(path.join(target, "src", "helper.ts"), "export function helper() { return 1; }\n", "utf8");
  await fs.writeFile(
    path.join(target, "src", "worker.ts"),
    'import { helper } from "./helper.js";\nexport function worker() { return helper(); }\n',
    "utf8"
  );

  await runCommand("git", ["init"], target);
  await runCommand("git", ["add", "."], target);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], target);

  await bootstrapTarget({ repoRoot: repoRootPath, targetRoot: target }, config);

  await fs.writeFile(path.join(target, "src", "helper.ts"), "export function helper() { return 2; }\n", "utf8");
  await runCommand("git", ["add", "src/helper.ts"], target);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "helper"], target);

  await fs.writeFile(
    path.join(target, "src", "worker.ts"),
    'import { helper } from "./helper.js";\nexport function worker() { return helper() + 1; }\n',
    "utf8"
  );

  const runReviewJson = async (baseRef?: string) => {
    const lines: string[] = [];
    const exitCode = await runReview({
      repoRoot: repoRootPath,
      targetRoot: target,
      ...(baseRef ? { baseRef } : {}),
      json: true,
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
      payload: JSON.parse(lines.join("\n")) as {
        artifactType: string;
        source: string;
        baseRef: string | null;
        summary: string;
        changedFiles: string[];
        rankedFiles: Array<{ file: string; score: number }>;
        rankedModules: Array<{ id: string; score: number }>;
        impactChains: Array<{ file: string; chain: string[] }>;
        repeatedTouchAreas: Array<{ kind: string; target: string }>;
        likelyMissingValidation: string[];
        reviewOrder: Array<{ kind: string; target: string }>;
        reviewerHandoff: { readFirst: string[] };
        codingToolHandoff: { readFirst: string[] };
      }
    };
  };

  const baseReview = await runReviewJson("HEAD~1");
  assert.equal(baseReview.exitCode, 0);
  assert.equal(baseReview.payload.artifactType, "kiwi-control/review-pack");
  assert.equal(baseReview.payload.source, "git-base");
  assert.equal(baseReview.payload.baseRef, "HEAD~1");
  assert.match(baseReview.payload.summary, /Review/);
  assert.ok(baseReview.payload.changedFiles.includes("src/helper.ts"));
  assert.ok(baseReview.payload.rankedFiles.some((entry) => entry.file === "src/helper.ts" && entry.score > 0));
  assert.ok(baseReview.payload.rankedModules.some((entry) => entry.score > 0));
  assert.ok(baseReview.payload.reviewerHandoff.readFirst.includes(".agent/context/review-pack.json"));

  const workingTreeReview = await runReviewJson();
  assert.equal(workingTreeReview.exitCode, 0);
  assert.equal(workingTreeReview.payload.source, "working-tree");
  assert.equal(workingTreeReview.payload.baseRef, null);
  assert.ok(workingTreeReview.payload.changedFiles.includes("src/worker.ts"));
  assert.ok(workingTreeReview.payload.reviewOrder.length > 0);
  assert.ok(workingTreeReview.payload.likelyMissingValidation.length > 0);
  assert.ok(workingTreeReview.payload.codingToolHandoff.readFirst.includes(".agent/context/task-pack.json"));

  const controlState = await buildRepoControlState({
    repoRoot: repoRootPath,
    targetRoot: target,
    readOnly: true
  });
  assert.equal(controlState.kiwiControl.repoIntelligence.reviewPackAvailable, true);
  assert.equal(controlState.kiwiControl.repoIntelligence.reviewPackPath, ".agent/context/review-pack.json");
  assert.equal(typeof controlState.kiwiControl.repoIntelligence.reviewPackSummary, "string");
});
