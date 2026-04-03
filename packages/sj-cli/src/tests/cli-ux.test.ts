import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function cliEntrypoint(): string {
  return path.join(repoRoot(), "packages", "sj-cli", "dist", "cli.js");
}

function runCli(args: string[], entrypoint = cliEntrypoint()): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [entrypoint, ...args], {
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  return {
    code: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

test("--help exits cleanly and leads with the installed Kiwi Control command surface", () => {
  const result = runCli(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Kiwi Control/);
  assert.match(result.stdout, /Core commands:/);
  assert.match(result.stdout, /kiwi-control init --target \/path\/to\/repo/);
  assert.match(result.stdout, /kiwi-control ui/);
  assert.match(result.stdout, /Installed usage:/);
  assert.match(result.stdout, /Contributor source usage:/);
  assert.match(result.stdout, /npm run ui:dev/);
});

test("compatibility aliases still work but point new usage toward kiwi-control and kc", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-alias-"));
  const aliasPath = path.join(tempDir, "sj");
  await fs.symlink(cliEntrypoint(), aliasPath);

  const result = runCli(["--help"], aliasPath);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Compatibility alias invoked: sj/);
  assert.match(result.stdout, /Prefer kiwi-control or kc/);
});

test("unknown commands exit with usage status and corrective guidance", () => {
  const result = runCli(["does-not-exist"]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /kiwi-control usage error:/);
  assert.match(result.stderr, /unknown command: does-not-exist/);
  assert.match(result.stderr, /Core commands: init, status, check, specialists, checkpoint, handoff, ui/);
});
