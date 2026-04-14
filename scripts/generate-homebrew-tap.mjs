#!/usr/bin/env node
import { createHash } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const downloadsJsonPath = path.resolve(args.downloadsJson ?? path.join(repoRoot, "dist", "release", "publish", "downloads.json"));
const publishRoot = path.resolve(args.publishRoot ?? path.dirname(downloadsJsonPath));
const outputDir = path.resolve(args.outputDir ?? path.join(repoRoot, "dist", "release", "homebrew"));
const formulaTemplatePath = path.join(repoRoot, "packaging", "homebrew", "kiwi-control.rb.template");
const caskTemplatePath = path.join(repoRoot, "packaging", "homebrew", "kiwi-control-desktop.rb.template");

const downloads = JSON.parse(await fs.readFile(downloadsJsonPath, "utf8"));
const formulaTemplate = await fs.readFile(formulaTemplatePath, "utf8");
const caskTemplate = await fs.readFile(caskTemplatePath, "utf8");

const formulaVariants = await collectFormulaVariants(downloads, publishRoot);
if (formulaVariants.length === 0) {
  throw new Error("No published CLI artifacts are available for Homebrew formula scaffolding.");
}

const formula = formulaTemplate
  .replaceAll("__VERSION__", downloads.version)
  .replace("__URL_BLOCKS__", renderFormulaUrlBlocks(formulaVariants));

const formulaPath = path.join(outputDir, "Formula", "kiwi-control.rb");
await fs.mkdir(path.dirname(formulaPath), { recursive: true });
await fs.writeFile(formulaPath, formula, "utf8");

const caskArtifact = downloads.artifacts?.macosPkg;
let caskPath = null;
if (caskArtifact?.latestUrl) {
  const caskSha = await resolveSha256(caskArtifact, publishRoot);
  const cask = caskTemplate
    .replaceAll("__VERSION__", downloads.version)
    .replace("__SHA256__", caskSha)
    .replace("__URL__", caskArtifact.versionedUrl ?? caskArtifact.latestUrl)
    .replace("__PKG_NAME__", path.basename(caskArtifact.filename ?? "kiwi-control.pkg"));

  caskPath = path.join(outputDir, "Casks", "kiwi-control.rb");
  await fs.mkdir(path.dirname(caskPath), { recursive: true });
  await fs.writeFile(caskPath, cask, "utf8");
}

const readmePath = path.join(outputDir, "README.md");
await fs.writeFile(readmePath, renderReadme({ downloads, caskPath }), "utf8");

console.log(JSON.stringify({
  outputDir: path.relative(repoRoot, outputDir).replace(/\\/g, "/"),
  formula: path.relative(repoRoot, formulaPath).replace(/\\/g, "/"),
  cask: caskPath ? path.relative(repoRoot, caskPath).replace(/\\/g, "/") : null,
  scaffoldOnly: true,
  note: "Homebrew files are generated for a future tap; no tap repository was published."
}, null, 2));

function parseArgs(argv) {
  const parsed = {
    downloadsJson: null,
    publishRoot: null,
    outputDir: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--downloads-json") {
      parsed.downloadsJson = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--publish-root") {
      parsed.publishRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--output-dir") {
      parsed.outputDir = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return parsed;
}

async function collectFormulaVariants(metadata, rootDir) {
  const artifacts = metadata.artifacts ?? {};
  const candidates = [
    { os: "macos", cpu: "arm", artifact: artifacts.cliMacosAarch64 ?? artifacts.cliMacos },
    { os: "macos", cpu: "intel", artifact: artifacts.cliMacosX64 },
    { os: "linux", cpu: null, artifact: artifacts.cliLinux }
  ];

  const variants = [];
  for (const candidate of candidates) {
    if (!candidate.artifact?.latestUrl) {
      continue;
    }
    variants.push({
      ...candidate,
      url: candidate.artifact.versionedUrl ?? candidate.artifact.latestUrl,
      sha256: await resolveSha256(candidate.artifact, rootDir)
    });
  }
  return variants;
}

async function resolveSha256(artifact, rootDir) {
  const localPath = artifact.filename ? path.join(rootDir, artifact.filename) : null;
  if (localPath) {
    const stats = await fs.stat(localPath).catch(() => null);
    if (stats?.isFile()) {
      return sha256Buffer(await fs.readFile(localPath));
    }
  }

  const url = artifact.versionedUrl ?? artifact.latestUrl;
  if (!url) {
    throw new Error(`Cannot compute SHA256 for ${artifact.filename ?? "unknown artifact"} without a URL.`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status} while computing SHA256.`);
  }
  return sha256Buffer(Buffer.from(await response.arrayBuffer()));
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function renderFormulaUrlBlocks(variants) {
  const macosVariants = variants.filter((variant) => variant.os === "macos");
  const linuxVariant = variants.find((variant) => variant.os === "linux");
  const blocks = [];

  if (macosVariants.length > 0) {
    const macosLines = ["  on_macos do"];
    for (const variant of macosVariants) {
      macosLines.push(`    on_${variant.cpu} do`);
      macosLines.push(`      url "${variant.url}"`);
      macosLines.push(`      sha256 "${variant.sha256}"`);
      macosLines.push("    end");
    }
    macosLines.push("  end");
    blocks.push(macosLines.join("\n"));
  }

  if (linuxVariant) {
    blocks.push([
      "  on_linux do",
      `    url "${linuxVariant.url}"`,
      `    sha256 "${linuxVariant.sha256}"`,
      "  end"
    ].join("\n"));
  }

  return blocks.join("\n\n");
}

function renderReadme({ downloads: metadata, caskPath: generatedCaskPath }) {
  return `# Kiwi Control Homebrew Tap Scaffolding

Generated for Kiwi Control ${metadata.version}.

This directory is scaffold-only. It is ready to copy into a future public Homebrew tap, but no tap repository is published by this generator.

- Formula: CLI-only, installs \`kiwi-control\` and \`kc\`.
- Cask: ${generatedCaskPath ? "macOS desktop pkg beta scaffold generated." : "not generated because no macOS pkg URL was published."}
- Windows desktop EXE/MSI availability is not represented here.

Do not document \`brew install\` as a live user path until the generated files are committed to a public tap repository.
`;
}
