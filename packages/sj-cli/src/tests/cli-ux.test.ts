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

function runCliInCwd(
  args: string[],
  cwd: string,
  entrypoint = cliEntrypoint()
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [entrypoint, ...args], {
    cwd,
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
  assert.match(result.stdout, /Commands default to the current working directory/);
  assert.match(result.stdout, /kiwi-control init/);
  assert.match(result.stdout, /kiwi-control ui/);
  assert.match(result.stdout, /Inside-folder usage:/);
  assert.match(result.stdout, /kiwi-control handoff --to qa-specialist/);
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

test("inside-folder workflow uses the current working directory by default", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-cli-inside-folder-"));
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "package.json"), '{\n  "name": "inside-folder-repo"\n}\n', "utf8");

  const initResult = runCliInCwd(["init"], repoDir);
  assert.equal(initResult.code, 0);

  const statusResult = runCliInCwd(["status"], repoDir);
  assert.equal(statusResult.code, 0);
  assert.match(statusResult.stdout, /repo status:/);
  assert.match(statusResult.stdout, /next action:/);
  assert.match(statusResult.stdout, /token summary:/);

  const checkResult = runCliInCwd(["check"], repoDir);
  assert.equal(checkResult.code, 0);

  const checkpointResult = runCliInCwd(["checkpoint", "inside-folder milestone"], repoDir);
  assert.equal(checkpointResult.code, 0);

  const handoffResult = runCliInCwd(["handoff", "--to", "qa-specialist"], repoDir);
  assert.equal(handoffResult.code, 0);
  assert.match(handoffResult.stdout, /handoff markdown:/);
});
