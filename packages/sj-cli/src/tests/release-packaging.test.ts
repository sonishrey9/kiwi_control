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

test("release manifest declares macOS app+dmg and Windows nsis+msi artifacts plus signing inputs", async () => {
  const root = repoRoot();
  const manifestPath = path.join(root, "dist", "release", "release-manifest.json");
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
    assert.equal(artifactTypes.includes("desktop-nsis"), true);
    assert.equal(artifactTypes.includes("desktop-msi"), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".app.tar.gz")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".dmg")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith("-setup.exe")), true);
    assert.equal(manifest.artifacts.some((entry) => entry.fileName.endsWith(".msi")), true);
    assert.equal(manifest.updateMetadata.signingInputs.includes("APPLE_API_KEY_PATH"), true);
    assert.equal(manifest.updateMetadata.signingInputs.includes("WINDOWS_CERTIFICATE_PFX_B64"), true);
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

test("bundled CLI installer exposes machine-scope Windows scaffolding", () => {
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
    checksumsUrl: string;
    manifestUrl: string;
    trust: { macos: string; windows: string };
    artifacts: {
      macosDmg: { latestUrl: string; versionedUrl: string };
      windowsNsis: { latestUrl: string };
      cliWindows: { latestUrl: string };
    };
  };
  assert.equal(downloads.checksumsUrl, "https://downloads.example.com/latest/SHA256SUMS.txt");
  assert.equal(downloads.manifestUrl, "https://downloads.example.com/latest/release-manifest.json");
  assert.equal(downloads.trust.macos, "signed-and-notarized");
  assert.equal(downloads.trust.windows, "signed-installers");
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
    artifacts: {
      macosDmg: { latestUrl: string };
      windowsNsis: { latestUrl: string };
    };
  };
  assert.equal(downloads.artifacts.macosDmg.latestUrl, "https://downloads.example.com/latest/macos/kiwi-control.dmg");
  assert.equal(downloads.artifacts.windowsNsis.latestUrl, "https://downloads.example.com/latest/windows/kiwi-control-setup.exe");
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
      releaseNotesUrl: "https://github.com/example/kiwi-control/releases/tag/v0.2.0-beta.1",
      sourceUrl: "https://github.com/example/kiwi-control/releases/tag/v0.2.0-beta.1",
      checksumsUrl: "https://downloads.example.com/latest/SHA256SUMS.txt",
      manifestUrl: "https://downloads.example.com/latest/release-manifest.json",
      trust: {
        macos: "local-beta-build-only",
        windows: "windows-runner-required"
      },
      artifacts: {
        macosDmg: {
          filename: "kiwi-control-0.2.0-beta.1-macos-aarch64.dmg",
          latestUrl: "https://downloads.example.com/latest/macos/kiwi-control.dmg",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-macos-aarch64.dmg"
        },
        windowsNsis: {
          filename: "kiwi-control-0.2.0-beta.1-windows-x64-setup.exe",
          latestUrl: "https://downloads.example.com/latest/windows/kiwi-control-setup.exe",
          versionedUrl: "https://downloads.example.com/releases/v0.2.0-beta.1/kiwi-control-0.2.0-beta.1-windows-x64-setup.exe"
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
  const metadata = JSON.parse(await fs.readFile(path.join(outputDir, "data", "latest-release.json"), "utf8")) as {
    checksumsUrl: string;
  };
  assert.equal(metadata.checksumsUrl, "https://downloads.example.com/latest/SHA256SUMS.txt");
  await fs.access(path.join(outputDir, "downloads", "index.html"));
  await assert.rejects(fs.access(path.join(outputDir, "._index.html")));
});
