#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await main();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = normalizePlatform(args.platform ?? "auto");
  const bundleRoot = path.resolve(args.bundleRoot ?? path.join(repoRoot, "apps", "sj-ui", "src-tauri", "target", "release", "bundle"));
  const updater = await inspectUpdaterTrust();
  const payload = platform === "windows"
    ? await inspectWindowsTrust({ bundleRoot, strict: args.strict, updater })
    : await inspectMacosTrust({ bundleRoot, strict: args.strict, updater });

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHuman(payload);
  }

  process.exitCode = payload.ok ? 0 : 1;
}

function parseArgs(argv) {
  const parsed = {
    platform: "auto",
    bundleRoot: null,
    json: false,
    strict: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--platform") {
      parsed.platform = argv[index + 1] ?? "auto";
      index += 1;
      continue;
    }
    if (arg === "--bundle-root") {
      parsed.bundleRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--strict") {
      parsed.strict = true;
    }
  }
  return parsed;
}

async function inspectMacosTrust({ bundleRoot, strict, updater }) {
  const artifacts = {
    app: await findArtifact(path.join(bundleRoot, "macos"), (entry) => entry.isDirectory() && entry.name.endsWith(".app")),
    dmg: await findArtifact(path.join(bundleRoot, "dmg"), (entry) => entry.isFile() && entry.name.endsWith(".dmg"))
  };
  const env = collectMacosInputs();
  const codesign = process.platform === "darwin" && artifacts.app
    ? runCommand("codesign", ["-dv", "--verbose=4", artifacts.app])
    : skippedCommand("codesign", process.platform === "darwin" ? "missing macOS app bundle" : "requires macOS host");
  const gatekeeper = process.platform === "darwin" && artifacts.app
    ? runCommand("spctl", ["-a", "-vv", artifacts.app])
    : skippedCommand("spctl", process.platform === "darwin" ? "missing macOS app bundle" : "requires macOS host");
  const stapler = process.platform === "darwin" && artifacts.dmg
    ? runCommand("xcrun", ["stapler", "validate", artifacts.dmg])
    : skippedCommand("xcrun stapler", process.platform === "darwin" ? "missing macOS DMG" : "requires macOS host");
  const signed = codesign.ok && !`${codesign.stdout}\n${codesign.stderr}`.includes("Signature=adhoc");
  const notarized = gatekeeper.ok && stapler.ok;
  const classification = signed && notarized
    ? "signed-and-notarized"
    : signed
      ? "signed-not-notarized"
      : "local-beta-build-only";
  const blocking = [
    ...missingArtifactReasons(artifacts, ["app", "dmg"]),
    ...missingInputReasons(env),
    ...(updater.ok ? [] : updater.blockingReasons),
    ...(strict && classification !== "signed-and-notarized" ? [`macOS trust is ${classification}; strict release requires signed-and-notarized.`] : [])
  ];

  return {
    ok: strict ? blocking.length === 0 : true,
    platform: "macos",
    hostPlatform: process.platform,
    bundleRoot,
    classification,
    artifacts,
    inputs: env,
    updater,
    checks: { codesign, gatekeeper, stapler },
    blockingReasons: blocking
  };
}

async function inspectWindowsTrust({ bundleRoot, strict, updater }) {
  const artifacts = {
    nsis: await findArtifact(path.join(bundleRoot, "nsis"), (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe")),
    msi: await findArtifact(path.join(bundleRoot, "msi"), (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".msi"))
  };
  const env = collectWindowsInputs();
  const nsisSignature = process.platform === "win32" && artifacts.nsis
    ? runPowerShellSignatureCheck(artifacts.nsis)
    : skippedCommand("Get-AuthenticodeSignature", process.platform === "win32" ? "missing NSIS installer" : "requires Windows host");
  const msiSignature = process.platform === "win32" && artifacts.msi
    ? runPowerShellSignatureCheck(artifacts.msi)
    : skippedCommand("Get-AuthenticodeSignature", process.platform === "win32" ? "missing MSI installer" : "requires Windows host");
  const signed = nsisSignature.ok && msiSignature.ok;
  const classification = process.platform !== "win32"
    ? "windows-runner-required"
    : signed
      ? "signed-installers"
      : "unsigned-installers";
  const blocking = [
    ...missingArtifactReasons(artifacts, ["nsis", "msi"]),
    ...missingInputReasons(env),
    ...(updater.ok ? [] : updater.blockingReasons),
    ...(process.platform !== "win32" ? ["Windows installer trust must be proven on a Windows runner or Windows machine."] : []),
    ...(strict && !signed ? [`Windows trust is ${classification}; strict release requires signed NSIS and MSI installers.`] : [])
  ];

  return {
    ok: strict ? blocking.length === 0 : true,
    platform: "windows",
    hostPlatform: process.platform,
    bundleRoot,
    classification,
    artifacts,
    inputs: env,
    updater,
    checks: { nsisSignature, msiSignature },
    blockingReasons: blocking
  };
}

function collectMacosInputs() {
  const signing = anyInputGroup("macOS signing", [
    ["APPLE_SIGNING_IDENTITY"],
    ["APPLE_CERTIFICATE", "APPLE_CERTIFICATE_PASSWORD", "KEYCHAIN_PASSWORD"]
  ]);
  const preferredNotarization = anyInputGroup("macOS notarization preferred", [
    ["APPLE_API_ISSUER", "APPLE_API_KEY", "APPLE_API_KEY_PATH"],
    ["APPLE_API_ISSUER", "APPLE_API_KEY", "APPLE_API_PRIVATE_KEY"]
  ]);
  const fallbackNotarization = anyInputGroup("macOS notarization fallback", [
    ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"]
  ]);
  return {
    groups: [signing, preferredNotarization, fallbackNotarization],
    ready: signing.ready && (preferredNotarization.ready || fallbackNotarization.ready)
  };
}

function collectWindowsInputs() {
  const signing = requiredInputGroup("Windows signing", [
    "WINDOWS_CERTIFICATE_PFX_B64",
    "WINDOWS_CERTIFICATE_PASSWORD",
    "WINDOWS_CERTIFICATE_THUMBPRINT",
    "WINDOWS_TIMESTAMP_URL"
  ]);
  return {
    groups: [signing],
    ready: signing.ready
  };
}

function requiredInputGroup(name, required) {
  const present = required.filter((key) => Boolean(process.env[key]));
  const missing = required.filter((key) => !process.env[key]);
  return {
    name,
    present,
    missing,
    alternativesPresent: [],
    acceptedSets: [required],
    ready: missing.length === 0
  };
}

function anyInputGroup(name, acceptedSets) {
  const keys = [...new Set(acceptedSets.flat())];
  const present = keys.filter((key) => Boolean(process.env[key]));
  const ready = acceptedSets.some((set) => set.every((key) => Boolean(process.env[key])));
  const missing = ready ? [] : keys.filter((key) => !process.env[key]);
  return {
    name,
    present,
    missing,
    alternativesPresent: [],
    acceptedSets,
    ready
  };
}

async function inspectUpdaterTrust() {
  const snippetPath = path.join(repoRoot, "apps", "sj-ui", "src-tauri", "tauri.conf.snippet.json");
  const releasePath = path.join(repoRoot, "apps", "sj-ui", "src-tauri", "tauri.release.conf.json");
  const snippet = await readJson(snippetPath);
  const release = await readJson(releasePath);
  const createUpdaterArtifacts = release?.bundle?.createUpdaterArtifacts ?? snippet?.bundle?.createUpdaterArtifacts ?? false;
  const enabled = createUpdaterArtifacts !== false && createUpdaterArtifacts != null;
  const signingKeyPresent = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY);
  const passwordPresent = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD);
  const blockingReasons = enabled && !signingKeyPresent
    ? ["Tauri updater artifacts are enabled but TAURI_SIGNING_PRIVATE_KEY is missing."]
    : [];
  return {
    enabled,
    createUpdaterArtifacts,
    signingInputs: {
      TAURI_SIGNING_PRIVATE_KEY: signingKeyPresent,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: passwordPresent
    },
    ok: blockingReasons.length === 0,
    blockingReasons
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function findArtifact(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const match = entries.find((entry) => predicate(entry));
  return match ? path.join(directory, match.name) : null;
}

function missingArtifactReasons(artifacts, keys) {
  return keys.filter((key) => !artifacts[key]).map((key) => `Missing ${key} artifact.`);
}

function missingInputReasons(inputs) {
  return inputs.ready
    ? []
    : inputs.groups
        .filter((group) => !group.ready)
        .map((group) => `${group.name} inputs missing: ${group.missing.join(", ")}.`);
}

function runPowerShellSignatureCheck(filePath) {
  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const script = `Get-AuthenticodeSignature -FilePath '${filePath.replaceAll("'", "''")}' | ConvertTo-Json -Compress`;
  const result = runCommand(command, ["-NoProfile", "-Command", script]);
  if (!result.ok) {
    return result;
  }
  return {
    ...result,
    ok: result.stdout.includes("\"Status\":") && result.stdout.includes("Valid")
  };
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return {
    command: [command, ...args].join(" "),
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    skipped: false,
    reason: result.error?.message ?? null
  };
}

function skippedCommand(command, reason) {
  return {
    command,
    ok: false,
    status: null,
    stdout: "",
    stderr: "",
    skipped: true,
    reason
  };
}

function normalizePlatform(value) {
  const normalized = value === "auto" ? process.platform : value;
  switch (normalized) {
    case "darwin":
    case "macos":
      return "macos";
    case "win32":
    case "windows":
      return "windows";
    default:
      throw new Error(`Unsupported release trust platform: ${value}`);
  }
}

function printHuman(payload) {
  console.log(`release trust: ${payload.classification}`);
  console.log(`platform: ${payload.platform} (host: ${payload.hostPlatform})`);
  for (const [key, value] of Object.entries(payload.artifacts)) {
    console.log(`${key}: ${value ?? "missing"}`);
  }
  for (const group of payload.inputs.groups) {
    console.log(`${group.name}: ${group.ready ? "ready" : `missing ${group.missing.join(", ")}`}`);
  }
  if (payload.blockingReasons.length > 0) {
    console.log("blocking reasons:");
    for (const reason of payload.blockingReasons) {
      console.log(`- ${reason}`);
    }
  }
}
