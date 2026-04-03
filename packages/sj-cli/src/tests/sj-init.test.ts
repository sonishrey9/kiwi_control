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

async function createCliWrapper(root: string, tempDir: string, commandName = "kiwi-control"): Promise<string> {
  const wrapperPath = path.join(tempDir, commandName);
  await fs.writeFile(
    wrapperPath,
    `#!/usr/bin/env bash\nexec node "${path.join(root, "packages", "sj-cli", "dist", "cli.js")}" "$@"\n`,
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
  assert.match(result.stdout, /Make the target folder Kiwi Control-ready/);
  assert.match(result.stdout, /--dry-run/);
});

test("sj-init chooses bootstrap for an empty folder and runs status plus check", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createCliWrapper(root, tempDir);
  const target = path.join(tempDir, "new-repo");
  await fs.mkdir(target, { recursive: true });

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target], {
    env: {
      KIWI_CONTROL_BIN: wrapper
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
  const wrapper = await createCliWrapper(root, tempDir);
  const target = path.join(tempDir, "existing-repo");
  await fs.mkdir(path.join(target, ".git"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "existing-repo"\n}\n', "utf8");

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target, "--dry-run"], {
    env: {
      KIWI_CONTROL_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /mode: standardize \| dry-run=yes/);
  assert.equal(await fs.access(path.join(target, ".agent")).then(() => true).catch(() => false), false);
});

test("sj-init stands down cleanly when repo authority opts out", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createCliWrapper(root, tempDir);
  const target = path.join(tempDir, "opt-out-repo");
  await fs.mkdir(path.join(target, ".git"), { recursive: true });
  await fs.writeFile(
    path.join(target, "AGENTS.md"),
    "Repo authority overrides global preferences.\nDo not use Shrey Junior routing or specialist escalation.\nOperate repo-local only.\n",
    "utf8"
  );

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target], {
    env: {
      KIWI_CONTROL_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /stand down reason:/);
  assert.equal(await fs.access(path.join(target, ".agent")).then(() => true).catch(() => false), false);
});

test("sj-init dry-run does not mutate the target", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const wrapper = await createCliWrapper(root, tempDir);
  const target = path.join(tempDir, "dry-run-repo");
  await fs.mkdir(target, { recursive: true });

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target, "--dry-run"], {
    env: {
      KIWI_CONTROL_BIN: wrapper
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /dry-run=yes/);
  assert.equal(await fs.access(path.join(target, ".agent")).then(() => true).catch(() => false), false);
});

test("sj-init failure path is readable when the Kiwi Control CLI is unavailable", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-init-"));
  const target = path.join(tempDir, "failure-repo");
  await fs.mkdir(target, { recursive: true });

  const result = runBashScript(path.join(root, "scripts", "sj-init.sh"), ["--target", target], {
    env: {
      KIWI_CONTROL_BIN: path.join(tempDir, "missing-kiwi-control")
    }
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /sj-init error: Kiwi Control CLI is not available on PATH/);
});

test("install-global installs kiwi-control plus compatibility aliases into the global home", async () => {
  const root = repoRoot();
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "sj-install-"));
  const globalHome = path.join(tempHome, ".kiwi-control");
  const pathBin = path.join(tempHome, ".local", "bin");
  const profilePath = path.join(tempHome, ".zshrc");

  const result = runBashScript(path.join(root, "scripts", "install-global.sh"), [], {
    env: {
      HOME: tempHome,
      KIWI_CONTROL_HOME: globalHome,
      KIWI_CONTROL_PATH_BIN: pathBin,
      SHELL: "/bin/zsh",
      PATH: process.env.PATH ?? ""
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Installed commands:/);
  assert.match(result.stdout, /Temporary beta compatibility aliases:/);
  assert.match(result.stdout, /PATH updated in .*\.zshrc/);
  assert.match(result.stdout, /Next step: source .*\.zshrc/);

  const homeSjInit = path.join(globalHome, "bin", "sj-init");
  const pathSjInit = path.join(pathBin, "sj-init");
  const homeKiwiControl = path.join(globalHome, "bin", "kiwi-control");
  const pathKiwiControl = path.join(pathBin, "kiwi-control");
  const pathKc = path.join(pathBin, "kc");
  const pathShreyJunior = path.join(pathBin, "shrey-junior");
  assert.equal(await fs.access(homeSjInit).then(() => true).catch(() => false), true);
  assert.equal(await fs.access(homeKiwiControl).then(() => true).catch(() => false), true);
  assert.equal(await fs.access(pathKiwiControl).then(() => true).catch(() => false), true);
  assert.equal(await fs.access(pathKc).then(() => true).catch(() => false), true);
  const symlinkStat = await fs.lstat(pathSjInit);
  assert.equal(symlinkStat.isSymbolicLink(), true);
  assert.equal(await fs.readlink(pathSjInit), homeSjInit);
  const kcAliasStat = await fs.lstat(pathKc);
  assert.equal(kcAliasStat.isSymbolicLink(), true);
  assert.equal(await fs.readlink(pathKc), pathKiwiControl);
  const legacyAliasStat = await fs.lstat(pathShreyJunior);
  assert.equal(legacyAliasStat.isSymbolicLink(), true);
  assert.equal(await fs.readlink(pathShreyJunior), pathKiwiControl);
  const profileContents = await fs.readFile(profilePath, "utf8");
  assert.match(profileContents, /# >>> Kiwi Control PATH >>>/);
  assert.match(profileContents, /export PATH=".*\.local\/bin:\$PATH"/);

  const helpResult = spawnSync(pathKiwiControl, ["--help"], {
    env: {
      ...process.env,
      HOME: tempHome
    },
    encoding: "utf8"
  });
  assert.equal(helpResult.status ?? 1, 0);
  assert.match(helpResult.stdout, /Kiwi Control/);
});

test("install-global upgrades legacy managed alias files into symlinks", async () => {
  const root = repoRoot();
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "sj-install-migrate-"));
  const globalHome = path.join(tempHome, ".shrey-junior");
  const pathBin = path.join(tempHome, ".local", "bin");

  await fs.mkdir(path.join(globalHome, "bin"), { recursive: true });
  await fs.mkdir(pathBin, { recursive: true });
  await fs.writeFile(path.join(globalHome, "bin", "shrey-junior"), "#!/usr/bin/env bash\necho legacy\n", "utf8");
  await fs.writeFile(path.join(pathBin, "shrey-junior"), "#!/usr/bin/env bash\necho legacy\n", "utf8");

  const result = runBashScript(path.join(root, "scripts", "install-global.sh"), [], {
    env: {
      HOME: tempHome,
      SHREY_JUNIOR_HOME: globalHome,
      SHREY_JUNIOR_PATH_BIN: pathBin,
      SHELL: "/bin/zsh",
      PATH: process.env.PATH ?? ""
    }
  });

  assert.equal(result.code, 0);
  const homeLegacyAlias = path.join(globalHome, "bin", "shrey-junior");
  const pathLegacyAlias = path.join(pathBin, "shrey-junior");
  assert.equal((await fs.lstat(homeLegacyAlias)).isSymbolicLink(), true);
  assert.equal((await fs.lstat(pathLegacyAlias)).isSymbolicLink(), true);
  assert.equal(await fs.readlink(homeLegacyAlias), path.join(globalHome, "bin", "kiwi-control"));
  assert.equal(await fs.readlink(pathLegacyAlias), path.join(pathBin, "kiwi-control"));
});
