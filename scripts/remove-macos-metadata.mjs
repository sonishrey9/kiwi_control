import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function removeMacMetadataArtifacts(...targets) {
  let removedCount = 0;
  for (const target of targets) {
    removedCount += await removeMacMetadataArtifactsFromPath(path.resolve(target));
  }

  return removedCount;
}

async function removeMacMetadataArtifactsFromPath(targetPath) {
  if (!existsSync(targetPath)) {
    return 0;
  }

  const stats = await fs.lstat(targetPath).catch((error) => {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  });
  if (!stats) {
    return 0;
  }
  if (!stats.isDirectory()) {
    if (isMacMetadataArtifact(path.basename(targetPath))) {
      await fs.rm(targetPath, { force: true }).catch((error) => {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      });
      return 1;
    }
    return 0;
  }

  let removedCount = 0;
  const entries = await fs.readdir(targetPath, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      removedCount += await removeMacMetadataArtifactsFromPath(entryPath);
      continue;
    }

    if (isMacMetadataArtifact(entry.name)) {
      await fs.rm(entryPath, { force: true }).catch((error) => {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      });
      removedCount += 1;
    }
  }

  return removedCount;
}

function isMacMetadataArtifact(fileName) {
  return fileName === ".DS_Store" || fileName.startsWith("._");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("Usage: node scripts/remove-macos-metadata.mjs <path> [more paths]");
    process.exit(1);
  }

  const removedCount = await removeMacMetadataArtifacts(...targets);
  console.log(`Removed ${removedCount} macOS metadata artifact${removedCount === 1 ? "" : "s"}.`);
}
