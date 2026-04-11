#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug-report.yml",
  ".github/ISSUE_TEMPLATE/feature-request.yml",
  "docs/install.md",
  "docs/release-packaging.md",
  "docs/security-and-trust.md",
  "docs/generated-artifacts.md",
  "docs/README.md",
  "ARCHITECTURE.md"
];

const publicDocs = [
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "docs/install.md",
  "docs/release-packaging.md",
  "docs/security-and-trust.md",
  "docs/generated-artifacts.md",
  "docs/README.md"
];

const gitignoreExpected = [
  ".agent/context-authority.json",
  ".agent/context/**/*.json",
  ".agent/eval/",
  ".agent/memory/**/*.json",
  ".agent/state/**/*.json",
  ".agent/state/**/*.ndjson",
  ".agent/tasks/",
  ".playwright-cli/",
  "output/playwright/",
  "dist/release/",
  "docs/._*",
  ".github/**/._*",
  "website/._*",
  "website/**/._*"
];

const noisyTrackedPatterns = [
  "docs/._*",
  ".github/**/._*",
  "website/._*",
  "website/**/._*",
  ".playwright-cli/**",
  "output/playwright/**",
  "dist/release/**",
  ".agent/context-authority.json",
  ".agent/context/*.json",
  ".agent/context/generated-instructions.md",
  ".agent/eval/**",
  ".agent/memory/*.json",
  ".agent/state/**/*.json",
  ".agent/state/**/*.ndjson",
  ".agent/state/checkpoints/latest.md",
  ".agent/tasks/**"
];

const leakPattern = /(\/Volumes\/|\/Users\/|file:\/\/\/|]\(\/Volumes\/)/;

const missingFiles = [];
for (const relativePath of requiredFiles) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
  } catch {
    missingFiles.push(relativePath);
  }
}

const gitignoreContent = await fs.readFile(path.join(repoRoot, ".gitignore"), "utf8");
const missingGitignorePatterns = gitignoreExpected.filter((entry) => !gitignoreContent.includes(entry));

const leakedDocs = [];
for (const relativePath of publicDocs) {
  const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  if (leakPattern.test(content)) {
    leakedDocs.push(relativePath);
  }
}

const trackedNoise = trackedFilesMatching(noisyTrackedPatterns);

const docsIndex = await fs.readFile(path.join(repoRoot, "docs", "README.md"), "utf8");
const readme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8");
const contributing = await fs.readFile(path.join(repoRoot, "CONTRIBUTING.md"), "utf8");

const missingPolicyLinks = [];
if (!docsIndex.includes("generated-artifacts.md")) {
  missingPolicyLinks.push("docs/README.md");
}
if (!readme.includes("generated-artifacts.md")) {
  missingPolicyLinks.push("README.md");
}
if (!contributing.includes("generated-artifacts.md")) {
  missingPolicyLinks.push("CONTRIBUTING.md");
}

const payload = {
  ok:
    missingFiles.length === 0
    && missingGitignorePatterns.length === 0
    && leakedDocs.length === 0
    && trackedNoise.length === 0
    && missingPolicyLinks.length === 0,
  missingFiles,
  missingGitignorePatterns,
  leakedDocs,
  trackedNoise,
  missingPolicyLinks
};

console.log(JSON.stringify(payload, null, 2));
process.exitCode = payload.ok ? 0 : 1;

function trackedFilesMatching(patterns) {
  const result = spawnSync("git", ["ls-files", ...patterns], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || "git ls-files failed");
  }
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}
