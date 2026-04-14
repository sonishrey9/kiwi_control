import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const releaseDir = path.join(repoRoot, "dist", "release");
const outputPath = path.resolve(args.output ?? path.join(releaseDir, "SHA256SUMS.txt"));

await fs.mkdir(path.dirname(outputPath), { recursive: true });

const candidateRoots = (args.roots.length > 0 ? args.roots : defaultCandidateRoots()).map((candidate) => path.resolve(repoRoot, candidate));

const files = await collectFiles(candidateRoots);
const lines = [];

for (const filePath of files) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  if (relativePath === path.relative(repoRoot, outputPath).replace(/\\/g, "/")) {
    continue;
  }
  const digest = await sha256(filePath);
  lines.push(`${digest}  ${relativePath}`);
}

lines.sort((left, right) => left.localeCompare(right));
await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`wrote SHA256 checksums to ${outputPath}`);

function parseArgs(argv) {
  const parsed = {
    output: undefined,
    roots: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--root") {
      parsed.roots.push(argv[index + 1]);
      index += 1;
    }
  }

  return parsed;
}

function defaultCandidateRoots() {
  return [
    path.join("dist", "release", "cli-bundle"),
    path.join("dist", "release", "assets"),
    path.join("dist", "release", "release-manifest.json"),
    path.join("packages", "sj-core", "dist", "runtime"),
    path.join("apps", "sj-ui", "dist"),
    path.join("apps", "sj-ui", "src-tauri", "target", "release", "bundle")
  ];
}

async function collectFiles(roots) {
  const files = [];
  for (const root of roots) {
    try {
      const stats = await fs.stat(root);
      if (stats.isDirectory()) {
        files.push(...await collectFilesFromDir(root));
      } else if (stats.isFile()) {
        files.push(root);
      }
    } catch {
      // Missing artifact roots are allowed before a full release build.
    }
  }
  return files;
}

async function collectFilesFromDir(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (isMacMetadataArtifact(entry.name)) {
      continue;
    }
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFilesFromDir(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  const buffer = await fs.readFile(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

function isMacMetadataArtifact(name) {
  return name === ".DS_Store" || name.startsWith("._");
}
