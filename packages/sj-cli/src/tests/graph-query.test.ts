import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { bootstrapTarget } from "@shrey-junior/sj-core/core/bootstrap.js";
import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { runRepoMap } from "../commands/repo-map.js";
import { runGraphQuery } from "../commands/graph-query.js";
import { runGraph } from "../commands/graph.js";
import { repoRoot } from "./helpers/desktop-launch.js";

test("graph-query exposes compact file, symbol, neighbor, impact, and module summaries", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-graph-query-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(path.join(target, "src", "auth"), { recursive: true });
  await fs.mkdir(path.join(target, "src", "web"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "graph-query-fixture"\n}\n', "utf8");
  await fs.writeFile(
    path.join(target, "src", "auth", "helper.ts"),
    'export function helper() { return 1; }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(target, "src", "auth", "main.ts"),
    'import { helper } from "./helper.js";\nexport function login() { return helper(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(target, "src", "web", "route.ts"),
    'import { login } from "../auth/main.js";\nexport function route() { return login(); }\n',
    "utf8"
  );

  await runCommand("git", ["init"], target);
  await runCommand("git", ["add", "."], target);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], target);

  await bootstrapTarget({ repoRoot: repoRootPath, targetRoot: target }, config);
  await fs.writeFile(
    path.join(target, "src", "auth", "helper.ts"),
    'export function helper() { return 2; }\n',
    "utf8"
  );

  await runRepoMap({
    repoRoot: repoRootPath,
    targetRoot: target,
    changed: true,
    task: "fix auth helper behavior",
    json: true,
    logger: {
      info() {},
      warn() {},
      error() {}
    } as never
  });

  const capture = async (options: Omit<Parameters<typeof runGraphQuery>[0], "logger">) => {
    const lines: string[] = [];
    const exitCode = await runGraphQuery({
      ...options,
      logger: {
        info(message: string) {
          lines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    return {
      exitCode,
      payload: JSON.parse(lines.join("\n")) as Record<string, unknown>
    };
  };

  const fileQuery = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    file: "src/auth/helper.ts",
    json: true
  });
  assert.equal(fileQuery.exitCode, 0);
  const filePayload = fileQuery.payload.file as {
    file: string;
    moduleGroup: string;
    importedBy: string[];
    impact: { changed: boolean; score: number } | null;
  };
  assert.equal(filePayload.file, "src/auth/helper.ts");
  assert.equal(filePayload.moduleGroup, "src/auth");
  assert.ok(filePayload.importedBy.includes("src/auth/main.ts"));
  assert.equal(filePayload.impact?.changed, true);

  const symbolQuery = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    symbol: "helper",
    json: true
  });
  const symbolPayload = symbolQuery.payload.symbol as {
    matches: Array<{ file: string; kind: string }>;
  };
  assert.ok(symbolPayload.matches.some((entry) => entry.file === "src/auth/helper.ts" && entry.kind === "export"));

  const neighborsQuery = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    neighbors: "src/auth/main.ts",
    json: true
  });
  const neighborsPayload = neighborsQuery.payload.neighbors as {
    targetKind: string;
    imports: string[];
    importedBy: string[];
  };
  assert.equal(neighborsPayload.targetKind, "file");
  assert.ok(neighborsPayload.imports.includes("src/auth/helper.ts"));
  assert.ok(neighborsPayload.importedBy.includes("src/web/route.ts"));

  const impactQuery = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    impact: "src/auth/helper.ts",
    json: true
  });
  const impactPayload = impactQuery.payload.impact as {
    targetKind: string;
    rankedFiles: Array<{ file: string; score: number }>;
  };
  assert.equal(impactPayload.targetKind, "file");
  assert.ok(impactPayload.rankedFiles.some((entry) => entry.file === "src/auth/helper.ts" && entry.score > 0));

  const moduleQuery = await capture({
    repoRoot: repoRootPath,
    targetRoot: target,
    module: "src/auth",
    json: true
  });
  const modulePayload = moduleQuery.payload.module as {
    module: string;
    files: string[];
    imports: string[];
    importedBy: string[];
  };
  assert.equal(modulePayload.module, "src/auth");
  assert.ok(modulePayload.files.includes("src/auth/helper.ts"));
  assert.ok(modulePayload.files.includes("src/auth/main.ts"));
  assert.ok(modulePayload.importedBy.includes("src/web"));
});

test("graph module resolution prefers explicit aliases and surfaces ambiguity without guessing", async () => {
  const repoRootPath = repoRoot();
  const config = await loadCanonicalConfig(repoRootPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-graph-alias-"));
  const target = path.join(tempDir, "repo");
  await fs.mkdir(path.join(target, "packages", "core", "src"), { recursive: true });
  await fs.mkdir(path.join(target, "core", "src"), { recursive: true });
  await fs.mkdir(path.join(target, ".agent", "context"), { recursive: true });
  await fs.writeFile(path.join(target, "package.json"), '{\n  "name": "graph-alias-fixture"\n}\n', "utf8");
  await fs.writeFile(path.join(target, "packages", "core", "src", "main.ts"), "export const alpha = 1;\n", "utf8");
  await fs.writeFile(path.join(target, "core", "src", "main.ts"), "export const beta = 1;\n", "utf8");
  await fs.writeFile(
    path.join(target, ".agent", "context", "graph-aliases.json"),
    JSON.stringify({
      modules: {
        platform: "packages/core"
      }
    }, null, 2) + "\n",
    "utf8"
  );

  await runCommand("git", ["init"], target);
  await runCommand("git", ["add", "."], target);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], target);

  await bootstrapTarget({ repoRoot: repoRootPath, targetRoot: target }, config);
  await runGraph({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "build",
    logger: {
      info() {},
      warn() {},
      error() {}
    } as never
  });

  const captureGraph = async (value: string) => {
    const lines: string[] = [];
    const exitCode = await runGraph({
      repoRoot: repoRootPath,
      targetRoot: target,
      action: "module",
      value,
      json: true,
      logger: {
        info(message: string) {
          lines.push(message);
        },
        warn() {},
        error() {}
      } as never
    });
    return {
      exitCode,
      payload: JSON.parse(lines.join("\n")) as Record<string, unknown>
    };
  };

  const explicit = await captureGraph("platform");
  assert.equal(explicit.exitCode, 0);
  const explicitResolution = explicit.payload.queryResolution as {
    resolution: string;
    resolvedModuleId: string;
    score: number;
  };
  assert.equal(explicitResolution.resolution, "explicit");
  assert.equal(explicitResolution.resolvedModuleId, "packages/core");
  assert.ok(explicitResolution.score > 0);

  const canonical = await captureGraph("packages/core");
  const canonicalResolution = canonical.payload.queryResolution as {
    resolution: string;
    resolvedModuleId: string;
  };
  assert.equal(canonicalResolution.resolution, "canonical-id");
  assert.equal(canonicalResolution.resolvedModuleId, "packages/core");

  const statusLines: string[] = [];
  await runGraph({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "status",
    json: true,
    logger: {
      info(message: string) {
        statusLines.push(message);
      },
      warn() {},
      error() {}
    } as never
  });
  const statusPayload = JSON.parse(statusLines.join("\n")) as {
    graph: { explicitAliasSourceAvailable: boolean };
  };
  assert.equal(statusPayload.graph.explicitAliasSourceAvailable, true);

  await fs.rm(path.join(target, ".agent", "context", "graph-aliases.json"));
  await runGraph({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "build",
    logger: {
      info() {},
      warn() {},
      error() {}
    } as never
  });

  const ambiguousLines: string[] = [];
  const ambiguousExit = await runGraph({
    repoRoot: repoRootPath,
    targetRoot: target,
    action: "module",
    value: "ore",
    json: true,
    logger: {
      info(message: string) {
        ambiguousLines.push(message);
      },
      warn() {},
      error() {}
    } as never
  }).catch((error: Error) => {
    ambiguousLines.push(error.message);
    return 1;
  });
  assert.equal(ambiguousExit, 1);
  assert.match(ambiguousLines.join("\n"), /ambiguous module alias/i);
});
