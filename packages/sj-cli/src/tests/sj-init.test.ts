import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

async function createShreyJuniorWrapper(root: string, tempDir: string): Promise<string> {
  const wrapperPath = path.join(tempDir, "shrey-junior");
  await fs.writeFile(
    wrapperPath,
    `#!/usr/bin/env bash\nexec node "${path.join(root, "dist", "cli.js")}" "$@"\n`,
    "utf8"
  );
  await fs.chmod(wrapperPath, 0o755);
  return wrapperPath;
}

function runBashScript(
  scriptPath: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("bash", [scriptPath, ...args], {
    cwd: options?.cwd,
    env: {
      ...process.env,
      ...options?.env
    },
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

test("sj-init help output is available", async () => {
  const root = repoRoot();
  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Make the target folder Shrey Junior-ready/);
  assert.match(result.stdout, /--dry-run/);
});

test("sj-init chooses bootstrap for an empty folder and runs status plus check", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createShreyJuniorWrapper(root, tempDir);
  const target = path.join(tempDir, "new-repo");
  await fs.mkdir(target, { recursive: true });

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target], {
    env: {
      SHREY_JUNIOR_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /mode: bootstrap/);
  assert.match(result.stdout, /core installed:/);
  assert.match(result.stdout, /next action: Fill in \.agent\/context\/architecture\.md, then record a checkpoint/);
  assert.match(result.stdout, /status\/check: ok \/ ok/);
  assert.equal(await fs.access(path.join(target, ".agent", "project.yaml")).then(() => true).catch(() => false), true);
  assert.equal(await fs.access(path.join(target, ".agent", "state", "active-role-hints.json")).then(() => true).catch(() => false), true);
});

test("sj-init chooses standardize for an existing repo", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createShreyJuniorWrapper(root, tempDir);
  const target = path.join(tempDir, "existing-repo");
  await fs.mkdir(path.join(target, ".git"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "existing-repo"\n}\n', "utf8");

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target, "--dry-run"], {
    env: {
      SHREY_JUNIOR_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /mode: standardize \| dry-run=yes/);
  assert.equal(await fs.access(path.join(target, ".agent")).then(() => true).catch(() => false), false);
});

test("sj-init stands down cleanly when repo authority opts out", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createShreyJuniorWrapper(root, tempDir);
  const target = path.join(tempDir, "opt-out-repo");
  await fs.mkdir(path.join(target, ".git"), { recursive: true });
  await fs.writeFile(
    path.join(target, "AGENTS.md"),
    "Repo authority overrides global preferences.\nDo not use Shrey Junior routing or specialist escalation.\nOperate repo-local only.\n",
    "utf8"
  );

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target], {
    env: {
      SHREY_JUNIOR_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /stand down reason:/);
  assert.equal(await fs.access(path.join(target, ".agent")).then(() => true).catch(() => false), false);
});

test("sj-init dry-run does not mutate the target", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createShreyJuniorWrapper(root, tempDir);
  const target = path.join(tempDir, "dry-run-repo");
  await fs.mkdir(target, { recursive: true });

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target, "--dry-run"], {
    env: {
      SHREY_JUNIOR_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /dry-run=yes/);
  assert.equal(await fs.access(path.join(target, ".agent")).then(() => true).catch(() => false), false);
});

test("sj-init failure path is readable when shrey-junior is unavailable", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const target = path.join(tempDir, "failure-repo");
  await fs.mkdir(target, { recursive: true });

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target], {
    env: {
      SHREY_JUNIOR_BIN: path.join(tempDir, "missing-shrey-junior")
    }
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /sj-init error: shrey-junior is not available on PATH/);
});

test("install-global installs sj-init into the global home and creates a PATH symlink", async () => {
  const root = repoRoot();
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "sj-install-"));
  const globalHome = path.join(tempHome, ".shrey-junior");
  const pathBin = path.join(tempHome, ".local", "bin");

  const result = runBashScript(path.join(root, "scripts", "install-global.sh"), [], {
    env: {
      HOME: tempHome,
      SHREY_JUNIOR_HOME: globalHome,
      SHREY_JUNIOR_PATH_BIN: pathBin,
      PATH: process.env.PATH ?? ""
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /PATH-visible sj-init:/);
  assert.match(result.stdout, /PATH update required:/);

  const homeSjInit = path.join(globalHome, "bin", "sj-init");
  const pathSjInit = path.join(pathBin, "sj-init");
  assert.equal(await fs.access(homeSjInit).then(() => true).catch(() => false), true);
  const symlinkStat = await fs.lstat(pathSjInit);
  assert.equal(symlinkStat.isSymbolicLink(), true);
  assert.equal(await fs.readlink(pathSjInit), homeSjInit);

  const helpResult = spawnSync(pathSjInit, ["--help"], {
    env: {
      ...process.env,
      HOME: tempHome
    },
    encoding: "utf8"
  });
  assert.equal(helpResult.status ?? 1, 0);
  assert.match(helpResult.stdout, /sj-init/);
});
