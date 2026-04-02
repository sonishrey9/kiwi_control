import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { isMetadataOnlyPath, isSensitivePath, redactText, summarizeObjectKeys } from "../utils/redact.js";
import { pathExists, readJson, readText } from "../utils/fs.js";

export interface InventoryRow {
  path: string;
  ownerTool: string;
  purpose: string;
  safeToIngestDirectly: boolean;
  recommendedTreatment: "import" | "reference" | "ignore" | "migrate";
  active: boolean;
  details: string[];
}

export interface DiscoveryReport {
  generatedAt: string;
  targetRoot: string;
  rows: InventoryRow[];
  conflicts: string[];
  risks: string[];
}

const HOME_SURFACES = [
  {
    filePath: path.join(os.homedir(), ".codex", "AGENTS.md"),
    ownerTool: "Codex",
    purpose: "global engineering contract",
    safeToIngestDirectly: true,
    recommendedTreatment: "import" as const
  },
  {
    filePath: path.join(os.homedir(), ".claude", "settings.json"),
    ownerTool: "Claude",
    purpose: "global hooks and permissions",
    safeToIngestDirectly: false,
    recommendedTreatment: "reference" as const
  },
  {
    filePath: path.join(os.homedir(), ".claude", "ecc", "mcp-configs", "mcp-servers.json"),
    ownerTool: "Claude/ECC",
    purpose: "sanitized MCP registry shape",
    safeToIngestDirectly: false,
    recommendedTreatment: "reference" as const
  },
  {
    filePath: path.join(os.homedir(), ".claude", "ecc", "hooks", "hooks.json"),
    ownerTool: "Claude/ECC",
    purpose: "hook lifecycle model",
    safeToIngestDirectly: false,
    recommendedTreatment: "reference" as const
  },
  {
    filePath: path.join(os.homedir(), "Library", "Application Support", "Code", "User", "settings.json"),
    ownerTool: "VS Code / Copilot",
    purpose: "user-level chat and Copilot settings",
    safeToIngestDirectly: false,
    recommendedTreatment: "reference" as const
  }
] as const;

const REPO_SURFACE_NAMES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "copilot-instructions.md",
  "settings.local.json",
  "launch.json",
  "project.yaml",
  "checks.yaml"
]);

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  ".venv",
  "venv",
  "target",
  "workspaceStorage",
  "sessions"
]);

export async function auditEnvironment(targetRoot: string): Promise<DiscoveryReport> {
  const rows = [
    ...(await scanKnownHomeSurfaces()),
    ...(await scanTargetRepo(targetRoot))
  ];

  return {
    generatedAt: new Date().toISOString(),
    targetRoot,
    rows,
    conflicts: buildConflicts(rows),
    risks: buildRisks(rows)
  };
}

export function renderDiscoveryMarkdown(report: DiscoveryReport): string {
  const lines = [
    "# Sanitized Discovery Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Target root: \`${report.targetRoot}\``,
    "",
    "## Inventory",
    "",
    "| Path | Owner tool | Purpose | Safe to ingest directly? | Recommended treatment |",
    "|---|---|---|---|---|"
  ];

  for (const row of report.rows) {
    lines.push(`| \`${row.path}\` | ${row.ownerTool} | ${row.purpose} | ${row.safeToIngestDirectly ? "yes" : "no"} | ${row.recommendedTreatment} |`);
    if (row.details.length > 0) {
      lines.push(`| _details_ |  | ${row.details.map((detail) => redactText(detail)).join("<br>")} |  |  |`);
    }
  }

  lines.push("", "## Conflicts", "");
  if (report.conflicts.length === 0) {
    lines.push("- none detected");
  } else {
    for (const conflict of report.conflicts) {
      lines.push(`- ${conflict}`);
    }
  }

  lines.push("", "## Risks", "");
  if (report.risks.length === 0) {
    lines.push("- none detected");
  } else {
    for (const risk of report.risks) {
      lines.push(`- ${risk}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function scanKnownHomeSurfaces(): Promise<InventoryRow[]> {
  const rows: InventoryRow[] = [];

  for (const surface of HOME_SURFACES) {
    if (!(await pathExists(surface.filePath))) {
      continue;
    }

    const details = await summarizeSurface(surface.filePath);
    rows.push({
      path: surface.filePath,
      ownerTool: surface.ownerTool,
      purpose: surface.purpose,
      safeToIngestDirectly: surface.safeToIngestDirectly,
      recommendedTreatment: surface.recommendedTreatment,
      active: true,
      details
    });
  }

  return rows;
}

async function scanTargetRepo(targetRoot: string): Promise<InventoryRow[]> {
  const rows: InventoryRow[] = [];
  await walkTarget(targetRoot, 0, rows);
  return rows;
}

async function walkTarget(currentPath: string, depth: number, rows: InventoryRow[]): Promise<void> {
  if (depth > 4) {
    return;
  }

  const stat = await fs.stat(currentPath);
  if (!stat.isDirectory()) {
    return;
  }

  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      await walkTarget(nextPath, depth + 1, rows);
      continue;
    }

    if (!REPO_SURFACE_NAMES.has(entry.name)) {
      continue;
    }

    if (isSensitivePath(nextPath) && !isMetadataOnlyPath(nextPath)) {
      rows.push({
        path: nextPath,
        ownerTool: ownerToolForPath(nextPath),
        purpose: purposeForPath(nextPath),
        safeToIngestDirectly: false,
        recommendedTreatment: "reference",
        active: true,
        details: ["sensitive path detected; metadata-only policy applies"]
      });
      continue;
    }

    rows.push({
      path: nextPath,
      ownerTool: ownerToolForPath(nextPath),
      purpose: purposeForPath(nextPath),
      safeToIngestDirectly: isSafeDirectReadPath(nextPath),
      recommendedTreatment: treatmentForPath(nextPath),
      active: true,
      details: await summarizeSurface(nextPath)
    });
  }
}

async function summarizeSurface(filePath: string): Promise<string[]> {
  if (filePath.endsWith(".md")) {
    const firstLine = (await readText(filePath)).split("\n")[0] ?? "";
    return [firstLine.trim() || "markdown instruction surface"];
  }

  if (filePath.endsWith("settings.json") || filePath.endsWith("settings.local.json") || filePath.endsWith("launch.json") || filePath.endsWith("hooks.json")) {
    const data = await readJson<unknown>(filePath);
    return [`top-level keys: ${summarizeObjectKeys(data).join(", ")}`];
  }

  if (filePath.endsWith("mcp-servers.json")) {
    const data = await readJson<{ mcpServers?: Record<string, unknown> }>(filePath);
    const serverNames = Object.keys(data.mcpServers ?? {}).sort();
    return [`server names: ${serverNames.join(", ")}`];
  }

  return ["metadata only"];
}

function ownerToolForPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("copilot-instructions")) {
    return "Copilot";
  }
  if (normalized.includes("/.claude/") || normalized.endsWith("CLAUDE.md")) {
    return "Claude";
  }
  if (normalized.includes("/.agent/")) {
    return "Shrey Junior";
  }
  return "Codex";
}

function purposeForPath(filePath: string): string {
  const name = path.basename(filePath);
  switch (name) {
    case "AGENTS.md":
      return "repo-level Codex or shared routing guidance";
    case "CLAUDE.md":
      return "repo-level Claude routing guidance";
    case "copilot-instructions.md":
      return "repo-level Copilot instructions";
    case "settings.local.json":
      return "repo-local Claude settings";
    case "launch.json":
      return "repo-local launch metadata";
    case "project.yaml":
      return "repo-local control-plane state";
    case "checks.yaml":
      return "repo-local verification config";
    default:
      return "instruction surface";
  }
}

function treatmentForPath(filePath: string): "import" | "reference" | "ignore" | "migrate" {
  const name = path.basename(filePath);
  if (name === "AGENTS.md" || name === "CLAUDE.md" || name === "copilot-instructions.md") {
    return "import";
  }

  if (name === "project.yaml" || name === "checks.yaml") {
    return "migrate";
  }

  return "reference";
}

function isSafeDirectReadPath(filePath: string): boolean {
  const name = path.basename(filePath);
  return name === "AGENTS.md" || name === "CLAUDE.md" || name === "copilot-instructions.md";
}

function buildConflicts(rows: InventoryRow[]): string[] {
  const conflicts: string[] = [];
  const hasAgents = rows.some((row) => path.basename(row.path) === "AGENTS.md");
  const hasClaude = rows.some((row) => path.basename(row.path) === "CLAUDE.md");
  if (hasAgents && hasClaude) {
    conflicts.push("target repo already contains both AGENTS.md and CLAUDE.md; sync must stay additive");
  }
  if (rows.some((row) => row.path.includes("workspaceStorage"))) {
    conflicts.push("workspace storage should never be treated as portable repo memory");
  }
  return conflicts;
}

function buildRisks(rows: InventoryRow[]): string[] {
  const risks: string[] = [];
  if (rows.some((row) => row.path.endsWith("settings.local.json"))) {
    risks.push("repo-local Claude settings exist; v1 should reference them but not overwrite them");
  }
  if (rows.some((row) => row.path.endsWith("copilot-instructions.md"))) {
    risks.push("existing Copilot repo instructions must be updated through managed blocks only");
  }
  if (rows.some((row) => isSensitivePath(row.path))) {
    risks.push("sensitive path patterns detected; metadata-only rules must remain enforced");
  }
  return risks;
}

