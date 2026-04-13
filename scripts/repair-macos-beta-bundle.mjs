#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));

if (process.platform !== "darwin") {
  throw new Error("repair-macos-beta-bundle.mjs only runs on macOS.");
}

const appPath = path.resolve(requiredArg(args.appPath, "--app-path"));
const dmgPath = args.dmgPath ? path.resolve(args.dmgPath) : null;
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY?.trim() || "-";
const volumeName = args.volumeName ?? "Kiwi Control";

run("xattr", ["-cr", appPath]);
run("codesign", ["--force", "--deep", "--sign", signingIdentity, appPath]);
run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath]);

let spctl = capture("spctl", ["-a", "-vv", appPath], { allowFailure: true });

if (dmgPath) {
  await rebuildDmg({
    appPath,
    dmgPath,
    volumeName
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      appPath,
      dmgPath,
      signingIdentity,
      codesignVerified: true,
      spctlOk: spctl.status === 0,
      spctlOutput: `${spctl.stdout}${spctl.stderr}`.trim() || null
    },
    null,
    2
  )
);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--app-path") {
      parsed.appPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--dmg-path") {
      parsed.dmgPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--volume-name") {
      parsed.volumeName = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return parsed;
}

function requiredArg(value, name) {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

async function rebuildDmg({ appPath, dmgPath, volumeName }) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-beta-dmg-"));
  const stagedAppPath = path.join(tempRoot, path.basename(appPath));
  const tempDmgPath = path.join(tempRoot, path.basename(dmgPath));

  try {
    await fs.cp(appPath, stagedAppPath, { recursive: true });
    run("hdiutil", ["create", "-volname", volumeName, "-srcfolder", stagedAppPath, "-ov", "-format", "UDZO", tempDmgPath]);
    await fs.mkdir(path.dirname(dmgPath), { recursive: true });
    await fs.copyFile(tempDmgPath, dmgPath);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function run(command, args) {
  const result = capture(command, args);
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`);
  }
}

function capture(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  });
}
