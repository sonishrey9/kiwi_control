import path from "node:path";
import type { LoadedConfig, ToolName } from "./config.js";
import type { CompiledContext } from "./context.js";
import type { DispatchRole } from "./dispatch.js";
import type { ContinuitySnapshot } from "./state.js";
import { renderTaskPacket } from "./packets.js";
import type { RoutingDecision, TemplateContext } from "./router.js";
import type { SpecialistSelection } from "./specialists.js";
import { readText, renderTemplate, slugify } from "../utils/fs.js";

export interface TaskPacket {
  logicalName: string;
  relativePath: string;
  content: string;
}

export async function buildRunPackets(
  repoRoot: string,
  config: LoadedConfig,
  context: TemplateContext,
  goal: string,
  decision: RoutingDecision,
  compiledContext: CompiledContext,
  continuity?: ContinuitySnapshot,
  specialist?: SpecialistSelection
): Promise<TaskPacket[]> {
  const tools: ToolName[] = ["codex", "claude", "copilot"];
  const slug = slugify(goal);
  const timestamp = compactTimestamp(context.generatedAt);

  return Promise.all(
    tools.map(async (tool) => {
      const promptName = tool === decision.primaryTool
        ? config.models.task_prompts[decision.taskType] ?? config.models.tool_packets[tool]?.default_prompt ?? "implementer"
        : config.models.tool_packets[tool]?.default_prompt ?? "implementer";
      const prompt = await loadPrompt(repoRoot, promptName, goal, context);
      const nativeSurface = config.routing.surfaces[tool].file;
      const title = `${capitalize(tool)} Run Packet`;
      const supportingRole = describeToolResponsibility(tool, decision);
      const content = renderTaskPacket({
        title,
        goal,
        packetType: "run",
        prompt,
        nativeSurface,
        routedTool: tool,
        decision,
        context: compiledContext,
        supportingRole,
        ...(specialist ? { specialist } : {}),
        ...(continuity ? { continuity } : {})
      });

      return {
        logicalName: `.agent/tasks/run-${timestamp}-${slug}/${tool}.md`,
        relativePath: path.join(config.routing.task_packets.directory, `run-${timestamp}-${slug}`, `${tool}.md`),
        content
      };
    })
  );
}

export async function buildFanoutPackets(
  repoRoot: string,
  config: LoadedConfig,
  context: TemplateContext,
  goal: string,
  decision: RoutingDecision,
  compiledContext: CompiledContext,
  continuity?: ContinuitySnapshot,
  specialistsByRole?: Partial<Record<DispatchRole, SpecialistSelection>>,
  contextsByRole?: Partial<Record<DispatchRole, CompiledContext>>
): Promise<TaskPacket[]> {
  const slug = slugify(goal);
  const timestamp = compactTimestamp(context.generatedAt);
  const roles = ["planner", "implementer", "reviewer", "tester"] as const;

  return Promise.all(
    roles.map(async (role) => {
      const promptName = config.models.fanout_roles[role]?.prompt ?? role;
      const prompt = await loadPrompt(repoRoot, promptName, goal, context);
      const roleContext = contextsByRole?.[role] ?? compiledContext;
      const specialist = specialistsByRole?.[role];
      const content = renderTaskPacket({
        title: `${capitalize(role)} Task Packet`,
        goal,
        packetType: role,
        prompt,
        decision,
        context: roleContext,
        supportingRole: describeFanoutResponsibility(role, decision),
        ...(specialist ? { specialist } : {}),
        ...(continuity ? { continuity } : {})
      });

      return {
        logicalName: `.agent/tasks/fanout-${timestamp}-${slug}/${role}.md`,
        relativePath: path.join(config.routing.task_packets.directory, `fanout-${timestamp}-${slug}`, `${role}.md`),
        content
      };
    })
  );
}

async function loadPrompt(repoRoot: string, promptName: string, goal: string, context: TemplateContext): Promise<string> {
  const promptPath = path.join(repoRoot, "prompts", `${promptName}.md`);
  const template = await readText(promptPath);
  return renderTemplate(template, {
    goal,
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

function compactTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function capitalize(input: string): string {
  return `${input.charAt(0).toUpperCase()}${input.slice(1)}`;
}

function describeToolResponsibility(tool: ToolName, decision: RoutingDecision): string {
  if (tool === decision.primaryTool) {
    return `primary owner for ${decision.taskType}`;
  }
  if (tool === decision.reviewTool) {
    return "review and risk gate support";
  }
  if (tool === "claude") {
    return "planning and docs support";
  }
  if (tool === "copilot") {
    return "inline or local edit acceleration";
  }
  return "supporting implementation context";
}

function describeFanoutResponsibility(role: string, decision: RoutingDecision): string {
  if (decision.requiredRoles.includes(role)) {
    return `${role} is required for this route`;
  }
  return `${role} support packet`;
}
