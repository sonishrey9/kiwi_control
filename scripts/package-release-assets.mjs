import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(repoRoot, "dist", "release");
const assetsDir = path.join(releaseDir, "assets");
const manifestPath = path.join(releaseDir, "release-manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const platform = mapPlatform(process.env.RUNNER_OS ?? process.platform);
const arch = mapArch(process.env.RUNNER_ARCH ?? process.arch);
const requireDesktopAsset = (process.env.GITHUB_REF ?? "").startsWith("refs/tags/v");

await rm(assetsDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

const createdAssets = [];

const cliArtifacts = collectCliArtifacts(manifest, { platform, arch });
for (const cliArtifact of cliArtifacts) {
  await packageDirectory({
    sourceDir: path.join(releaseDir, "cli-bundle"),
    outputPath: path.join(assetsDir, cliArtifact.fileName)
  });
  createdAssets.push(cliArtifact.fileName);
}

for (const artifactType of ["runtime", "ui-web"]) {
  const artifact = requireArtifact(manifest, { artifactType });
  const outputFileName = renderTemplateArtifactName(artifact.fileName, platform, arch);
  await packageDirectory({
    sourceDir: path.join(repoRoot, artifact.sourcePath),
    outputPath: path.join(assetsDir, outputFileName)
  });
  createdAssets.push(outputFileName);
}

const desktopArtifacts = findDesktopArtifacts(manifest, { platform, arch });
for (const desktopArtifact of desktopArtifacts) {
  const desktopTargetFile = path.join(assetsDir, desktopArtifact.fileName);
  if (desktopArtifact.packagingStrategy === "archive-directory") {
    const sourceDir = path.join(repoRoot, desktopArtifact.sourcePath);
    const sourceStats = await stat(sourceDir).catch(() => null);
    if (!sourceStats?.isDirectory()) {
      if (requireDesktopAsset) {
        throw new Error(`Expected desktop bundle directory for ${platform}/${arch} at ${desktopArtifact.sourcePath}, but none was found.`);
      }
      continue;
    }
    await packageArchiveDirectory({
      sourceDir,
      outputPath: desktopTargetFile,
      artifact: desktopArtifact
    });
    createdAssets.push(desktopArtifact.fileName);
    continue;
  }

  const desktopSourceFile = await findDesktopBundleFile(path.join(repoRoot, desktopArtifact.bundlePath), desktopArtifact.fileName);
  if (!desktopSourceFile) {
    if (requireDesktopAsset) {
      throw new Error(`Expected desktop bundle for ${platform}/${arch} under ${desktopArtifact.bundlePath}, but none was found.`);
    }
    continue;
  }
  await cp(desktopSourceFile, desktopTargetFile);
  createdAssets.push(desktopArtifact.fileName);
}

await removeMacMetadataArtifacts(assetsDir);

console.log(
  JSON.stringify(
    {
      ok: true,
      platform,
      arch,
      assetsDir: path.relative(repoRoot, assetsDir).replace(/\\/g, "/"),
      createdAssets
    },
    null,
    2
  )
);

function requireArtifact(manifestPayload, criteria) {
  const artifact = manifestPayload.artifacts.find((candidate) => {
    if (candidate.artifactType !== criteria.artifactType) {
      return false;
    }
    if (criteria.platform && candidate.platform && candidate.platform !== criteria.platform) {
      return false;
    }
    if (criteria.arch && candidate.arch && candidate.arch !== criteria.arch) {
      return false;
    }
    return true;
  });

  if (!artifact) {
    throw new Error(`No release manifest artifact matched ${JSON.stringify(criteria)}.`);
  }

  return artifact;
}

function collectCliArtifacts(manifestPayload, criteria) {
  return manifestPayload.artifacts.filter((artifact) => artifact.artifactType === "cli");
}

function findDesktopArtifacts(manifestPayload, criteria) {
  return manifestPayload.artifacts.filter(
    (candidate) =>
      candidate.artifactType.startsWith("desktop") &&
      candidate.platform === criteria.platform &&
      candidate.arch === criteria.arch
  );
}

function renderTemplateArtifactName(template, platformValue, archValue) {
  return template.replaceAll("${os}", platformValue).replaceAll("${arch}", archValue);
}

async function packageDirectory({ sourceDir, outputPath, preserveRootDirectory = false }) {
  const sourceStats = await stat(sourceDir).catch(() => null);
  if (!sourceStats?.isDirectory()) {
    throw new Error(`Missing source directory for release packaging: ${sourceDir}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });

  const archiveArgs = preserveRootDirectory
    ? ["-C", path.dirname(sourceDir), path.basename(sourceDir)]
    : ["-C", sourceDir, "."];

  if (outputPath.endsWith(".zip")) {
    runArchiveCommand("tar", ["-a", "-cf", outputPath, ...archiveArgs]);
    return;
  }

  if (outputPath.endsWith(".tar.gz")) {
    runArchiveCommand("tar", ["-czf", outputPath, ...archiveArgs]);
    return;
  }

  throw new Error(`Unsupported archive format for ${outputPath}`);
}

async function packageArchiveDirectory({ sourceDir, outputPath, artifact }) {
  if (artifact.platform === "macos" && artifact.artifactType === "desktop-app") {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kiwi-desktop-archive-"));
    try {
      const stagedSourceDir = path.join(tempRoot, path.basename(sourceDir));
      await cp(sourceDir, stagedSourceDir, { recursive: true });
      await normalizeMacosAppBundle(stagedSourceDir);
      await packageDirectory({
        sourceDir: stagedSourceDir,
        outputPath,
        preserveRootDirectory: true
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
    return;
  }

  await packageDirectory({
    sourceDir,
    outputPath,
    preserveRootDirectory: true
  });
}

function runArchiveCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`);
  }
}

async function findDesktopBundleFile(bundleDir, expectedFileName) {
  const bundleStats = await stat(bundleDir).catch(() => null);
  if (!bundleStats?.isDirectory()) {
    return null;
  }

  const expectedPath = path.join(bundleDir, expectedFileName);
  const expectedStats = await stat(expectedPath).catch(() => null);
  if (expectedStats?.isFile()) {
    return expectedPath;
  }

  const extension = path.extname(expectedFileName).toLowerCase();
  const candidates = await collectFiles(bundleDir);
  return candidates.find((candidate) => candidate.toLowerCase().endsWith(extension)) ?? null;
}

async function collectFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      continue;
    }

    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function removeMacMetadataArtifacts(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await removeMacMetadataArtifacts(fullPath);
      continue;
    }
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      await rm(fullPath, { force: true });
    }
  }
}

async function normalizeMacosAppBundle(rootPath) {
  await walkAndNormalize(rootPath, rootPath);
}

async function walkAndNormalize(rootPath, currentPath) {
  const stats = await stat(currentPath);
  if (stats.isDirectory()) {
    await chmod(currentPath, 0o755);
    const entries = await readdir(currentPath);
    for (const entry of entries) {
      await walkAndNormalize(rootPath, path.join(currentPath, entry));
    }
    return;
  }

  await chmod(currentPath, shouldRemainExecutable(rootPath, currentPath) ? 0o755 : 0o644);
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

function mapPlatform(value) {
  switch (value) {
    case "darwin":
    case "macOS":
      return "macos";
    case "win32":
    case "Windows":
      return "windows";
    case "linux":
    case "Linux":
      return "linux";
    default:
      throw new Error(`Unsupported release packaging platform: ${value}`);
  }
}

function mapArch(value) {
  switch (value.toLowerCase()) {
    case "x64":
      return "x64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(`Unsupported release packaging architecture: ${value}`);
  }
}
