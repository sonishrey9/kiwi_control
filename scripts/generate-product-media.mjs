#!/usr/bin/env node
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "apps", "sj-ui", "dist");
const previewDir = path.join(distDir, "preview");
const mediaDir = path.join(repoRoot, "docs", "media");
const cliEntrypoint = path.join(repoRoot, "packages", "sj-cli", "dist", "cli.js");
const rootPackage = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

await main();

async function main() {
  await fs.access(path.join(distDir, "index.html")).catch(() => {
    throw new Error("Built desktop web assets were not found. Run `npm run build` first.");
  });

  await execFileAsync("npx", ["playwright", "--version"], { cwd: repoRoot });

  const readyState = await loadUiJson(repoRoot);
  const onboardingState = buildOnboardingPreviewState(readyState);

  await fs.rm(previewDir, { recursive: true, force: true });
  await fs.mkdir(previewDir, { recursive: true });
  await fs.mkdir(mediaDir, { recursive: true });

  await fs.writeFile(
    path.join(previewDir, "overview.json"),
    JSON.stringify({
      state: readyState,
      runtimeInfo: buildInstalledRuntimeInfo({ cliInstalled: true }),
      activeView: "overview"
    }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(previewDir, "graph.json"),
    JSON.stringify({
      state: readyState,
      runtimeInfo: buildInstalledRuntimeInfo({ cliInstalled: true }),
      activeView: "graph"
    }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(previewDir, "machine.json"),
    JSON.stringify({
      state: readyState,
      runtimeInfo: buildInstalledRuntimeInfo({ cliInstalled: true }),
      activeView: "machine"
    }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(previewDir, "onboarding.json"),
    JSON.stringify({
      state: onboardingState,
      runtimeInfo: buildInstalledRuntimeInfo({ cliInstalled: false }),
      activeView: "overview"
    }, null, 2),
    "utf8"
  );

  const server = await startStaticServer(distDir);
  try {
    await captureScreenshot({
      server,
      preview: "overview",
      waitForSelector: '[data-render-section="guided-operation"]',
      outputPath: path.join(mediaDir, "kiwi-overview.png")
    });
    await captureScreenshot({
      server,
      preview: "graph",
      waitForSelector: "[data-graph-canvas-root]",
      outputPath: path.join(mediaDir, "kiwi-graph.png")
    });
    await captureScreenshot({
      server,
      preview: "machine",
      waitForSelector: '[data-render-section="machine-setup-readiness"]',
      outputPath: path.join(mediaDir, "kiwi-machine.png")
    });
    await captureScreenshot({
      server,
      preview: "onboarding",
      waitForSelector: '[data-render-section="onboarding"]',
      outputPath: path.join(mediaDir, "kiwi-onboarding.png")
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`Generated product media in ${mediaDir}`);
}

async function loadUiJson(targetRoot) {
  const { stdout } = await execFileAsync(process.execPath, [cliEntrypoint, "ui", "--json", "--target", targetRoot], {
    cwd: repoRoot,
    maxBuffer: 20 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

function buildInstalledRuntimeInfo({ cliInstalled }) {
  return {
    appVersion: rootPackage.version,
    bundleId: "com.kiwicontrol.desktop",
    executablePath: "/Applications/Kiwi Control.app/Contents/MacOS/Kiwi Control",
    buildSource: "installed-bundle",
    runtimeMode: "installed-user",
    receiptPath: path.join(os.homedir(), ".kiwi-control", "desktop-install.json"),
    cli: {
      bundledInstallerAvailable: true,
      bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
      installBinDir: process.platform === "win32"
        ? "%USERPROFILE%\\.kiwi-control\\bin"
        : path.join(os.homedir(), ".local", "bin"),
      installed: cliInstalled,
      installedCommandPath: cliInstalled
        ? (process.platform === "win32"
            ? "%USERPROFILE%\\.kiwi-control\\bin\\kc.cmd"
            : path.join(os.homedir(), ".local", "bin", "kc"))
        : null
    }
  };
}

function buildOnboardingPreviewState(baseState) {
  const state = structuredClone(baseState);
  state.targetRoot = "";
  state.loadState = {
    source: "bridge-fallback",
    freshness: "failed",
    generatedAt: new Date().toISOString(),
    snapshotSavedAt: null,
    snapshotAgeMs: null,
    detail: "No repo is loaded yet."
  };
  state.repoState = {
    mode: "bridge-unavailable",
    title: "Open a repo",
    detail: "Choose a repo and install kc to start using Kiwi Control like a normal desktop product.",
    sourceOfTruthNote: "Repo-local artifacts remain authoritative."
  };
  state.repoOverview = [
    { label: "Project type", value: "no repo loaded" },
    { label: "Active role", value: "none recorded" },
    { label: "Next file", value: "choose a repo" },
    { label: "Next command", value: "install kc" },
    { label: "Validation state", value: "waiting for repo" },
    { label: "Current phase", value: "first launch" }
  ];
  state.continuity = [
    { label: "Latest checkpoint", value: "none recorded" },
    { label: "Latest handoff", value: "none recorded" },
    { label: "Latest reconcile", value: "none recorded" },
    { label: "Current focus", value: "install kc and open a repo" },
    { label: "Open risks", value: "No repo is loaded yet.", tone: "warn" }
  ];
  state.validation = { ok: false, errors: 0, warnings: 1, issues: [] };
  return state;
}

async function captureScreenshot({ server, preview, waitForSelector, outputPath }) {
  const url = `http://127.0.0.1:${server.address().port}/?preview=${preview}&fixture=/preview/${preview}.json`;
  await execFileAsync(
    "npx",
    [
      "playwright",
      "screenshot",
      "--browser",
      "chromium",
      "--viewport-size",
      "1440,1024",
      "--color-scheme",
      "dark",
      "--wait-for-selector",
      waitForSelector,
      "--wait-for-timeout",
      "1200",
      url,
      outputPath
    ],
    { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 }
  );
}

async function startStaticServer(rootDir) {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
      const filePath = path.join(rootDir, pathname);
      const candidate = await resolveServedPath(rootDir, filePath);
      const content = await fs.readFile(candidate);
      response.writeHead(200, { "Content-Type": contentTypeFor(candidate) });
      response.end(content);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function resolveServedPath(rootDir, candidatePath) {
  const normalizedRoot = path.resolve(rootDir);
  const normalizedCandidate = path.resolve(candidatePath);
  if (!normalizedCandidate.startsWith(normalizedRoot)) {
    throw new Error("Path outside preview root");
  }

  const stat = await fs.stat(normalizedCandidate);
  if (stat.isDirectory()) {
    return path.join(normalizedCandidate, "index.html");
  }
  return normalizedCandidate;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}
