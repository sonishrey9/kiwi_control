#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv();
const args = parseArgs(process.argv.slice(2));

const outputDir = path.resolve(args.outputDir ?? path.join(repoRoot, "dist", "site"));
const projectName = args.projectName ?? process.env.CLOUDFLARE_PAGES_PROJECT_NAME ?? "kiwi-control";
const downloadsUrl = args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "";
const siteUrl = args.siteUrl ?? process.env.SITE_URL ?? "https://kiwi-control.kiwi-ai.in/";
const branch = args.branch ?? "main";
const commitHash = args.commitHash ?? resolveGit("rev-parse", "HEAD") ?? "local-direct-deploy";
const commitDirty = args.commitDirty ?? isGitDirty();
const commitMessage =
  args.commitMessage
  ?? `${commitHash}: local direct deploy`;

const auth = resolveAuth();

if (args.ensureProject !== false && auth.ensureWithApi) {
  runNodeScript("scripts/ensure-cloudflare-pages-project.mjs", [
    "--output",
    "dist/release/cloudflare-pages.json"
  ], {
    CLOUDFLARE_PAGES_PROJECT_NAME: projectName,
    SITE_URL: siteUrl
  });
}

if (args.stage !== false) {
  runNodeScript("scripts/stage-pages-site.mjs", [
    "--downloads-url",
    downloadsUrl,
    "--require-downloads-json",
    "--output-dir",
    path.relative(repoRoot, outputDir)
  ]);
}

const deployArgs = [
  "--yes",
  "wrangler",
  "pages",
  "deploy",
  outputDir,
  "--project-name",
  projectName,
  "--branch",
  branch,
  "--commit-hash",
  commitHash,
  "--commit-message",
  commitMessage
];

if (commitDirty) {
  deployArgs.push("--commit-dirty");
}

runCommand("npx", deployArgs, {
  purpose: "direct Cloudflare Pages deploy"
});

console.log(
  JSON.stringify(
    {
      ok: true,
      authMode: auth.mode,
      projectName,
      siteUrl,
      outputDir: path.relative(repoRoot, outputDir).replace(/\\/g, "/"),
      downloadsUrl,
      branch,
      commitHash,
      commitDirty
    },
    null,
    2
  )
);

function parseArgs(argv) {
  const parsed = {
    outputDir: null,
    projectName: null,
    downloadsUrl: null,
    siteUrl: null,
    branch: null,
    commitHash: null,
    commitMessage: null,
    commitDirty: null,
    stage: true,
    ensureProject: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output-dir") {
      parsed.outputDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--project-name") {
      parsed.projectName = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--downloads-url") {
      parsed.downloadsUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--site-url") {
      parsed.siteUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--branch") {
      parsed.branch = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--commit-hash") {
      parsed.commitHash = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--commit-message") {
      parsed.commitMessage = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--commit-dirty") {
      parsed.commitDirty = true;
      continue;
    }
    if (token === "--no-stage") {
      parsed.stage = false;
      continue;
    }
    if (token === "--no-ensure-project") {
      parsed.ensureProject = false;
    }
  }

  return parsed;
}

function resolveAuth() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  if (apiToken) {
    return {
      mode: accountId ? "api-token" : "api-token-no-account-id",
      ensureWithApi: Boolean(accountId)
    };
  }

  const whoami = runCommand("npx", ["--yes", "wrangler", "whoami"], {
    purpose: "Cloudflare auth preflight",
    allowFailure: true
  });

  const combinedOutput = `${whoami.stdout ?? ""}\n${whoami.stderr ?? ""}`;
  const unauthenticated =
    whoami.status !== 0 ||
    combinedOutput.includes("You are not authenticated") ||
    combinedOutput.toLowerCase().includes("not authenticated");

  if (!unauthenticated) {
    return {
      mode: "wrangler-oauth",
      ensureWithApi: false
    };
  }

  const nextStep = process.stdout.isTTY
    ? "Run `npx --yes wrangler login` once in an interactive terminal, or export CLOUDFLARE_API_TOKEN before retrying."
    : "Export CLOUDFLARE_API_TOKEN before retrying. This non-interactive shell cannot complete `wrangler login` inline.";

  throw new Error(
    [
      "Local Cloudflare auth is missing.",
      nextStep
    ].join(" ")
  );
}

function runNodeScript(relativeScriptPath, argsList = [], envOverrides = {}) {
  runCommand(process.execPath, [path.join(repoRoot, relativeScriptPath), ...argsList], {
    purpose: relativeScriptPath,
    env: {
      ...process.env,
      ...envOverrides
    }
  });
}

function runCommand(command, argsList, options = {}) {
  const result = spawnSync(command, argsList, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: options.env ?? process.env
  });

  if (!options.allowFailure && (result.status ?? 1) !== 0) {
    throw new Error(
      [
        `Failed while running ${options.purpose ?? `${command} ${argsList.join(" ")}`}.`,
        result.stderr?.trim() || result.stdout?.trim() || `exit code ${result.status ?? 1}`
      ].filter(Boolean).join("\n")
    );
  }

  return result;
}

function resolveGit(...gitArgs) {
  const result = spawnSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe"
  });
  if ((result.status ?? 1) !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function isGitDirty() {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe"
  });
  if ((result.status ?? 1) !== 0) {
    return false;
  }
  return result.stdout.trim().length > 0;
}
