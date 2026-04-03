import path from "node:path";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const [, , destinationArg] = process.argv;

if (!destinationArg) {
  console.error("usage: node scripts/copy-runtime-assets.mjs <destination>");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destinationRoot = path.resolve(repoRoot, destinationArg);

for (const relativePath of ["configs", "docs", "examples", "prompts", "scripts", "templates"]) {
  const source = path.join(repoRoot, relativePath);
  const destination = path.join(destinationRoot, relativePath);
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    filter: (entry) => !path.basename(entry).startsWith("._")
  });
}
