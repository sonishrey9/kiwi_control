import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

test("open-source readiness verifier passes for the checked-in repo surface", () => {
  const root = repoRoot();
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "verify-open-source-readiness.mjs")], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as {
    ok: boolean;
    missingFiles: string[];
    missingGitignorePatterns: string[];
    leakedDocs: string[];
    trackedNoise: string[];
    missingPolicyLinks: string[];
  };
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.missingFiles, []);
  assert.deepEqual(payload.missingGitignorePatterns, []);
  assert.deepEqual(payload.leakedDocs, []);
  assert.deepEqual(payload.trackedNoise, []);
  assert.deepEqual(payload.missingPolicyLinks, []);
});
