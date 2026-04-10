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
