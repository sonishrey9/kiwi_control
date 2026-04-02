import path from "node:path";
import type { LoadedConfig } from "./config.js";
import type { TaskPacket } from "./planner.js";
import type { TemplateContext } from "./router.js";
import { getPortableStateSpecs, getSurfaceSpecs } from "./router.js";
import { renderCodexBody } from "../adapters/codex.js";
import { renderClaudeBody } from "../adapters/claude.js";
import { renderCopilotBody } from "../adapters/copilot.js";
import {
  applyWritePlan,
  fileContainsManagedFile,
  pathExists,
  planManagedBlock,
  planManagedFile,
  readText,
  relativeFrom,
  renderTemplate,
  type WritePlan,
  type WriteResult
} from "../utils/fs.js";

export interface WriteExecutionOptions {
  dryRun?: boolean;
  diffSummary?: boolean;
  backup?: boolean;
  backupLabel?: string;
}

export async function initOrSyncTarget(
  repoRoot: string,
  targetRoot: string,
  config: LoadedConfig,
  context: TemplateContext,
  options: WriteExecutionOptions = {}
): Promise<WriteResult[]> {
  const plans: WritePlan[] = [];

  for (const item of getPortableStateSpecs(config)) {
    const template = await readText(path.join(repoRoot, item.templatePath));
    const body = renderTemplate(template, {
      projectName: context.projectName,
      generatedAt: context.generatedAt,
      taskDirectory: context.taskDirectory,
      contextDirectory: context.contextDirectory,
      targetRoot: context.targetRoot,
      profileName: context.profileName,
      executionMode: context.executionMode,
      projectType: context.projectType,
      profileSource: context.profileSource,
      starterSpecialists: context.starterSpecialists,
      starterValidations: context.starterValidations,
      starterMcpHints: context.starterMcpHints
    });

    plans.push(await planManagedFile(path.join(targetRoot, item.outputPath), item.logicalName, body));
  }

  for (const surface of getSurfaceSpecs(config)) {
    const outputPath = path.join(targetRoot, surface.file);
    const body = await renderSurfaceBody(repoRoot, config, context, surface.tool);
    if (!(await pathExists(outputPath))) {
      plans.push(await planManagedFile(outputPath, surface.file, body));
      continue;
    }

    if (await fileContainsManagedFile(outputPath, surface.file)) {
      plans.push(await planManagedFile(outputPath, surface.file, body));
      continue;
    }

    plans.push(await planManagedBlock(outputPath, surface.blockName, body));
  }

  return applyPlans(targetRoot, plans, options);
}

export async function writeTaskPackets(targetRoot: string, packets: TaskPacket[]): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  for (const packet of packets) {
    const plan = await planManagedFile(path.join(targetRoot, packet.relativePath), packet.logicalName, packet.content);
    results.push(await applyWritePlan(plan));
  }
  return results;
}

export function summarizeWrites(results: WriteResult[], targetRoot: string, options: Pick<WriteExecutionOptions, "diffSummary" | "dryRun"> = {}): string {
  const lines = results.map((result) => {
    const relativePath = path.relative(targetRoot, result.path) || ".";
    const diff = options.diffSummary || options.dryRun ? `, +${result.addedLines ?? 0}/-${result.removedLines ?? 0}` : "";
    const backup = result.backupPath ? `, backup=${relativeFrom(targetRoot, result.backupPath)}` : "";
    return `- ${result.status}: ${relativePath} (${result.detail}${diff}${backup})`;
  });
  return lines.join("\n");
}

async function renderSurfaceBody(repoRoot: string, config: LoadedConfig, context: TemplateContext, tool: "codex" | "claude" | "copilot"): Promise<string> {
  switch (tool) {
    case "codex":
      return renderCodexBody(repoRoot, config, context);
    case "claude":
      return renderClaudeBody(repoRoot, config, context);
    case "copilot":
      return renderCopilotBody(repoRoot, config, context);
  }
}

async function applyPlans(targetRoot: string, plans: WritePlan[], options: WriteExecutionOptions): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const backupRoot =
    options.backup && !options.dryRun
      ? path.join(targetRoot, ".agent", "backups", "shrey-junior", options.backupLabel ?? new Date().toISOString().replace(/[:.]/g, "-"))
      : undefined;

  for (const plan of plans) {
    if (options.dryRun) {
      results.push({
        path: plan.path,
        status: plan.status,
        detail: `dry-run ${plan.detail}`,
        ...(plan.addedLines !== undefined ? { addedLines: plan.addedLines } : {}),
        ...(plan.removedLines !== undefined ? { removedLines: plan.removedLines } : {})
      });
      continue;
    }

    const backupPath =
      backupRoot && plan.currentContent !== undefined && plan.status !== "unchanged" && plan.status !== "conflict"
        ? path.join(backupRoot, relativeFrom(targetRoot, plan.path))
        : undefined;
    results.push(await applyWritePlan(plan, backupPath ? { backupPath } : undefined));
  }

  return results;
}
