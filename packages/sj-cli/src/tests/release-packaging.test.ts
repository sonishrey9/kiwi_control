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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiwi-release-manifest-"));
  const manifestPath = path.join(root, "dist", "release", "release-manifest.json");
  const previousManifest = await fs.readFile(manifestPath, "utf8").catch(() => null);

  try {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "prepare-release-manifest.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        KIWI_CONTROL_RELEASE_MANIFEST_TMP: tempDir
      }
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
