#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv({ envPath: path.join(repoRoot, ".env") });

const args = parseArgs(process.argv.slice(2));

if (process.platform !== "darwin") {
  throw new Error("macOS pkg packaging is only supported on macOS hosts.");
}

const appPath = path.resolve(requiredArg(args.appPath, "--app-path"));
const outputPath = path.resolve(requiredArg(args.outputPath, "--output-path"));
const version = requiredArg(args.version, "--version");
const identifier = args.identifier ?? "in.kiwi-ai.kiwi-control.pkg";
const installLocation = args.installLocation ?? "/";
const installScope = args.installScope ?? "machine";
const appName = path.basename(appPath);
const postinstallTemplatePath = path.join(repoRoot, "scripts", "pkg-postinstall.sh.template");
const installerSigningIdentity = resolveInstallerSigningIdentity();

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pkg-"));
const payloadRoot = path.join(tempRoot, "payload");
const scriptsDir = path.join(tempRoot, "scripts");
const componentAppPath = path.join(payloadRoot, "Applications", appName);
const componentPkgPath = path.join(tempRoot, "component.pkg");

try {
  await fs.mkdir(path.join(payloadRoot, "Applications"), { recursive: true });
  await fs.mkdir(scriptsDir, { recursive: true });
  await fs.cp(appPath, componentAppPath, { recursive: true });
  await normalizeMacosAppBundle(componentAppPath);

  const postinstallTemplate = await fs.readFile(postinstallTemplatePath, "utf8");
  const postinstall = postinstallTemplate
    .replaceAll("__APP_NAME__", appName)
    .replaceAll("__INSTALL_SCOPE__", installScope);
  const postinstallPath = path.join(scriptsDir, "postinstall");
  await fs.writeFile(postinstallPath, postinstall, "utf8");
  await fs.chmod(postinstallPath, 0o755);

  const pkgbuildArgs = [
    "--root",
    payloadRoot,
    "--identifier",
    identifier,
    "--version",
    version,
    "--install-location",
    installLocation,
    "--scripts",
    scriptsDir,
    componentPkgPath
  ];

  if (installerSigningIdentity) {
    pkgbuildArgs.splice(pkgbuildArgs.length - 1, 0, "--sign", installerSigningIdentity);
  }

  run("pkgbuild", pkgbuildArgs);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.copyFile(componentPkgPath, outputPath);

  const notarized = await maybeNotarizePkg(outputPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        appPath,
        outputPath,
        identifier,
        installLocation,
        installScope,
        installerSigningIdentity: installerSigningIdentity || null,
        notarized
      },
      null,
      2
    )
  );
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--app-path") {
      parsed.appPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--output-path") {
      parsed.outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--version") {
      parsed.version = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--identifier") {
      parsed.identifier = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--install-location") {
      parsed.installLocation = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--install-scope") {
      parsed.installScope = argv[index + 1] ?? null;
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

function resolveInstallerSigningIdentity() {
  const explicit = process.env.APPLE_INSTALLER_SIGNING_IDENTITY?.trim();
  if (explicit) {
    return explicit;
  }
  const fallback = process.env.APPLE_SIGNING_IDENTITY?.trim();
  if (fallback && /installer/i.test(fallback)) {
    return fallback;
  }
  return null;
}

async function maybeNotarizePkg(outputPath) {
  if (!resolveInstallerSigningIdentity()) {
    return false;
  }

  const apiKey = process.env.APPLE_API_KEY?.trim();
  const apiIssuer = process.env.APPLE_API_ISSUER?.trim();
  const apiKeyPath = process.env.APPLE_API_KEY_PATH?.trim();
  const apiPrivateKey = process.env.APPLE_API_PRIVATE_KEY?.trim();
  const appleId = process.env.APPLE_ID?.trim();
  const applePassword = process.env.APPLE_PASSWORD?.trim();
  const appleTeamId = process.env.APPLE_TEAM_ID?.trim();

  let tempKeyPath = null;
  try {
    if (apiKey && apiIssuer && (apiKeyPath || apiPrivateKey)) {
      tempKeyPath = apiKeyPath
        ? apiKeyPath
        : path.join(await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-notary-key-")), `AuthKey_${apiKey}.p8`);
      if (apiPrivateKey && !apiKeyPath) {
        await fs.writeFile(tempKeyPath, apiPrivateKey, "utf8");
      }
      run("xcrun", [
        "notarytool",
        "submit",
        outputPath,
        "--key",
        tempKeyPath,
        "--key-id",
        apiKey,
        "--issuer",
        apiIssuer,
        "--wait"
      ]);
      run("xcrun", ["stapler", "staple", outputPath]);
      return true;
    }

    if (appleId && applePassword && appleTeamId) {
      run("xcrun", [
        "notarytool",
        "submit",
        outputPath,
        "--apple-id",
        appleId,
        "--password",
        applePassword,
        "--team-id",
        appleTeamId,
        "--wait"
      ]);
      run("xcrun", ["stapler", "staple", outputPath]);
      return true;
    }
  } finally {
    if (tempKeyPath && apiPrivateKey && !apiKeyPath) {
      await fs.rm(path.dirname(tempKeyPath), { recursive: true, force: true });
    }
  }

  return false;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`);
  }
}

async function normalizeMacosAppBundle(rootPath) {
  await walkAndNormalize(rootPath, rootPath);
}

async function walkAndNormalize(rootPath, currentPath) {
  const stats = await fs.stat(currentPath);
  if (stats.isDirectory()) {
    await fs.chmod(currentPath, 0o755);
    const entries = await fs.readdir(currentPath);
    for (const entry of entries) {
      await walkAndNormalize(rootPath, path.join(currentPath, entry));
    }
    return;
  }

  await fs.chmod(currentPath, shouldRemainExecutable(rootPath, currentPath) ? 0o755 : 0o644);
}

function shouldRemainExecutable(rootPath, currentPath) {
  const relativePath = path.relative(rootPath, currentPath).replace(/\\/g, "/");
  if (relativePath.startsWith("Contents/MacOS/")) {
    return true;
  }
  if (relativePath.startsWith("Contents/Resources/desktop/node/")) {
    return true;
  }
  if (relativePath.startsWith("Contents/Resources/desktop/cli-bundle/bin/")) {
    return true;
  }
  if (relativePath.endsWith("/install.sh")) {
    return true;
  }
  if (relativePath.endsWith(".dylib")) {
    return true;
  }
  return false;
}
