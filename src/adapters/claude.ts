import path from "node:path";
import type { LoadedConfig } from "../core/config.js";
import type { TemplateContext } from "../core/router.js";
import { readText, renderTemplate } from "../utils/fs.js";

export async function renderClaudeBody(repoRoot: string, config: LoadedConfig, context: TemplateContext): Promise<string> {
  const templatePath = path.join(repoRoot, config.routing.surfaces.claude.template);
  const template = await readText(templatePath);
  return renderTemplate(template, {
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
}
