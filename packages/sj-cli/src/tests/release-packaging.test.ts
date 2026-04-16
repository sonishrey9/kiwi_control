import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

test("release manifest declares macOS app+dmg+pkg and Windows nsis+msi artifacts plus signing inputs", async () => {
  const root = repoRoot();
  const manifestPath = path.join(root, "dist", "release", "release-manifest.json");
  const tauriReleaseConfigPath = path.join(root, "apps", "sj-ui", "src-tauri", "tauri.release.conf.json");
  const nsisHooksPath = path.join(root, "apps", "sj-ui", "src-tauri", "windows", "hooks.nsh");
  const previousManifest = await fs.readFile(manifestPath, "utf8").catch(() => null);

  try {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "prepare-release-manifest.mjs")], {
      cwd: root,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
      artifacts: Array<{ artifactType: string; fileName: string }>;
      updateMetadata: { signingInputs: string[] };
    };

    const artifactTypes = manifest.artifacts.map((entry) => entry.artifactType);
    assert.equal(artifactTypes.includes("desktop-app"), true);
    assert.equal(artifactTypes.includes("desktop-dmg"), true);
    assert.equal(artifactTypes.includes("desktop-pkg"), true);
    assert.equal(artifactTypes.includes("desktop-nsis"), true);
    assert.equal(artifactTypes.includes("desktop-msi"), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".app.tar.gz")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".dmg")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".pkg")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith("-setup.exe")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".msi")), true);
    assert.equal(manifest.updateMetadata.signingInputs.includes("APPLE_API_KEY_PATH"), true);
    assert.equal(manifest.updateMetadata.signingInputs.includes("APPLE_INSTALLER_SIGNING_IDENTITY"), true);
    assert.equal(manifest.updateMetadata.signingInputs.includes("WINDOWS_CERTIFICATE_PFX_B64"), true);

    const tauriReleaseConfig = JSON.parse(await fs.readFile(tauriReleaseConfigPath, "utf8")) as {
      bundle?: { windows?: { nsis?: { installerHooks?: string | null } } };
    };
    assert.equal(tauriReleaseConfig.bundle?.windows?.nsis?.installerHooks, "./windows/hooks.nsh");
    const nsisHooks = await fs.readFile(nsisHooksPath, "utf8");
    assert.match(nsisHooks, /NSIS_HOOK_POSTINSTALL/);
    assert.match(nsisHooks, /NSIS_HOOK_PREUNINSTALL/);
    assert.match(nsisHooks, /resources\\desktop\\cli-bundle\\install\.ps1/);
    assert.doesNotMatch(nsisHooks, /MessageBox/);
  } finally {
    if (previousManifest == null) {
      await fs.rm(manifestPath, { force: true });
    } else {
      await fs.writeFile(manifestPath, previousManifest, "utf8");
    }
  }
});

test("release trust verifier reports missing macOS inputs without pretending trust passed", () => {
  const root = repoRoot();
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-release-trust.mjs"),
    "--platform",
    "macos",
    "--json"
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      APPLE_SIGNING_IDENTITY: "",
      APPLE_CERTIFICATE: "",
      APPLE_CERTIFICATE_PASSWORD: "",
      KEYCHAIN_PASSWORD: "",
      APPLE_API_ISSUER: "",
      APPLE_API_KEY: "",
      APPLE_API_KEY_PATH: "",
      APPLE_API_PRIVATE_KEY: "",
      APPLE_ID: "",
      APPLE_PASSWORD: "",
      APPLE_TEAM_ID: ""
    }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as {
    classification: string;
    inputs: { ready: boolean };
    updater: { enabled: boolean; ok: boolean };
    blockingReasons: string[];
  };
  assert.equal(payload.classification, "local-beta-build-only");
  assert.equal(payload.inputs.ready, false);
  assert.equal(payload.updater.enabled, false);
  assert.equal(payload.updater.ok, true);
  assert.equal(payload.blockingReasons.some((reason) => reason.includes("APPLE_SIGNING_IDENTITY")), true);
});

test("release trust verifier reports Windows host limitation on non-Windows machines", () => {
  const root = repoRoot();
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-release-trust.mjs"),
    "--platform",
    "windows",
    "--json"
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      WINDOWS_CERTIFICATE_PFX_B64: "",
      WINDOWS_CERTIFICATE_PASSWORD: "",
      WINDOWS_CERTIFICATE_THUMBPRINT: "",
      WINDOWS_TIMESTAMP_URL: ""
    }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as {
    classification: string;
    hostPlatform: string;
    inputs: { ready: boolean };
    blockingReasons: string[];
  };
  if (payload.hostPlatform !== "win32") {
    assert.equal(payload.classification, "windows-runner-required");
    assert.equal(payload.blockingReasons.some((reason) => reason.includes("Windows runner")), true);
  }
  assert.equal(payload.inputs.ready, false);
});

test("bundled CLI installer supports machine-scope macOS verification", () => {
  const root = repoRoot();
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-bundled-cli-install.mjs"),
    "--platform",
    "macos",
    "--scope",
    "machine"
  ], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  if (process.platform === "darwin") {
    assert.match(result.stdout, /verification passed for macOS/i);
    return;
  }
  assert.match(result.stdout, /requires a macOS host/i);
});

test("bundled CLI installer exposes machine-scope Windows scaffolding", async () => {
  const root = repoRoot();
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-bundled-cli-install.mjs"),
    "--platform",
    "windows",
    "--scope",
    "machine"
  ], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /verification passed for Windows/i);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-windows-cli-scaffold-"));
  try {
    const { stageCliBundle } = await import(pathToFileURL(path.join(root, "scripts", "stage-cli-bundle.mjs")).href) as {
      stageCliBundle: (options: { repoRoot: string; bundlePath: string; version: string }) => Promise<string>;
    };
    const bundlePath = path.join(tempDir, "cli-bundle");
    await stageCliBundle({ repoRoot: root, bundlePath, version: "0.2.0-test.0" });
    const installPs1 = await fs.readFile(path.join(bundlePath, "install.ps1"), "utf8");

    assert.doesNotMatch(installPs1, /\$VerificationScript = "\$machine/);
    assert.doesNotMatch(installPs1, /"\$env:Path = @\(\$machine, \$user\) -join/);
    assert.match(installPs1, /\$VerificationScript = '\$machine = \[Environment\]::GetEnvironmentVariable\(''Path'', ''Machine''\); '/);
    assert.match(installPs1, /'\$env:Path = @\(\$machine, \$user\) -join '';''; '/);
    assert.match(installPs1, /'\$commandPath = \$command\.Source; '/);
    assert.match(installPs1, /'& \$commandPath --help \| Out-Null; '/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("installed-app Windows verifier gives cmd.exe a fresh merged PATH", async () => {
  const root = repoRoot();
  const verifierSource = await fs.readFile(path.join(root, "scripts", "verify-installed-cli-enable-flow.mjs"), "utf8");

  assert.match(verifierSource, /function readWindowsMergedPath\(\)/);
  assert.match(verifierSource, /GetEnvironmentVariable\('Path', 'Machine'\)/);
  assert.match(verifierSource, /GetEnvironmentVariable\('Path', 'User'\)/);
  assert.match(verifierSource, /isWindowsPathEntryPresent\(windowsPath, expectedWindowsBinDir\)/);
  assert.match(verifierSource, /env: withWindowsPathEnv\(process\.env, windowsPath\)/);
  assert.doesNotMatch(
    verifierSource,
    /spawnSync\("cmd\.exe", \["\/d", "\/c", "kc --help"\], \{\s*cwd: repoRoot,\s*encoding: "utf8"\s*\}\)/s
  );
});

test("installed-app Windows verifier checks uninstall cleanup for the installed command only", async () => {
  const root = repoRoot();
  const verifierSource = await fs.readFile(path.join(root, "scripts", "verify-installed-cli-enable-flow.mjs"), "utf8");

  assert.match(verifierSource, /import \{ setTimeout as delay \} from "node:timers\/promises"/);
  assert.match(verifierSource, /waitForWindowsUninstallCleanup\(\{/);
  assert.match(verifierSource, /const deadline = Date\.now\(\) \+ 30_000/);
  assert.match(verifierSource, /wrapperExists: await fileExists\(commandPath\)/);
  assert.match(verifierSource, /pathContainsBinDir: isWindowsPathEntryPresent\(windowsPath, binDir\)/);
  assert.match(verifierSource, /if \(\$command\) \{ Write-Output \$command\.Source \}; exit 0/);
  assert.match(verifierSource, /Windows uninstall cleanup did not complete within 30 seconds/);
  assert.doesNotMatch(
    verifierSource,
    /if \(Get-Command kc -ErrorAction SilentlyContinue\) \{ exit 1 \}/
  );
});

test("Cloudflare download publisher emits stable latest and versioned URLs", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-cloudflare-publish-"));
  const publishRoot = path.join(tempDir, "publish");
  await fs.mkdir(publishRoot, { recursive: true });

  const manifest = {
    version: "0.2.0-beta.1",
    channel: "beta",
    artifacts: [
      { artifactType: "desktop-pkg", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.pkg" },
      { artifactType: "desktop-dmg", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg" },
      { artifactType: "desktop-app", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz" },
      { artifactType: "desktop-nsis", platform: "windows", fileName: "kiwi-control-0.2.0-beta.1-windows-x64-setup.exe" },
      { artifactType: "desktop-msi", platform: "windows", fileName: "kiwi-control-0.2.0-beta.1-windows-x64.msi" },
      { artifactType: "cli", platform: "macos", fileName: "kiwi-control-cli-0.2.0-beta.1-macos-aarch64.tar.gz" },
      { artifactType: "cli", platform: "windows", fileName: "kiwi-control-cli-0.2.0-beta.1-windows-x64.zip" }
    ]
  };
  await fs.writeFile(path.join(publishRoot, "release-manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(publishRoot, "SHA256SUMS.txt"), "hash  kiwi-control-0.2.0-beta.1-macos-aarch64.dmg\n");
  for (const fileName of manifest.artifacts.map((entry) => entry.fileName)) {
    await fs.writeFile(path.join(publishRoot, fileName), fileName);
  }

  const macosTrustPath = path.join(tempDir, "macos-trust.json");
  const windowsTrustPath = path.join(tempDir, "windows-trust.json");
  await fs.writeFile(macosTrustPath, JSON.stringify({ classification: "signed-and-notarized" }));
  await fs.writeFile(windowsTrustPath, JSON.stringify({ classification: "signed-installers" }));

  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "publish-cloudflare-downloads.mjs"),
    "--publish-root",
    publishRoot,
    "--downloads-url",
    "https://downloads.example.com",
    "--repo-url",
    "https://github.com/example/kiwi-control",
    "--macos-trust-json",
    macosTrustPath,
    "--windows-trust-json",
    windowsTrustPath,
    "--dry-run"
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as {
    uploads: Array<{ publicUrl: string }>;
  };
  assert.equal(payload.uploads.some((entry) => entry.publicUrl === "https://downloads.example.com/latest/macos/kiwi-control.dmg"), true);
  assert.equal(payload.uploads.some((entry) => entry.publicUrl === "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-windows-x64.msi"), true);

  const downloads = JSON.parse(await fs.readFile(path.join(publishRoot, "downloads.json"), "utf8")) as {
    publicReleaseReady: boolean;
    checksumsUrl: string;
    manifestUrl: string;
    trust: { macos: string; windows: string };
    artifacts: {
      macosPkg: { latestUrl: string; versionedUrl: string };
      macosDmg: { latestUrl: string; versionedUrl: string };
      windowsNsis: { latestUrl: string };
      cliWindows: { latestUrl: string };
    };
  };
  assert.equal(downloads.publicReleaseReady, true);
  assert.equal(downloads.checksumsUrl, "https://downloads.example.com/latest/SHA256SUMS.txt");
  assert.equal(downloads.manifestUrl, "https://downloads.example.com/latest/release-manifest.json");
  assert.equal(downloads.trust.macos, "signed-and-notarized");
  assert.equal(downloads.trust.windows, "signed-installers");
  assert.equal(downloads.artifacts.macosPkg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.pkg");
  assert.equal(downloads.artifacts.macosPkg.versionedUrl, "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.pkg");
  assert.equal(downloads.artifacts.macosDmg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.dmg");
  assert.equal(downloads.artifacts.macosDmg.versionedUrl, "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.dmg");
  assert.equal(downloads.artifacts.windowsNsis.latestUrl, "https://downloads.example.com/latest/windows/kiwi-control-setup.exe");
  assert.equal(downloads.artifacts.cliWindows.latestUrl, "https://downloads.example.com/latest/windows/kiwi-control-cli.zip");
});

test("Cloudflare download publisher supports metadata-only mode for site deploys", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-cloudflare-metadata-only-"));
  const publishRoot = path.join(tempDir, "release");
  await fs.mkdir(publishRoot, { recursive: true });

  const manifest = {
    version: "0.2.0-beta.1",
    channel: "beta",
    artifacts: [
      { artifactType: "desktop-pkg", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.pkg" },
      { artifactType: "desktop-dmg", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg" },
      { artifactType: "desktop-app", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz" },
      { artifactType: "desktop-nsis", platform: "windows", fileName: "kiwi-control-0.2.0-beta.1-windows-x64-setup.exe" },
      { artifactType: "desktop-msi", platform: "windows", fileName: "kiwi-control-0.2.0-beta.1-windows-x64.msi" }
    ]
  };
  await fs.writeFile(path.join(publishRoot, "release-manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(publishRoot, "SHA256SUMS.txt"), "hash  dist/release/SHA256SUMS.txt\n");

  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "publish-cloudflare-downloads.mjs"),
    "--publish-root",
    publishRoot,
    "--downloads-url",
    "https://downloads.example.com",
    "--repo-url",
    "https://github.com/example/kiwi-control",
    "--metadata-only",
    "--dry-run"
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as {
    metadataOnly: boolean;
    uploads: Array<{ publicUrl: string }>;
  };
  assert.equal(payload.metadataOnly, true);
  assert.equal(payload.uploads.some((entry) => entry.publicUrl === "https://downloads.example.com/latest/downloads.json"), true);
  assert.equal(payload.uploads.some((entry) => entry.publicUrl === "https://downloads.example.com/latest/release-manifest.json"), true);
  assert.equal(payload.uploads.some((entry) => entry.publicUrl === "https://downloads.example.com/latest/SHA256SUMS.txt"), true);

  const downloads = JSON.parse(await fs.readFile(path.join(publishRoot, "downloads.json"), "utf8")) as {
    publicReleaseReady: boolean;
    artifacts: {
      macosPkg: { latestUrl: string };
      macosDmg: { latestUrl: string };
      windowsNsis: { latestUrl: string };
    };
  };
  assert.equal(downloads.publicReleaseReady, true);
  assert.equal(downloads.artifacts.macosPkg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.pkg");
  assert.equal(downloads.artifacts.macosDmg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.dmg");
  assert.equal(downloads.artifacts.windowsNsis.latestUrl, "https://downloads.example.com/latest/windows/kiwi-control-setup.exe");
});

test("Cloudflare download publisher keeps readiness false until the full desktop set exists", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-cloudflare-partial-"));
  const publishRoot = path.join(tempDir, "publish");
  await fs.mkdir(publishRoot, { recursive: true });

  const manifest = {
    version: "0.2.0-beta.1",
    channel: "beta",
    artifacts: [
      { artifactType: "desktop-pkg", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.pkg" },
      { artifactType: "desktop-dmg", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg" },
      { artifactType: "desktop-app", platform: "macos", fileName: "kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz" }
    ]
  };
  await fs.writeFile(path.join(publishRoot, "release-manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(publishRoot, "SHA256SUMS.txt"), "hash  kiwi-control-0.2.0-beta.1-macos-aarch64.dmg\n");
  await fs.writeFile(path.join(publishRoot, "kiwi-control-0.2.0-beta.1-macos-aarch64.pkg"), "pkg");
  await fs.writeFile(path.join(publishRoot, "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg"), "dmg");
  await fs.writeFile(path.join(publishRoot, "kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz"), "app");

  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "publish-cloudflare-downloads.mjs"),
    "--publish-root",
    publishRoot,
    "--downloads-url",
    "https://downloads.example.com",
    "--dry-run"
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const downloads = JSON.parse(await fs.readFile(path.join(publishRoot, "downloads.json"), "utf8")) as {
    publicReleaseReady: boolean;
    artifacts: {
      macosPkg: { latestUrl: string | null };
      macosDmg: { latestUrl: string };
      windowsNsis: { latestUrl: string | null };
      windowsMsi: { latestUrl: string | null };
    };
  };

  assert.equal(downloads.publicReleaseReady, false);
  assert.equal(downloads.artifacts.macosPkg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.pkg");
  assert.equal(downloads.artifacts.macosDmg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.dmg");
  assert.equal(downloads.artifacts.windowsNsis.latestUrl, null);
  assert.equal(downloads.artifacts.windowsMsi.latestUrl, null);
});

test("GitHub release metadata generator publishes only truthfully available assets", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-github-release-metadata-"));
  const publishRoot = path.join(tempDir, "publish");
  await fs.mkdir(publishRoot, { recursive: true });

  const manifest = {
    version: "0.2.0-beta.2",
    channel: "beta",
    artifacts: [
      { artifactType: "desktop-pkg", platform: "macos", arch: "aarch64", fileName: "kiwi-control-0.2.0-beta.2-macos-aarch64.pkg" },
      { artifactType: "desktop-dmg", platform: "macos", arch: "aarch64", fileName: "kiwi-control-0.2.0-beta.2-macos-aarch64.dmg" },
      { artifactType: "desktop-app", platform: "macos", arch: "aarch64", fileName: "kiwi-control-0.2.0-beta.2-macos-aarch64.app.tar.gz" },
      { artifactType: "desktop-nsis", platform: "windows", arch: "x64", fileName: "kiwi-control-0.2.0-beta.2-windows-x64-setup.exe" },
      { artifactType: "desktop-msi", platform: "windows", arch: "x64", fileName: "kiwi-control-0.2.0-beta.2-windows-x64.msi" },
      { artifactType: "cli", platform: "macos", arch: "aarch64", fileName: "kiwi-control-cli-0.2.0-beta.2-macos-aarch64.tar.gz" }
    ]
  };
  await fs.writeFile(path.join(publishRoot, "release-manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(publishRoot, "SHA256SUMS.txt"), "hash  kiwi-control-0.2.0-beta.2-macos-aarch64.dmg\n");

  const releaseJsonPath = path.join(tempDir, "release.json");
  await fs.writeFile(
    releaseJsonPath,
    JSON.stringify({
      assets: [
        {
          name: "kiwi-control-0.2.0-beta.2-macos-aarch64.dmg",
          browser_download_url: "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/kiwi-control-0.2.0-beta.2-macos-aarch64.dmg"
        },
        {
          name: "kiwi-control-0.2.0-beta.2-macos-aarch64.app.tar.gz",
          browser_download_url: "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/kiwi-control-0.2.0-beta.2-macos-aarch64.app.tar.gz"
        },
        {
          name: "kiwi-control-cli-0.2.0-beta.2-macos-aarch64.tar.gz",
          browser_download_url: "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/kiwi-control-cli-0.2.0-beta.2-macos-aarch64.tar.gz"
        },
        {
          name: "SHA256SUMS.txt",
          browser_download_url: "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/SHA256SUMS.txt"
        },
        {
          name: "release-manifest.json",
          browser_download_url: "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/release-manifest.json"
        }
      ]
    }, null, 2)
  );

  const macosTrustPath = path.join(tempDir, "macos-trust.json");
  const windowsTrustPath = path.join(tempDir, "windows-trust.json");
  await fs.writeFile(macosTrustPath, JSON.stringify({ classification: "local-beta-build-only" }));
  await fs.writeFile(windowsTrustPath, JSON.stringify({ classification: "windows-runner-required" }));

  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "generate-github-release-downloads.mjs"),
    "--publish-root",
    publishRoot,
    "--repo",
    "example/kiwi-control-backup",
    "--repo-url",
    "https://github.com/example/kiwi-control-backup",
    "--release-tag",
    "v0.2.0-beta.2",
    "--release-json",
    releaseJsonPath,
    "--macos-trust-json",
    macosTrustPath,
    "--windows-trust-json",
    windowsTrustPath
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(await fs.readFile(path.join(publishRoot, "downloads.json"), "utf8")) as {
    publicReleaseReady: boolean;
    releaseNotesUrl: string;
    checksumsUrl: string;
    manifestUrl: string;
    trust: { macos: string; windows: string };
    artifacts: {
      macosDmg: { latestUrl: string; versionedUrl: string };
      windowsNsis: { latestUrl: string | null };
      windowsMsi: { latestUrl: string | null };
    };
  };

  assert.equal(payload.publicReleaseReady, true);
  assert.equal(payload.releaseNotesUrl, "https://github.com/example/kiwi-control-backup/releases/tag/v0.2.0-beta.2");
  assert.equal(payload.checksumsUrl, "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/SHA256SUMS.txt");
  assert.equal(payload.manifestUrl, "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/release-manifest.json");
  assert.equal(payload.trust.macos, "local-beta-build-only");
  assert.equal(payload.trust.windows, "windows-runner-required");
  assert.equal(payload.artifacts.macosDmg.latestUrl, "https://github.com/example/kiwi-control-backup/releases/download/v0.2.0-beta.2/kiwi-control-0.2.0-beta.2-macos-aarch64.dmg");
  assert.equal(payload.artifacts.macosDmg.versionedUrl, payload.artifacts.macosDmg.latestUrl);
  assert.equal(payload.artifacts.windowsNsis.latestUrl, null);
  assert.equal(payload.artifacts.windowsMsi.latestUrl, null);
});

test("Pages staging writes same-origin release metadata and strips AppleDouble sidecars", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pages-stage-"));
  const tempSite = path.join(tempDir, "website");
  const outputDir = path.join(tempDir, "dist-site");
  await fs.cp(path.join(root, "website"), tempSite, { recursive: true });
  await fs.writeFile(path.join(tempSite, "._index.html"), "sidecar");

  const downloadsJsonPath = path.join(tempDir, "downloads.json");
  await fs.writeFile(
    downloadsJsonPath,
    JSON.stringify({
      tagName: "v0.2.0-beta.1",
      version: "0.2.0-beta.1",
      channel: "beta",
      publicReleaseReady: true,
      releaseNotesUrl: "https://github.com/example/kiwi-control/releases/tag/v0.2.0-beta.1",
      sourceUrl: "https://github.com/example/kiwi-control/releases/tag/v0.2.0-beta.1",
      checksumsUrl: "https://downloads.example.com/latest/SHA256SUMS.txt",
      manifestUrl: "https://downloads.example.com/latest/release-manifest.json",
      trust: {
        macos: "local-beta-build-only",
        windows: "windows-runner-required"
      },
      artifacts: {
        macosPkg: {
          filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.pkg",
          latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.pkg",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.pkg"
        },
        macosDmg: {
          filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg",
          latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.dmg",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.dmg"
        },
        macosAppTarball: {
          filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz",
          latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.app.tar.gz",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz"
        },
        windowsNsis: {
          filename: "kiwi-control-0.2.0-beta.1-windows-x64-setup.exe",
          latestUrl: "https://downloads.example.com/latest/windows/kiwi-control-setup.exe",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-windows-x64-setup.exe"
        },
        windowsMsi: {
          filename: "kiwi-control-0.2.0-beta.1-windows-x64.msi",
          latestUrl: "https://downloads.example.com/latest/windows/kiwi-control.msi",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-windows-x64.msi"
        }
      }
    }, null, 2)
  );

  const stageResult = spawnSync(process.execPath, [
    path.join(root, "scripts", "stage-pages-site.mjs"),
    "--site-root",
    tempSite,
    "--output-dir",
    outputDir,
    "--downloads-json",
    downloadsJsonPath
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(stageResult.status, 0, stageResult.stderr || stageResult.stdout);
  const verifyResult = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-public-download-surface.mjs"),
    "--site-dir",
    outputDir
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(verifyResult.status, 0, verifyResult.stderr || verifyResult.stdout);
  const metadata = JSON.parse(await fs.readFile(path.join(outputDir, "data", "latest-release.json"), "utf8"));
  const expectedMetadata = JSON.parse(await fs.readFile(downloadsJsonPath, "utf8"));
  assert.deepEqual(metadata, expectedMetadata);
  const downloadsHtml = await fs.readFile(path.join(outputDir, "downloads", "index.html"), "utf8");
  assert.match(downloadsHtml, /https:\/\/downloads\.example\.com\/latest\/macos\/kiwi-control\.dmg/);
  assert.match(downloadsHtml, /https:\/\/downloads\.example\.com\/latest\/windows\/kiwi-control-setup\.exe/);
  assert.match(downloadsHtml, />Download macOS DMG</);
  await fs.access(path.join(outputDir, "downloads", "index.html"));
  await assert.rejects(fs.access(path.join(outputDir, "._index.html")));
});

test("Pages staging rejects fallback metadata when downloads metadata is required", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pages-stage-required-"));
  const outputDir = path.join(tempDir, "dist-site");

  const stageResult = spawnSync(process.execPath, [
    path.join(root, "scripts", "stage-pages-site.mjs"),
    "--output-dir",
    outputDir,
    "--require-downloads-json"
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      SITE_URL: "http://127.0.0.1:1",
      DOWNLOADS_URL: ""
    }
  });

  assert.notEqual(stageResult.status, 0);
  assert.match(stageResult.stderr || stageResult.stdout, /required Cloudflare downloads metadata|require-downloads-json|Missing required/i);
});

test("public download verifier fails when a not-ready site is treated as release-ready", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pages-verify-required-"));
  const outputDir = path.join(tempDir, "dist-site");
  const downloadsJsonPath = path.join(tempDir, "downloads.json");
  await fs.writeFile(
    downloadsJsonPath,
    JSON.stringify({
      tagName: "v0.2.0-beta.test",
      version: "0.2.0-beta.test",
      channel: "beta",
      publicReleaseReady: false,
      releaseNotesUrl: null,
      sourceUrl: null,
      checksumsUrl: null,
      manifestUrl: null,
      trust: {
        macos: "local-beta-build-only",
        windows: "windows-runner-required"
      },
      artifacts: {
        macosPkg: { filename: "kiwi-control.pkg", latestUrl: null, versionedUrl: null },
        macosAppTarball: { filename: "kiwi-control.app.tar.gz", latestUrl: null, versionedUrl: null },
        windowsNsis: { filename: "kiwi-control-setup.exe", latestUrl: null, versionedUrl: null },
        windowsMsi: { filename: "kiwi-control.msi", latestUrl: null, versionedUrl: null },
        cliWindows: { filename: "kiwi-control-cli.zip", latestUrl: null, versionedUrl: null }
      }
    }, null, 2),
    "utf8"
  );

  const stageResult = spawnSync(process.execPath, [
    path.join(root, "scripts", "stage-pages-site.mjs"),
    "--output-dir",
    outputDir,
    "--downloads-json",
    downloadsJsonPath
  ], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(stageResult.status, 0, stageResult.stderr || stageResult.stdout);

  const verifyResult = spawnSync(process.execPath, [
    path.join(root, "scripts", "verify-public-download-surface.mjs"),
    "--site-dir",
    outputDir,
    "--require-ready"
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.notEqual(verifyResult.status, 0);
});

test("Pages staging falls back to SITE_URL when DOWNLOADS_URL is unset", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-pages-stage-site-url-"));
  const outputDir = path.join(tempDir, "dist-site");
  const downloadsPayload = {
    tagName: "v0.2.0-beta.1",
    version: "0.2.0-beta.1",
    channel: "beta",
    publicReleaseReady: false,
    releaseNotesUrl: null,
    sourceUrl: null,
    checksumsUrl: "https://downloads.example.com/latest/SHA256SUMS.txt",
    manifestUrl: "https://downloads.example.com/latest/release-manifest.json",
    trust: {
      macos: "local-beta-build-only",
      windows: "windows-runner-required"
    },
    artifacts: {
      macosPkg: {
        filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.pkg",
        latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.pkg",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.pkg"
      },
      macosDmg: {
        filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg",
        latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.dmg",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.dmg"
      },
      macosAppTarball: {
        filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz",
        latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.app.tar.gz",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.app.tar.gz"
      },
      windowsNsis: {
        filename: "kiwi-control-setup.exe",
        latestUrl: null,
        versionedUrl: null
      },
      windowsMsi: {
        filename: "kiwi-control.msi",
        latestUrl: null,
        versionedUrl: null
      },
      cliMacos: {
        filename: "kiwi-control-cli-0.2.0-beta.1-macos-aarch64.tar.gz",
        latestUrl: "https://downloads.example.com/latest/macos/kiwi-control-cli.tar.gz",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-cli-0.2.0-beta.1-macos-aarch64.tar.gz"
      },
      cliWindows: {
        filename: "kiwi-control-cli.zip",
        latestUrl: null,
        versionedUrl: null
      }
    }
  };

  const { child, siteUrl } = await startDownloadsMetadataServer(root, downloadsPayload);

  try {
    const stageResult = spawnSync(process.execPath, [
      path.join(root, "scripts", "stage-pages-site.mjs"),
      "--output-dir",
      outputDir
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        SITE_URL: siteUrl,
        DOWNLOADS_URL: ""
      }
    });

    assert.equal(stageResult.status, 0, stageResult.stderr || stageResult.stdout);
    const payload = JSON.parse(stageResult.stdout) as {
      downloadsSource: string;
      checksumsUrl: string | null;
    };
    assert.equal(payload.downloadsSource, "remote-json");
    assert.equal(payload.checksumsUrl, downloadsPayload.checksumsUrl);

    const metadata = JSON.parse(await fs.readFile(path.join(outputDir, "data", "latest-release.json"), "utf8"));
    assert.deepEqual(metadata, downloadsPayload);
  } finally {
    await stopChildProcess(child);
  }
});

test("release asset packager only emits the CLI bundle for the current runner platform", async () => {
  const root = repoRoot();
  const releaseDir = path.join(root, "dist", "release");
  const manifestPath = path.join(releaseDir, "release-manifest.json");
  const assetsDir = path.join(releaseDir, "assets");
  const cliBundleDir = path.join(releaseDir, "cli-bundle");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-package-assets-"));
  const manifestBackupPath = path.join(tempDir, "release-manifest.json");
  const assetsBackupPath = path.join(tempDir, "assets");
  const cliBundleBackupPath = path.join(tempDir, "cli-bundle");
  const previousManifest = await fs.readFile(manifestPath, "utf8");
  const hadAssetsDir = await fs.stat(assetsDir).then(() => true).catch(() => false);
  const hadCliBundleDir = await fs.stat(cliBundleDir).then(() => true).catch(() => false);

  if (hadAssetsDir) {
    await fs.cp(assetsDir, assetsBackupPath, { recursive: true });
  }
  if (hadCliBundleDir) {
    await fs.cp(cliBundleDir, cliBundleBackupPath, { recursive: true });
  }
  await fs.writeFile(manifestBackupPath, previousManifest, "utf8");

  try {
    await fs.rm(assetsDir, { recursive: true, force: true });
    await fs.rm(cliBundleDir, { recursive: true, force: true });
    await fs.mkdir(cliBundleDir, { recursive: true });
    await fs.writeFile(path.join(cliBundleDir, "README.md"), "cli bundle", "utf8");
    await fs.writeFile(path.join(cliBundleDir, "install.sh"), "#!/usr/bin/env bash\necho install\n", "utf8");
    await fs.writeFile(path.join(cliBundleDir, "install.ps1"), "Write-Host install\n", "utf8");

    const manifest = {
      version: "0.2.0-beta.1",
      channel: "beta",
      artifacts: [
        { artifactType: "cli", platform: "macos", arch: "aarch64", fileName: "kiwi-control-cli-0.2.0-beta.1-macos-aarch64.tar.gz" },
        { artifactType: "cli", platform: "linux", arch: "x64", fileName: "kiwi-control-cli-0.2.0-beta.1-linux-x64.tar.gz" },
        { artifactType: "cli", platform: "windows", arch: "x64", fileName: "kiwi-control-cli-0.2.0-beta.1-windows-x64.zip" },
        { artifactType: "runtime", sourcePath: "packages/sj-core/dist/runtime", fileName: "kiwi-control-runtime-0.2.0-beta.1-${os}-${arch}.tar.gz" },
        { artifactType: "ui-web", sourcePath: "apps/sj-ui/dist", fileName: "kiwi-control-ui-web-0.2.0-beta.1-${os}-${arch}.tar.gz" }
      ]
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const result = spawnSync(process.execPath, [path.join(root, "scripts", "package-release-assets.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        RUNNER_OS: "Linux",
        RUNNER_ARCH: "X64"
      }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout) as { createdAssets: string[] };
    assert.equal(payload.createdAssets.includes("kiwi-control-cli-0.2.0-beta.1-linux-x64.tar.gz"), true);
    assert.equal(payload.createdAssets.includes("kiwi-control-cli-0.2.0-beta.1-macos-aarch64.tar.gz"), false);
    assert.equal(payload.createdAssets.includes("kiwi-control-cli-0.2.0-beta.1-windows-x64.zip"), false);
    await fs.access(path.join(assetsDir, "kiwi-control-cli-0.2.0-beta.1-linux-x64.tar.gz"));
  } finally {
    await fs.rm(assetsDir, { recursive: true, force: true });
    if (hadAssetsDir) {
      await fs.cp(assetsBackupPath, assetsDir, { recursive: true });
    }

    await fs.rm(cliBundleDir, { recursive: true, force: true });
    if (hadCliBundleDir) {
      await fs.cp(cliBundleBackupPath, cliBundleDir, { recursive: true });
    }

    await fs.writeFile(manifestPath, await fs.readFile(manifestBackupPath, "utf8"), "utf8");
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("public wrapper installers are CLI-first and metadata-driven", async () => {
  const root = repoRoot();
  const installSh = await fs.readFile(path.join(root, "website", "install.sh"), "utf8");
  const installPs1 = await fs.readFile(path.join(root, "website", "install.ps1"), "utf8");

  assert.match(installSh, /latest-release\.json/);
  assert.match(installSh, /cliMacosAarch64/);
  assert.match(installSh, /cliMacosX64/);
  assert.match(installSh, /cliLinux/);
  assert.match(installSh, /runtimeMacosAarch64/);
  assert.match(installSh, /runtimeMacosX64/);
  assert.match(installSh, /runtimeLinux/);
  assert.match(installSh, /kiwi-control-runtime\.tar\.gz/);
  assert.match(installSh, /\$KC_PATH" --help/);
  assert.match(installSh, /Kiwi Control Desktop is not published for Linux/);
  assert.match(installSh, /CLI install remains complete/);

  assert.match(installPs1, /latest-release\.json/);
  assert.match(installPs1, /cliWindows\.latestUrl/);
  assert.match(installPs1, /runtimeWindows\.latestUrl/);
  assert.match(installPs1, /Expand-Archive/);
  assert.match(installPs1, /tar -xzf/);
  assert.match(installPs1, /Get-Command kc/);
  assert.match(installPs1, /--help/);
  assert.match(installPs1, /Windows desktop installer is not published yet/);
});

test("public install wrapper hydrates the matching runtime bundle before kc init", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX installer regression runs on macOS/Linux hosts only.");
    return;
  }

  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-public-install-runtime-"));
  const bundlePath = path.join(tempDir, "cli-bundle");
  const publishRoot = path.join(tempDir, "publish");
  const homeDir = path.join(tempDir, "home");
  const binDir = path.join(tempDir, "bin");
  const repoDir = path.join(tempDir, "repo");
  await fs.mkdir(publishRoot, { recursive: true });
  await fs.mkdir(homeDir, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  await fs.mkdir(repoDir, { recursive: true });

  try {
    const { stageCliBundle } = await import(pathToFileURL(path.join(root, "scripts", "stage-cli-bundle.mjs")).href) as {
      stageCliBundle: (options: { repoRoot: string; bundlePath: string; version: string }) => Promise<string>;
    };
    await stageCliBundle({ repoRoot: root, bundlePath, version: "0.2.0-test.0" });

    const stagedRuntimeDir = path.join(bundlePath, "node_modules", "@shrey-junior", "sj-core", "dist", "runtime");
    await fs.rm(path.join(stagedRuntimeDir, "bin", "kiwi-control-runtime"), { force: true });
    await fs.writeFile(path.join(stagedRuntimeDir, "bin", "kiwi-control-runtime.exe"), "wrong-host-runtime", "utf8");

    const cliArchivePath = path.join(publishRoot, "kiwi-control-cli.tar.gz");
    const runtimeArchivePath = path.join(publishRoot, "kiwi-control-runtime.tar.gz");
    assert.equal(spawnSync("tar", ["-czf", cliArchivePath, "-C", bundlePath, "."], { cwd: root }).status, 0);
    assert.equal(
      spawnSync(
        "tar",
        ["-czf", runtimeArchivePath, "-C", path.join(root, "packages", "sj-core", "dist", "runtime"), "."],
        { cwd: root }
      ).status,
      0
    );

    const platform = process.platform === "darwin" ? "macos" : "linux";
    const arch = process.arch === "arm64" ? "aarch64" : "x64";
    const metadata = {
      version: "0.2.0-test.0",
      artifacts: platform === "macos"
        ? {
            cliMacosAarch64: arch === "aarch64"
              ? {
                  filename: "kiwi-control-cli-0.2.0-test.0-macos-aarch64.tar.gz",
                  latestUrl: "__SITE__/latest/macos/aarch64/kiwi-control-cli.tar.gz",
                  versionedUrl: "__SITE__/releases/v0.2.0-test.0/kiwi-control-cli-0.2.0-test.0-macos-aarch64.tar.gz"
                }
              : null,
            cliMacosX64: arch === "x64"
              ? {
                  filename: "kiwi-control-cli-0.2.0-test.0-macos-x64.tar.gz",
                  latestUrl: "__SITE__/latest/macos/x64/kiwi-control-cli.tar.gz",
                  versionedUrl: "__SITE__/releases/v0.2.0-test.0/kiwi-control-cli-0.2.0-test.0-macos-x64.tar.gz"
                }
              : null,
            runtimeMacosAarch64: arch === "aarch64"
              ? {
                  filename: "kiwi-control-runtime-0.2.0-test.0-macos-aarch64.tar.gz",
                  latestUrl: "__SITE__/latest/macos/aarch64/kiwi-control-runtime.tar.gz",
                  versionedUrl: "__SITE__/releases/v0.2.0-test.0/kiwi-control-runtime-0.2.0-test.0-macos-aarch64.tar.gz"
                }
              : null,
            runtimeMacosX64: arch === "x64"
              ? {
                  filename: "kiwi-control-runtime-0.2.0-test.0-macos-x64.tar.gz",
                  latestUrl: "__SITE__/latest/macos/x64/kiwi-control-runtime.tar.gz",
                  versionedUrl: "__SITE__/releases/v0.2.0-test.0/kiwi-control-runtime-0.2.0-test.0-macos-x64.tar.gz"
                }
              : null
          }
        : {
            cliLinux: {
              filename: "kiwi-control-cli-0.2.0-test.0-linux-x64.tar.gz",
              latestUrl: "__SITE__/latest/linux/kiwi-control-cli.tar.gz",
              versionedUrl: "__SITE__/releases/v0.2.0-test.0/kiwi-control-cli-0.2.0-test.0-linux-x64.tar.gz"
            },
            runtimeLinux: {
              filename: "kiwi-control-runtime-0.2.0-test.0-linux-x64.tar.gz",
              latestUrl: "__SITE__/latest/linux/kiwi-control-runtime.tar.gz",
              versionedUrl: "__SITE__/releases/v0.2.0-test.0/kiwi-control-runtime-0.2.0-test.0-linux-x64.tar.gz"
            }
          }
    };

    const latestDir = platform === "macos"
      ? path.join(publishRoot, "latest", "macos", arch)
      : path.join(publishRoot, "latest", "linux");
    await fs.mkdir(latestDir, { recursive: true });
    await fs.copyFile(cliArchivePath, path.join(latestDir, "kiwi-control-cli.tar.gz"));
    await fs.copyFile(runtimeArchivePath, path.join(latestDir, "kiwi-control-runtime.tar.gz"));

    const { child, siteUrl } = await startStaticReleaseServer(publishRoot, metadata);
    try {
      const install = spawnSync("/bin/bash", [path.join(root, "website", "install.sh")], {
        cwd: repoDir,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homeDir,
          KIWI_CONTROL_HOME: path.join(homeDir, ".kiwi-control"),
          KIWI_CONTROL_PATH_BIN: binDir,
          KIWI_CONTROL_DOWNLOAD_BASE_URL: siteUrl
        }
      });

      assert.equal(install.status, 0, install.stderr || install.stdout);

      const init = spawnSync(path.join(binDir, "kc"), ["init"], {
        cwd: repoDir,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homeDir,
          KIWI_CONTROL_HOME: path.join(homeDir, ".kiwi-control"),
          KIWI_CONTROL_PATH_BIN: binDir
        }
      });

      assert.equal(init.status, 0, init.stderr || init.stdout);
      assert.match(init.stdout, /created: \.agent\/project\.yaml/);
    } finally {
      await stopChildProcess(child);
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("Homebrew generator emits scaffold-only formula and cask from published metadata", async () => {
  const root = repoRoot();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-homebrew-"));
  const publishRoot = path.join(tempDir, "publish");
  const outputDir = path.join(tempDir, "homebrew");
  await fs.mkdir(publishRoot, { recursive: true });

  const downloadsPayload = {
    version: "0.2.0-beta.9",
    artifacts: {
      cliMacosAarch64: {
        filename: "kiwi-control-cli-0.2.0-beta.9-macos-aarch64.tar.gz",
        latestUrl: "https://downloads.example.com/latest/macos/aarch64/kiwi-control-cli.tar.gz",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.9/kiwi-control-cli-0.2.0-beta.9-macos-aarch64.tar.gz"
      },
      cliLinux: {
        filename: "kiwi-control-cli-0.2.0-beta.9-linux-x64.tar.gz",
        latestUrl: "https://downloads.example.com/latest/linux/kiwi-control-cli.tar.gz",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.9/kiwi-control-cli-0.2.0-beta.9-linux-x64.tar.gz"
      },
      macosPkg: {
        filename: "kiwi-control-0.2.0-beta.9-macos-aarch64.pkg",
        latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.pkg",
        versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.9/kiwi-control-0.2.0-beta.9-macos-aarch64.pkg"
      },
      windowsNsis: {
        filename: "kiwi-control-setup.exe",
        latestUrl: null,
        versionedUrl: null
      },
      windowsMsi: {
        filename: "kiwi-control.msi",
        latestUrl: null,
        versionedUrl: null
      }
    }
  };
  const downloadsJsonPath = path.join(publishRoot, "downloads.json");
  await fs.writeFile(downloadsJsonPath, JSON.stringify(downloadsPayload, null, 2), "utf8");
  for (const artifact of Object.values(downloadsPayload.artifacts)) {
    if (artifact.latestUrl) {
      await fs.writeFile(path.join(publishRoot, artifact.filename), `fixture:${artifact.filename}`, "utf8");
    }
  }

  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "generate-homebrew-tap.mjs"),
    "--downloads-json",
    downloadsJsonPath,
    "--output-dir",
    outputDir
  ], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as { scaffoldOnly: boolean; formula: string; cask: string | null };
  assert.equal(payload.scaffoldOnly, true);
  assert.equal(payload.cask?.endsWith("Casks/kiwi-control.rb"), true);

  const formula = await fs.readFile(path.join(outputDir, "Formula", "kiwi-control.rb"), "utf8");
  const cask = await fs.readFile(path.join(outputDir, "Casks", "kiwi-control.rb"), "utf8");
  const readme = await fs.readFile(path.join(outputDir, "README.md"), "utf8");

  assert.match(formula, /on_macos/);
  assert.match(formula, /on_arm/);
  assert.match(formula, /on_linux/);
  assert.match(formula, /system "#\{bin\}\/kc", "--help"/);
  assert.match(cask, /cask "kiwi-control"/);
  assert.match(cask, /pkg "kiwi-control-0\.2\.0-beta\.9-macos-aarch64\.pkg"/);
  assert.match(readme, /scaffold-only/);
  assert.match(readme, /no tap repository is published/);

  const rubyAvailable = spawnSync("ruby", ["-v"], { encoding: "utf8" }).status === 0;
  if (rubyAvailable) {
    assert.equal(spawnSync("ruby", ["-c", path.join(outputDir, "Formula", "kiwi-control.rb")], { encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("ruby", ["-c", path.join(outputDir, "Casks", "kiwi-control.rb")], { encoding: "utf8" }).status, 0);
  }
});

async function startDownloadsMetadataServer(root: string, downloadsPayload: object) {
  const server = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import http from "node:http";
const payload = JSON.parse(process.env.DOWNLOADS_PAYLOAD ?? "{}");
const server = http.createServer((request, response) => {
  if (request.url === "/latest/downloads.json") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload));
    return;
  }
  response.statusCode = 404;
  response.end("not found");
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    console.error("invalid-address");
    process.exit(1);
    return;
  }
  console.log(address.port);
});`
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        DOWNLOADS_PAYLOAD: JSON.stringify(downloadsPayload)
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const port = await new Promise<number>((resolve, reject) => {
    let stderr = "";
    let settled = false;

    server.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    server.stdout?.on("data", (chunk) => {
      if (settled) {
        return;
      }
      const value = Number(chunk.toString().trim().split(/\r?\n/)[0]);
      if (!Number.isFinite(value)) {
        return;
      }
      settled = true;
      resolve(value);
    });

    server.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });

    server.on("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(stderr || `downloads metadata server exited with code ${code ?? "unknown"}`));
    });
  });

  return {
    child: server,
    siteUrl: `http://127.0.0.1:${port}`
  };
}

async function startStaticReleaseServer(root: string, releaseMetadata: object) {
  const server = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";

const root = process.env.STATIC_ROOT;
const payload = JSON.parse(process.env.RELEASE_METADATA ?? "{}");

function replaceSiteUrl(value, siteUrl) {
  if (Array.isArray(value)) {
    return value.map((entry) => replaceSiteUrl(entry, siteUrl));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceSiteUrl(entry, siteUrl)]));
  }
  if (typeof value === "string") {
    return value.replaceAll("__SITE__", siteUrl);
  }
  return value;
}

function contentType(filePath) {
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".zip")) return "application/zip";
  if (filePath.endsWith(".tar.gz")) return "application/gzip";
  return "application/octet-stream";
}

const server = http.createServer(async (request, response) => {
  const requestUrl = request.url ?? "/";
  if (requestUrl === "/data/latest-release.json") {
    const address = server.address();
    const siteUrl = typeof address === "object" && address ? \`http://127.0.0.1:\${address.port}\` : "http://127.0.0.1";
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(replaceSiteUrl(payload, siteUrl)));
    return;
  }

  const localPath = path.join(root, requestUrl.replace(/^\\/+/, ""));
  try {
    const content = await fs.readFile(localPath);
    response.setHeader("content-type", contentType(localPath));
    response.end(content);
  } catch {
    response.statusCode = 404;
    response.end("not found");
  }
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    console.error("invalid-address");
    process.exit(1);
    return;
  }
  console.log(address.port);
});`
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        STATIC_ROOT: root,
        RELEASE_METADATA: JSON.stringify(releaseMetadata)
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const port = await new Promise<number>((resolve, reject) => {
    let stderr = "";
    let settled = false;

    server.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    server.stdout?.on("data", (chunk) => {
      if (settled) {
        return;
      }
      const value = Number(chunk.toString().trim().split(/\r?\n/)[0]);
      if (!Number.isFinite(value)) {
        return;
      }
      settled = true;
      resolve(value);
    });

    server.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });

    server.on("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(stderr || `static release server exited with code ${code ?? "unknown"}`));
    });
  });

  return {
    child: server,
    siteUrl: `http://127.0.0.1:${port}`
  };
}

async function stopChildProcess(child: ReturnType<typeof spawn>) {
  if (child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill();
  });
}
