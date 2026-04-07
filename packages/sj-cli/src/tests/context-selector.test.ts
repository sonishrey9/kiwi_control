import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runCommand } from "@shrey-junior/sj-core/utils/child-process.js";
import { contextSelector } from "@shrey-junior/sj-core/core/context-selector.js";
import { pathExists, readJson } from "@shrey-junior/sj-core/utils/fs.js";

test("context selector returns empty include for clean repos with no recent files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-clean-"));
  await runCommand("git", ["init"], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "--allow-empty", "-m", "init"], tempDir);

  const result = await contextSelector("fix auth bug", tempDir);

  assert.ok(Array.isArray(result.include));
  assert.ok(Array.isArray(result.exclude));
  assert.ok(typeof result.reason === "string");
  assert.ok(result.reason.length > 0);
});

test("context selector includes changed files with highest priority", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-dirty-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "auth.ts"), "export function login() {}\n", "utf8");
  await fs.writeFile(path.join(tempDir, "utils.ts"), "export function hash() {}\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(path.join(tempDir, "auth.ts"), "export function login() { return true; }\n", "utf8");

  const result = await contextSelector("fix login", tempDir);

  assert.ok(result.include.length > 0);
  assert.ok(
    result.include.includes("auth.ts"),
    `Expected auth.ts in include list, got: ${result.include.join(", ")}`
  );
  assert.ok(result.signals.changedFiles.includes("auth.ts"));
});

test("context selector finds import neighbors", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-imports-"));
  await runCommand("git", ["init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "helper.ts"),
    "export function helper() { return 42; }\n",
    "utf8"
  );
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper() + 1; }\n',
    "utf8"
  );

  const result = await contextSelector("update run function", tempDir);

  assert.ok(result.signals.changedFiles.includes("main.ts"));
  assert.ok(
    result.signals.importNeighbors.some((f) => f.includes("helper")),
    `Expected helper in import neighbors, got: ${result.signals.importNeighbors.join(", ")}`
  );
});

test("context selector uses the incremental import index to surface reverse dependents of changed files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-impact-"));
  await runCommand("git", ["init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "helper.ts"),
    "export function helper() { return 42; }\n",
    "utf8"
  );
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await contextSelector("inspect helper impact", tempDir);
  await fs.writeFile(
    path.join(tempDir, "helper.ts"),
    "export function helper() { return 43; }\n",
    "utf8"
  );

  const result = await contextSelector("fix helper behavior", tempDir);

  assert.ok(result.signals.changedFiles.includes("helper.ts"));
  assert.ok(
    result.signals.importNeighbors.includes("main.ts"),
    `Expected main.ts as a reverse dependent, got: ${result.signals.importNeighbors.join(", ")}`
  );
  assert.equal(result.signals.dependencyDistances?.["main.ts"], 1);
  assert.deepEqual(result.signals.dependencyChains?.["main.ts"], ["helper.ts", "main.ts"]);
});

test("context selector persists worktree and selection state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-persist-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "app.ts"), "console.log('hi');\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);

  await contextSelector("build feature", tempDir);

  const worktreePath = path.join(tempDir, ".agent", "state", "worktree.json");
  const selectionPath = path.join(tempDir, ".agent", "state", "context-selection.json");
  const contextTracePath = path.join(tempDir, ".agent", "state", "context-trace.json");
  const indexingPath = path.join(tempDir, ".agent", "state", "indexing.json");
  const contextIndexPath = path.join(tempDir, ".agent", "state", "context-index.json");

  assert.ok(await pathExists(worktreePath), "worktree.json should be persisted");
  assert.ok(await pathExists(selectionPath), "context-selection.json should be persisted");
  assert.ok(await pathExists(contextTracePath), "context-trace.json should be persisted");
  assert.ok(await pathExists(indexingPath), "indexing.json should be persisted");
  assert.ok(await pathExists(contextIndexPath), "context-index.json should be persisted");

  const worktree = await readJson<{ artifactType: string; dirty: boolean }>(worktreePath);
  assert.equal(worktree.artifactType, "kiwi-control/worktree");
  assert.equal(worktree.dirty, true);

  const selection = await readJson<{ artifactType: string; task: string; version: number }>(selectionPath);
  assert.equal(selection.artifactType, "kiwi-control/context-selection");
  assert.equal(selection.task, "build feature");
  assert.equal(selection.version, 3);

  const trace = await readJson<{
    artifactType: string;
    fileAnalysis: { selectedFiles: number; scannedFiles: number };
    expansionSteps: Array<{ step: string }>;
  }>(contextTracePath);
  assert.equal(trace.artifactType, "kiwi-control/context-trace");
  assert.ok(trace.fileAnalysis.scannedFiles >= trace.fileAnalysis.selectedFiles);
  assert.ok(trace.expansionSteps.length > 0);

  const indexing = await readJson<{
    artifactType: string;
    analyzedFiles: number;
    totalFiles: number;
    ignoreRulesApplied: string[];
    indexedFiles?: number;
  }>(indexingPath);
  assert.equal(indexing.artifactType, "kiwi-control/indexing");
  assert.ok(indexing.totalFiles >= indexing.analyzedFiles);
  assert.equal(Array.isArray(indexing.ignoreRulesApplied), true);
  assert.equal((indexing.indexedFiles ?? 0) >= 0, true);

  const contextIndex = await readJson<{
    artifactType: string;
    indexedFiles: number;
    updatedFiles: string[];
    reusedFiles: number;
    files: Array<{
      file: string;
      imports: string[];
      exports: string[];
      localFunctions: string[];
      calledSymbols: string[];
      importCallTargets: string[];
      relationships: string[];
    }>;
    lastImpact: {
      impactedFiles: string[];
      dependencyDistances: Record<string, number>;
      dependencyChains: Record<string, string[]>;
    };
  }>(contextIndexPath);
  assert.equal(contextIndex.artifactType, "kiwi-control/context-index");
  assert.ok(contextIndex.indexedFiles >= 0);
  assert.equal(Array.isArray(contextIndex.updatedFiles), true);
  assert.ok(typeof contextIndex.reusedFiles === "number");
  assert.equal(Array.isArray(contextIndex.lastImpact.impactedFiles), true);
  assert.equal(Array.isArray(contextIndex.files), true);
  assert.equal(Array.isArray(contextIndex.files[0]?.imports ?? []), true);
  assert.equal(Array.isArray(contextIndex.files[0]?.exports ?? []), true);
  assert.equal(Array.isArray(contextIndex.files[0]?.localFunctions ?? []), true);
  assert.equal(Array.isArray(contextIndex.files[0]?.calledSymbols ?? []), true);
  assert.equal(Array.isArray(contextIndex.files[0]?.relationships ?? []), true);
  assert.equal(typeof contextIndex.lastImpact.dependencyDistances, "object");
  assert.equal(typeof contextIndex.lastImpact.dependencyChains, "object");
});

test("context trace records why files were selected and the dependency chain when structural signals apply", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-trace-deps-"));
  await runCommand("git", ["init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "main.ts"),
    'import { helper } from "./helper.js";\nexport function run() { return helper(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "helper.ts"),
    "export function helper() { return 42; }\n",
    "utf8"
  );
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "helper.ts"),
    "export function helper() { return 43; }\n",
    "utf8"
  );

  await contextSelector("fix helper behavior", tempDir);

  const trace = await readJson<{
    fileAnalysis: {
      selected: Array<{
        file: string;
        selectionWhy?: string;
        dependencyChain?: string[];
      }>;
    };
  }>(path.join(tempDir, ".agent", "state", "context-trace.json"));

  const dependent = trace.fileAnalysis.selected.find((entry) => entry.file === "main.ts");
  assert.ok(dependent, "Expected main.ts to be selected as a structural dependent");
  assert.match(dependent?.selectionWhy ?? "", /Dependency chain:/);
  assert.deepEqual(dependent?.dependencyChain, ["helper.ts", "main.ts"]);
});

test("context selector excludes node_modules and generated output paths", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-exclude-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, "node_modules", "lib"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "dist-types"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "apps", "sj-ui", "dist-types"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "node_modules", "lib", "index.js"), "module.exports = {};\n", "utf8");
  await fs.writeFile(path.join(tempDir, "dist-types", "bundle.js"), "export const bundle = true;\n", "utf8");
  await fs.writeFile(path.join(tempDir, "apps", "sj-ui", "dist-types", "main.js"), "export const generated = true;\n", "utf8");
  await fs.writeFile(path.join(tempDir, "src.ts"), "export const x = 1;\n", "utf8");
  await runCommand("git", ["add", "src.ts"], tempDir);

  const result = await contextSelector("update x", tempDir);

  const hasNodeModules = result.include.some((f) => f.includes("node_modules"));
  const hasDistTypes = result.include.some((f) => f.includes("dist-types"));
  assert.equal(hasNodeModules, false, "node_modules files should never be in include list");
  assert.equal(hasDistTypes, false, "generated dist-types files should never be in include list");
});

test("context selector includes selective repo-local .agent state without scanning the full .agent tree", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-agent-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, ".agent", "memory"), { recursive: true });
  await fs.mkdir(path.join(tempDir, ".agent", "state", "checkpoints"), { recursive: true });
  await fs.mkdir(path.join(tempDir, ".agent", "tasks"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "app.ts"), "export const app = true;\n", "utf8");
  await fs.writeFile(path.join(tempDir, ".agent", "memory", "current-focus.json"), '{"currentFocus":"fix app"}\n', "utf8");
  await fs.writeFile(path.join(tempDir, ".agent", "memory", "open-risks.json"), '{"risks":["scope drift"]}\n', "utf8");
  await fs.writeFile(path.join(tempDir, ".agent", "memory", "repo-facts.json"), '{"projectName":"agent-test"}\n', "utf8");
  await fs.writeFile(path.join(tempDir, ".agent", "state", "checkpoints", "latest.json"), '{"phase":"latest"}\n', "utf8");
  await fs.writeFile(path.join(tempDir, ".agent", "tasks", "noise.json"), '{"noise":true}\n', "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);
  await fs.writeFile(path.join(tempDir, "app.ts"), "export const app = false;\n", "utf8");

  const result = await contextSelector("fix app focus", tempDir);

  assert.ok(result.signals.repoContextFiles.includes(".agent/memory/current-focus.json"));
  assert.ok(result.signals.repoContextFiles.includes(".agent/memory/open-risks.json"));
  assert.ok(result.signals.repoContextFiles.includes(".agent/memory/repo-facts.json"));
  assert.ok(result.signals.repoContextFiles.includes(".agent/state/checkpoints/latest.json"));
  assert.equal(result.include.some((file) => file.startsWith(".agent/tasks/")), false);
});

test("context selector is constrained by token budget instead of a fixed 30-file cap", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-budget-"));
  await runCommand("git", ["init"], tempDir);

  for (let index = 0; index < 35; index += 1) {
    await fs.writeFile(path.join(tempDir, `file-${index}.ts`), `export const value${index} = ${index};\n`, "utf8");
  }

  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  for (let index = 0; index < 35; index += 1) {
    await fs.writeFile(path.join(tempDir, `file-${index}.ts`), `export const value${index} = ${index + 1};\n`, "utf8");
  }

  const result = await contextSelector("update implementation values", tempDir);

  assert.ok(result.include.length >= 35, `Expected at least 35 files in scope, got ${result.include.length}`);
});

test("context selector discovers relevant files in deep nested repos without shallow depth limits", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-deep-"));
  await runCommand("git", ["init"], tempDir);

  const authDir = path.join(tempDir, "packages", "app", "src", "features", "auth", "flows", "magic-link");
  const marketingDir = path.join(tempDir, "packages", "site", "src", "pages", "marketing");
  await fs.mkdir(authDir, { recursive: true });
  await fs.mkdir(marketingDir, { recursive: true });

  await fs.writeFile(path.join(authDir, "login-handler.ts"), "export function loginHandler() { return 'ok'; }\n", "utf8");
  await fs.writeFile(path.join(authDir, "token-service.ts"), "export function issueToken() { return 'token'; }\n", "utf8");
  await fs.writeFile(path.join(marketingDir, "home.ts"), "export function homePage() { return 'home'; }\n", "utf8");

  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  const result = await contextSelector("fix auth login handler token flow", tempDir);

  assert.ok(
    result.include.includes("packages/app/src/features/auth/flows/magic-link/login-handler.ts"),
    `Expected deep auth file in include list, got: ${result.include.join(", ")}`
  );
  assert.ok(
    result.signals.keywordMatches.includes("packages/app/src/features/auth/flows/magic-link/login-handler.ts"),
    `Expected deep auth file in keyword matches, got: ${result.signals.keywordMatches.join(", ")}`
  );
});

test("context selector keeps narrow docs tasks focused on docs instead of passive config noise", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-docs-precision-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "README.md"), "# Project\n", "utf8");
  await fs.writeFile(path.join(tempDir, "AGENTS.md"), "Only modify docs files for docs tasks.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "CLAUDE.md"), "General assistant guidance.\n", "utf8");
  await fs.writeFile(path.join(tempDir, "package.json"), '{"name":"docs-precision"}\n', "utf8");
  await fs.writeFile(path.join(tempDir, "src", "app.ts"), "export const app = true;\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(path.join(tempDir, "README.md"), "# Project\n\nUpdated docs.\n", "utf8");

  const result = await contextSelector("update README docs", tempDir);
  const repoFiles = result.include.filter((file) => !file.startsWith(".agent/"));

  assert.ok(result.include.includes("README.md"), `Expected README.md in include list, got: ${result.include.join(", ")}`);
  assert.equal(result.include.includes("package.json"), false, "package.json should not be included for narrow docs tasks");
  assert.equal(result.include.includes("src/app.ts"), false, "application files should not be included for narrow docs tasks");
  assert.deepEqual(repoFiles, ["README.md"]);
});

test("context selector uses repo-local skills to influence task matching", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-skills-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, ".agent", "skills"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "README.md"), "# Project handbook\n", "utf8");
  await fs.writeFile(path.join(tempDir, "src.ts"), "export const code = true;\n", "utf8");
  await fs.writeFile(
    path.join(tempDir, ".agent", "skills", "docs-playbook.md"),
    [
      "# Docs Playbook",
      "",
      "## Description",
      "Use this skill when the task is about docs, handbook copy, or README wording.",
      "",
      "## Trigger Conditions",
      "- docs",
      "- handbook",
      "- README",
      "- wording",
      "",
      "## Execution Template",
      "- Prefer documentation files before code files.",
      "- Keep docs tasks tightly scoped to docs.",
      ""
    ].join("\n"),
    "utf8"
  );
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  const result = await contextSelector("polish handbook wording", tempDir);

  assert.ok(
    result.include.includes("README.md"),
    `Expected README.md in include list when docs skill is active, got: ${result.include.join(", ")}`
  );
  const skillRegistry = await readJson<{ activeSkills: Array<{ skillId: string }> }>(
    path.join(tempDir, ".agent", "state", "skills-registry.json")
  );
  assert.equal(skillRegistry.activeSkills.some((skill) => skill.skillId === "docs-playbook"), true);
});

test("skills registry limits matching to at most two active and two suggested skills", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-skills-limit-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, ".agent", "skills"), { recursive: true });

  const skillNames = [
    ["docs-playbook", "Docs Playbook"],
    ["readme-helper", "README Helper"],
    ["docs-grammar", "Docs Grammar"],
    ["docs-style", "Docs Style"]
  ];

  for (const [fileName, title] of skillNames) {
    await fs.writeFile(
      path.join(tempDir, ".agent", "skills", `${fileName}.md`),
      [
        `# ${title}`,
        "",
        "## Description",
        "Use for docs and README tasks.",
        "",
        "## Trigger Conditions",
        "- docs",
        "- README",
        "- wording",
        "",
        "## Execution Template",
        "- Prefer docs files before code files.",
        ""
      ].join("\n"),
      "utf8"
    );
  }

  const { matchSkillsForTask } = await import("@shrey-junior/sj-core/core/skills-registry.js");
  const registry = await matchSkillsForTask(tempDir, "update README docs wording");

  assert.ok(registry.activeSkills.length <= 2, `expected <= 2 active skills, got ${registry.activeSkills.length}`);
  assert.ok(registry.suggestedSkills.length <= 2, `expected <= 2 suggested skills, got ${registry.suggestedSkills.length}`);
});

test("context selector scopes implementation tasks to the relevant source directory", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-src-scope-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, "src", "auth"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "src", "marketing"), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, "src", "auth", "login.ts"),
    'import { issueToken } from "./token.ts";\nexport function loginUser() { return issueToken(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "src", "auth", "token.ts"),
    "export function issueToken() { return 'token'; }\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "src", "marketing", "home.ts"),
    "export function homePage() { return 'home'; }\n",
    "utf8"
  );
  await fs.writeFile(path.join(tempDir, "README.md"), "# Project\n", "utf8");
  await fs.writeFile(path.join(tempDir, "AGENTS.md"), "General project rules.\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "src", "auth", "login.ts"),
    'import { issueToken } from "./token.ts";\nexport function loginUser() { return issueToken() + "-updated"; }\n',
    "utf8"
  );

  const result = await contextSelector("fix auth login token flow", tempDir);
  const repoFiles = result.include.filter((file) => !file.startsWith(".agent/"));

  assert.ok(repoFiles.includes("src/auth/login.ts"));
  assert.ok(repoFiles.includes("src/auth/token.ts"));
  assert.equal(repoFiles.some((file) => file.startsWith("src/marketing/")), false, "unrelated source directories should be excluded");
  assert.equal(repoFiles.includes("README.md"), false, "docs should not be included for implementation tasks");
  assert.ok(repoFiles.every((file) => file.startsWith("src/")), `Expected only src files, got: ${repoFiles.join(", ")}`);
});

test("context selector downgrades confidence when evidence is shallow and narrow", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-confidence-low-"));
  await runCommand("git", ["init"], tempDir);
  await fs.writeFile(path.join(tempDir, "auth.ts"), "export function authHelper() { return true; }\n", "utf8");
  await fs.writeFile(path.join(tempDir, "billing.ts"), "export function charge() { return true; }\n", "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  const result = await contextSelector("fix auth helper", tempDir);

  assert.equal(result.confidence, "low");
});

test("context selector raises confidence only when multiple strong signals agree", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-ctx-confidence-high-"));
  await runCommand("git", ["init"], tempDir);
  await fs.mkdir(path.join(tempDir, "src", "auth"), { recursive: true });
  await fs.mkdir(path.join(tempDir, ".agent", "memory"), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, "src", "auth", "login.ts"),
    'import { issueToken } from "./token.ts";\nexport function loginUser() { return issueToken(); }\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(tempDir, "src", "auth", "token.ts"),
    "export function issueToken() { return 'token'; }\n",
    "utf8"
  );
  await fs.writeFile(path.join(tempDir, ".agent", "memory", "current-focus.json"), '{"currentFocus":"fix auth login token flow"}\n', "utf8");
  await runCommand("git", ["add", "."], tempDir);
  await runCommand("git", ["-c", "user.name=test", "-c", "user.email=test@test.com", "commit", "-m", "init"], tempDir);

  await fs.writeFile(
    path.join(tempDir, "src", "auth", "login.ts"),
    'import { issueToken } from "./token.ts";\nexport function loginUser() { return issueToken() + "-updated"; }\n',
    "utf8"
  );

  const result = await contextSelector("fix auth login token flow", tempDir);

  assert.equal(result.confidence, "high");
  assert.ok(result.reason.includes("Diversity:"));
  assert.ok(result.reason.includes("Coverage:"));
});
