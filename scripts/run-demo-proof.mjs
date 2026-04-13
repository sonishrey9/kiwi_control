#!/usr/bin/env node
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");
const outputRoot = path.join(repoRoot, "output", "demo", "2026-04-13-live-proof");

const { command: cliCommand, prefixArgs: cliPrefixArgs, display: cliDisplay } = resolveCli();

await main();

async function main() {
  await ensureDir(outputRoot);
  await ensureDir(path.join(outputRoot, "current-repo"));
  await ensureDir(path.join(outputRoot, "site"));
  await ensureDir(path.join(outputRoot, "cli-ui-truth"));
  await ensureDir(path.join(outputRoot, "rendered-desktop"));
  await ensureDir(path.join(outputRoot, "reference-desktop"));
  await ensureDir(path.join(outputRoot, "notes"));

  const metadata = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    cliInvocation: cliDisplay,
    osTmpDir: os.tmpdir(),
    steps: []
  };

  const currentRepoDir = path.join(outputRoot, "current-repo");
  const siteDir = path.join(outputRoot, "site");
  const cliUiDir = path.join(outputRoot, "cli-ui-truth");
  const renderedDesktopDir = path.join(outputRoot, "rendered-desktop");
  const notesDir = path.join(outputRoot, "notes");

  metadata.steps.push(await captureCommand("versions", ["--version"], currentRepoDir, { commandOverride: "node", argsOverride: ["--version"] }));
  metadata.steps.push(await captureCommand("npm-version", ["--version"], currentRepoDir, { commandOverride: "npm", argsOverride: ["--version"] }));
  metadata.steps.push(await captureCommand("cargo-version", ["--version"], currentRepoDir, { commandOverride: "cargo", argsOverride: ["--version"], allowFailure: true }));
  metadata.steps.push(await captureCommand("kc-help", ["--help"], currentRepoDir));
  metadata.steps.push(await captureCommand("setup-status", ["setup", "status", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("setup-verify", ["setup", "verify", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("parity", ["parity", "--json"], currentRepoDir));
  metadata.steps.push(await captureCommand("status", ["status", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("graph-build", ["graph", "build", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("graph-status", ["graph", "status", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("pack-status", ["pack", "status", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("guide", ["guide", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("repo-map", ["repo-map", "--changed", "--limit", "8", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("agent-pack-review", ["agent-pack", "--review", "--json", "--target", repoRoot], currentRepoDir));
  metadata.steps.push(await captureCommand("review", ["review", "--json", "--target", repoRoot], currentRepoDir));
  await createCurrentRepoAliases(currentRepoDir);
  metadata.steps.push(await captureShell("smoke-test", "bash scripts/smoke-test.sh", notesDir));

  await bestEffortDesktopCleanup();
  const cliUiResult = await captureShell(
    "verify-cli-ui-truth",
    "node scripts/verify-cli-ui-truth.mjs --external-temp-repo",
    notesDir,
    { allowFailure: true, timeoutMs: 90_000 }
  );
  const cliUiSourceDir = await resolveCliUiTruthSource(cliUiResult);
  const cliUiSummary = JSON.parse(await fs.readFile(path.join(cliUiSourceDir, "summary.json"), "utf8"));
  await writeJson(path.join(cliUiDir, "summary.json"), cliUiSummary);
  metadata.cliUiTruthSource = cliUiSourceDir;
  await copyIfExists(path.join(cliUiSourceDir, "render-probe-queued.json"), path.join(cliUiDir, "render-probe-queued.json"));
  await copyIfExists(path.join(cliUiSourceDir, "render-probe-blocked.json"), path.join(cliUiDir, "render-probe-blocked.json"));
  await copyIfExists(path.join(cliUiSourceDir, "render-probe-recovered.json"), path.join(cliUiDir, "render-probe-recovered.json"));
  await copyIfExists(path.join(cliUiSourceDir, "status-prepared.stdout.txt"), path.join(cliUiDir, "status-prepared.json"));
  await copyIfExists(path.join(cliUiSourceDir, "status-queued.stdout.txt"), path.join(cliUiDir, "status-queued.json"));
  await copyIfExists(path.join(cliUiSourceDir, "status-blocked.stdout.txt"), path.join(cliUiDir, "status-blocked.json"));
  await copyIfExists(path.join(cliUiSourceDir, "status-recovered.stdout.txt"), path.join(cliUiDir, "status-recovered.json"));
  await copyIfExists(path.join(cliUiSourceDir, "prepare.stdout.txt"), path.join(cliUiDir, "prepare.txt"));
  await copyIfExists(path.join(cliUiSourceDir, "run.stdout.txt"), path.join(cliUiDir, "run.txt"));
  await copyIfExists(path.join(cliUiSourceDir, "run-auto.stderr.txt"), path.join(cliUiDir, "run-auto.stderr.txt"));
  await copyIfExists(path.join(cliUiSourceDir, "external-repo", ".agent", "state", "latest-task-packets.json"), path.join(cliUiDir, "latest-task-packets.json"));

  const renderedBefore = await listTmpDirs("kiwi-rendered-desktop-");
  metadata.steps.push(
    await captureShell("verify-rendered-desktop", "node scripts/verify-rendered-desktop.mjs", notesDir, {
      allowFailure: true,
      timeoutMs: 90_000
    })
  );
  const renderedAfter = await listTmpDirs("kiwi-rendered-desktop-");
  const latestRenderedDir = newestNewDir(renderedBefore, renderedAfter) ?? renderedAfter[0] ?? null;
  if (latestRenderedDir) {
    await fs.writeFile(path.join(renderedDesktopDir, "source-path.txt"), `${latestRenderedDir}\n`, "utf8");
    await copyTree(latestRenderedDir, path.join(renderedDesktopDir, "raw"));
  }

  const publicHeaders = await capturePublicHeaders(siteDir);
  metadata.publicSite = publicHeaders;
  const siteCapture = await captureSiteScreens(siteDir);
  metadata.siteCapture = siteCapture;

  await copyIfExists(path.join(repoRoot, "output", "phase2-proof", "current-ready.png"), path.join(outputRoot, "reference-desktop", "current-ready.png"));
  await copyIfExists(path.join(repoRoot, "output", "phase2-proof", "external-blocked.png"), path.join(outputRoot, "reference-desktop", "external-blocked.png"));
  await copyIfExists(path.join(repoRoot, "output", "phase2-proof", "external-recovered.png"), path.join(outputRoot, "reference-desktop", "external-recovered.png"));

  const currentHighlights = await buildHighlights(currentRepoDir);
  await writeJson(path.join(notesDir, "highlights.json"), currentHighlights);
  await writeJson(path.join(outputRoot, "metadata.json"), metadata);

  console.log(JSON.stringify({ outputRoot, cliDisplay, siteCapture, publicHeaders }, null, 2));
}

function resolveCli() {
  const which = spawnSync("which", ["kc"], { encoding: "utf8" });
  if (which.status === 0) {
    return {
      command: "kc",
      prefixArgs: [],
      display: "kc"
    };
  }

  return {
    command: process.execPath,
    prefixArgs: [cliEntrypoint],
    display: `node ${path.relative(repoRoot, cliEntrypoint)}`
  };
}

async function captureCommand(label, cliArgs, outDir, options = {}) {
  const command = options.commandOverride ?? cliCommand;
  const args = options.argsOverride ?? [...cliPrefixArgs, ...cliArgs];
  return captureProcess(label, command, args, outDir, {
    allowFailure: options.allowFailure === true,
    timeoutMs: options.timeoutMs
  });
}

async function captureShell(label, script, outDir, options = {}) {
  return captureProcess(label, "zsh", ["-lc", script], outDir, options);
}

async function captureProcess(label, command, args, outDir, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeoutMs
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  await fs.writeFile(path.join(outDir, `${label}.stdout.txt`), stdout, "utf8");
  await fs.writeFile(path.join(outDir, `${label}.stderr.txt`), stderr, "utf8");
  await writeJson(path.join(outDir, `${label}.meta.json`), {
    label,
    command,
    args,
    exitCode: result.status ?? 1
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0 && options.allowFailure !== true) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
  return {
    label,
    command,
    args,
    exitCode: result.status ?? 1,
    stdout,
    stderr
  };
}

async function bestEffortDesktopCleanup() {
  spawnSync("zsh", ["-lc", "osascript -e 'tell application \"Kiwi Control\" to quit' >/dev/null 2>&1 || true"], {
    encoding: "utf8"
  });
  spawnSync("zsh", ["-lc", "pkill -f 'Kiwi Control.app/Contents/MacOS/sj-ui' >/dev/null 2>&1 || true"], {
    encoding: "utf8"
  });
}

async function resolveCliUiTruthSource(cliUiResult) {
  if (cliUiResult.exitCode === 0 && cliUiResult.stdout.trim().startsWith("{")) {
    const payload = JSON.parse(cliUiResult.stdout.trim());
    if (payload.outputRoot) {
      return payload.outputRoot;
    }
  }

  const candidates = await listTmpDirs("kiwi-cli-ui-truth-");
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "summary.json"));
      return candidate;
    } catch {
      // keep scanning
    }
  }

  throw new Error("No successful kiwi-cli-ui-truth output directory was found.");
}

async function capturePublicHeaders(siteDir) {
  const targets = [
    ["public-home", "https://kiwi-control.kiwi-ai.in"],
    ["public-install", "https://kiwi-control.kiwi-ai.in/install"],
    ["public-downloads", "https://kiwi-control.kiwi-ai.in/downloads"]
  ];
  const headers = {};
  for (const [label, url] of targets) {
    const result = spawnSync("curl", ["-sS", "-D", "-", "-o", "/dev/null", url], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024
    });
    const text = (result.stdout ?? "").trim();
    headers[label] = {
      url,
      exitCode: result.status ?? 1,
      firstLine: text.split(/\r?\n/)[0] ?? ""
    };
    await fs.writeFile(path.join(siteDir, `${label}.headers.txt`), `${text}\n`, "utf8");
  }
  return headers;
}

async function captureSiteScreens(siteDir) {
  const playwright = spawnSync("which", ["playwright"], { encoding: "utf8" });
  if (playwright.status !== 0) {
    return {
      available: false,
      note: "playwright CLI not found"
    };
  }

  const server = await startStaticServer(path.join(repoRoot, "dist", "site"), 8765);
  try {
    const fallbacks = [
      [path.join(siteDir, "live-home.png"), "/tmp/kiwi-demo-site/home.png"],
      [path.join(siteDir, "live-install.png"), "/tmp/kiwi-demo-site/install.png"],
      [path.join(siteDir, "live-downloads.png"), "/tmp/kiwi-demo-site/downloads.png"],
      [path.join(siteDir, "local-home.png"), "/tmp/kiwi-demo-site-local/home-local.png"],
      [path.join(siteDir, "local-install.png"), "/tmp/kiwi-demo-site-local/install-local.png"],
      [path.join(siteDir, "local-downloads.png"), "/tmp/kiwi-demo-site-local/downloads-local.png"]
    ];
    await captureScreenshot("https://kiwi-control.kiwi-ai.in", path.join(siteDir, "live-home.png"), true);
    await captureScreenshot("https://kiwi-control.kiwi-ai.in/install", path.join(siteDir, "live-install.png"), true);
    await captureScreenshot("https://kiwi-control.kiwi-ai.in/downloads", path.join(siteDir, "live-downloads.png"), true);
    await captureScreenshot("http://127.0.0.1:8765/", path.join(siteDir, "local-home.png"), true);
    await captureScreenshot("http://127.0.0.1:8765/install/", path.join(siteDir, "local-install.png"), true);
    await captureScreenshot("http://127.0.0.1:8765/downloads/", path.join(siteDir, "local-downloads.png"), true);
    for (const [target, fallback] of fallbacks) {
      if (!(await fileExists(target)) && await fileExists(fallback)) {
        await copyIfExists(fallback, target);
      }
    }
    return {
      available: true,
      localBaseUrl: "http://127.0.0.1:8765/"
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function captureScreenshot(url, outputPath, allowFailure = false) {
  const result = spawnSync("playwright", ["screenshot", "--device=Desktop Chrome", url, outputPath], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  });
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`Failed to capture ${url}`);
  }
  await fs.writeFile(`${outputPath}.log.txt`, `${result.stdout ?? ""}${result.stderr ?? ""}`, "utf8");
}

function startStaticServer(rootDir, port) {
  const server = http.createServer(async (request, response) => {
    try {
      const reqPath = new URL(request.url ?? "/", `http://127.0.0.1:${port}`).pathname;
      const localPath = reqPath.endsWith("/")
        ? path.join(rootDir, reqPath, "index.html")
        : path.join(rootDir, reqPath);
      const safePath = path.normalize(localPath);
      if (!safePath.startsWith(rootDir)) {
        response.writeHead(403);
        response.end("forbidden");
        return;
      }
      const data = await fs.readFile(safePath);
      response.writeHead(200, { "content-type": contentTypeFor(safePath) });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function buildHighlights(currentRepoDir) {
  const status = JSON.parse(await fs.readFile(path.join(currentRepoDir, "status.stdout.txt"), "utf8"));
  const parity = JSON.parse(await fs.readFile(path.join(currentRepoDir, "parity.stdout.txt"), "utf8"));
  const graph = JSON.parse(await fs.readFile(path.join(currentRepoDir, "graph-build.stdout.txt"), "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(currentRepoDir, "review.stdout.txt"), "utf8"));
  return {
    repoState: status.repoState,
    executionState: {
      lifecycle: status.executionState.lifecycle,
      nextCommand: status.executionState.nextCommand,
      blockedBy: status.executionState.blockedBy
    },
    parity: {
      overallStatus: parity.overallStatus,
      boundaryNote: parity.boundaryNote
    },
    graph: {
      freshness: graph.graph.freshness,
      ready: graph.graph.ready,
      graphAuthorityPath: graph.graph.graphAuthorityPath,
      nodeCount: graph.graph.nodeCount,
      edgeCount: graph.graph.edgeCount
    },
    review: {
      summary: review.summary,
      likelyMissingValidation: review.likelyMissingValidation,
      reviewerHandoff: review.reviewerHandoff
    }
  };
}

async function createCurrentRepoAliases(currentRepoDir) {
  const aliases = [
    ["status.stdout.txt", "status.json"],
    ["setup-status.stdout.txt", "setup-status.json"],
    ["setup-verify.stdout.txt", "setup-verify.json"],
    ["parity.stdout.txt", "parity.json"],
    ["graph-build.stdout.txt", "graph-build.json"],
    ["graph-status.stdout.txt", "graph-status.json"],
    ["pack-status.stdout.txt", "pack-status.json"],
    ["guide.stdout.txt", "guide.json"],
    ["repo-map.stdout.txt", "repo-map.json"],
    ["agent-pack-review.stdout.txt", "agent-pack-review.json"],
    ["review.stdout.txt", "review.json"]
  ];

  for (const [from, to] of aliases) {
    await copyIfExists(path.join(currentRepoDir, from), path.join(currentRepoDir, to));
  }
}

async function listTmpDirs(prefix) {
  const entries = await fs.readdir(os.tmpdir(), { withFileTypes: true }).catch(() => []);
  const matches = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(prefix)) {
      matches.push(path.join(os.tmpdir(), entry.name));
    }
  }
  matches.sort((a, b) => b.localeCompare(a));
  return matches;
}

function newestNewDir(before, after) {
  const previous = new Set(before);
  return after.find((entry) => !previous.has(entry)) ?? null;
}

async function copyTree(source, destination) {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true });
}

async function copyIfExists(source, destination) {
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true, force: true });
  } catch {
    // best-effort demo capture
  }
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
