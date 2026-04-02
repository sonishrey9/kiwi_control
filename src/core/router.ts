import path from "node:path";
import type { ChangeSize, ExecutionMode, FileArea, LoadedConfig, TaskType, ToolName } from "./config.js";
import { TOOL_NAMES } from "./config.js";
import type { RiskLevel } from "./risk.js";
import type { ProfileSelection } from "./profiles.js";

export interface TemplateContext {
  projectName: string;
  generatedAt: string;
  taskDirectory: string;
  contextDirectory: string;
  targetRoot: string;
  profileName: string;
  executionMode: ExecutionMode;
  projectType: string;
  profileSource: string;
  starterSpecialists: string;
  starterValidations: string;
  starterMcpHints: string;
}

export interface SurfaceSpec {
  tool: ToolName;
  file: string;
  template: string;
  blockName: string;
}

export interface PortableStateSpec {
  logicalName: string;
  templatePath: string;
  outputPath: string;
}

export interface RoutingInputs {
  goal: string;
  profile: ProfileSelection;
  executionMode: ExecutionMode;
  riskLevel: RiskLevel;
  explicitTool?: ToolName;
  explicitTaskType?: TaskType;
  explicitFileArea?: FileArea;
  explicitChangeSize?: ChangeSize;
}

export interface RoutingDecision {
  profileName: string;
  primaryTool: ToolName;
  reviewTool: ToolName;
  taskType: TaskType;
  riskLevel: RiskLevel;
  fileArea: FileArea;
  changeSize: ChangeSize;
  executionMode: ExecutionMode;
  requiredRoles: string[];
  reasons: string[];
}

export function buildTemplateContext(
  targetRoot: string,
  config: LoadedConfig,
  options: {
    profileName: string;
    executionMode: ExecutionMode;
    projectType?: string;
    profileSource?: string;
    starterSpecialists?: string;
    starterValidations?: string;
    starterMcpHints?: string;
  }
): TemplateContext {
  return {
    projectName: path.basename(targetRoot),
    generatedAt: new Date().toISOString(),
    taskDirectory: config.global.defaults.task_directory,
    contextDirectory: config.global.defaults.context_directory,
    targetRoot,
    profileName: options.profileName,
    executionMode: options.executionMode,
    projectType: options.projectType ?? "generic",
    profileSource: options.profileSource ?? "repo-local",
    starterSpecialists: options.starterSpecialists ?? "qa-specialist, docs-specialist",
    starterValidations: options.starterValidations ?? "check, sync --dry-run --diff-summary",
    starterMcpHints: options.starterMcpHints ?? "policy-driven MCP usage only"
  };
}

export function getSurfaceSpecs(config: LoadedConfig): SurfaceSpec[] {
  return TOOL_NAMES.map((tool) => ({
    tool,
    file: config.routing.surfaces[tool].file,
    template: config.routing.surfaces[tool].template,
    blockName: config.routing.surfaces[tool].block_name
  }));
}

export function getPortableStateSpecs(config: LoadedConfig): PortableStateSpec[] {
  return [
    {
      logicalName: ".agent/project.yaml",
      templatePath: config.routing.portable_state.project,
      outputPath: ".agent/project.yaml"
    },
    {
      logicalName: ".agent/checks.yaml",
      templatePath: config.routing.portable_state.checks,
      outputPath: ".agent/checks.yaml"
    },
    {
      logicalName: ".agent/context/architecture.md",
      templatePath: config.routing.portable_state.context.architecture,
      outputPath: ".agent/context/architecture.md"
    },
    {
      logicalName: ".agent/context/conventions.md",
      templatePath: config.routing.portable_state.context.conventions,
      outputPath: ".agent/context/conventions.md"
    },
    {
      logicalName: ".agent/context/runbooks.md",
      templatePath: config.routing.portable_state.context.runbooks,
      outputPath: ".agent/context/runbooks.md"
    }
  ];
}

export function resolveRoutingDecision(config: LoadedConfig, inputs: RoutingInputs): RoutingDecision {
  const reasons: string[] = [];
  const taskType =
    inputs.explicitTaskType ??
    inferTaskType(inputs.goal, inputs.executionMode, inputs.explicitChangeSize, inputs.explicitFileArea) ??
    config.global.defaults.default_task_type;
  const fileArea = inputs.explicitFileArea ?? inferFileArea(inputs.goal);
  const changeSize = inputs.explicitChangeSize ?? inferChangeSize(inputs.goal, inputs.executionMode);
  const requiredRoles = new Set<string>();

  let primaryTool: ToolName | undefined = inputs.explicitTool;
  if (primaryTool) {
    reasons.push(`explicit CLI tool override selected ${primaryTool}`);
  }

  if (!primaryTool) {
    primaryTool = inputs.profile.profile.routing.task_types[taskType];
    if (primaryTool) {
      reasons.push(`profile ${inputs.profile.profileName} routes ${taskType} to ${primaryTool}`);
    }
  }

  const riskOverride = inputs.profile.profile.routing.risk_overrides[inputs.riskLevel];
  if (riskOverride?.required_roles) {
    for (const role of riskOverride.required_roles) {
      requiredRoles.add(role);
    }
  }

  if (inputs.riskLevel === "medium") {
    for (const role of inputs.profile.profile.packet.medium_risk_required_roles) {
      requiredRoles.add(role);
    }
  }
  if (inputs.riskLevel === "high") {
    for (const role of inputs.profile.profile.packet.high_risk_required_roles) {
      requiredRoles.add(role);
    }
  }

  const fileAreaTool = inputs.profile.profile.routing.file_area_overrides[fileArea];
  if (fileAreaTool && fileArea !== "application") {
    primaryTool = fileAreaTool;
    reasons.push(`file area ${fileArea} routes to ${fileAreaTool}`);
  }

  if (!primaryTool) {
    primaryTool = config.routing.defaults.fallback_tool;
    reasons.push(`fallback tool ${primaryTool} selected`);
  }

  const reviewTool =
    riskOverride?.review_tool ??
    inputs.profile.profile.review_tool ??
    config.routing.defaults.review_tool;

  if (primaryTool === "copilot" && inputs.riskLevel !== "low") {
    requiredRoles.add("reviewer");
  }
  if (changeSize === "large") {
    requiredRoles.add("planner");
    reasons.push("large change size escalates planner coverage");
  }

  return {
    profileName: inputs.profile.profileName,
    primaryTool,
    reviewTool,
    taskType,
    riskLevel: inputs.riskLevel,
    fileArea,
    changeSize,
    executionMode: inputs.executionMode,
    requiredRoles: [...requiredRoles],
    reasons
  };
}

export function inferTaskType(
  goal: string,
  executionMode: ExecutionMode,
  explicitChangeSize?: ChangeSize,
  explicitFileArea?: FileArea
): TaskType {
  const normalized = goal.toLowerCase();
  if (executionMode === "inline" && (explicitChangeSize === "small" || inferChangeSize(goal, executionMode) === "small")) {
    return "inline";
  }
  if (/(plan|design|architecture|approach|roadmap)/i.test(normalized)) {
    return "planning";
  }
  if (/(review|audit|findings|inspect)/i.test(normalized)) {
    return "review";
  }
  if (/(test|verify|validate|smoke)/i.test(normalized)) {
    return "testing";
  }
  if (/(bug|fix|regression|broken)/i.test(normalized)) {
    return "bugfix";
  }
  if (/(refactor|cleanup|restructure)/i.test(normalized)) {
    return "refactor";
  }
  if (/(migration|migrate|upgrade schema|upgrade config)/i.test(normalized)) {
    return "migration";
  }
  if (/(release|ship|go live|release readiness)/i.test(normalized)) {
    return "release-readiness";
  }
  if (explicitFileArea === "docs" || /(docs|documentation|readme|guide|runbook)/i.test(normalized)) {
    return "docs";
  }
  return "implementation";
}

export function inferFileArea(goal: string): FileArea {
  const normalized = goal.toLowerCase();
  if (/(docs|documentation|readme|guide|runbook)/i.test(normalized)) {
    return "docs";
  }
  if (/(test|spec|playwright|coverage)/i.test(normalized)) {
    return "tests";
  }
  if (/(docker|deploy|k8s|infra|terraform|ci|workflow)/i.test(normalized)) {
    return "infra";
  }
  if (/(config|yaml|json|agents|claude|copilot|mcp|settings)/i.test(normalized)) {
    return "config";
  }
  if (/(context|convention|runbook|architecture)/i.test(normalized)) {
    return "context";
  }
  if (/(dbt|sql|warehouse|dataset|pipeline|etl|metric)/i.test(normalized)) {
    return "data";
  }
  return "application";
}

export function inferChangeSize(goal: string, executionMode: ExecutionMode): ChangeSize {
  const normalized = goal.toLowerCase();
  if (executionMode === "inline" || /(small|tiny|minor|local|inline|surgical|one file|single file)/i.test(normalized)) {
    return "small";
  }
  if (/(cross-cutting|large|sweeping|broad|major|multiple files|end-to-end|repo-wide)/i.test(normalized)) {
    return "large";
  }
  return "medium";
}
