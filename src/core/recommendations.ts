import type { FileArea, ProjectType, TaskType } from "./config.js";

export const MCP_PACK_IDS = ["core-pack", "research-pack", "web-qa-pack", "aws-pack", "ios-pack", "android-pack"] as const;
export type McpPackId = (typeof MCP_PACK_IDS)[number];

export interface RecommendationInputs {
  projectType: ProjectType | string;
  taskType?: TaskType;
  fileArea?: FileArea;
  activeRole?: string;
  starterMcpHints?: string[];
  authorityFiles?: string[];
}

export function recommendNextSpecialist(inputs: RecommendationInputs): string {
  if (
    inputs.activeRole === "dispatcher" ||
    inputs.activeRole === "reconciler" ||
    inputs.activeRole === "handoff-editor" ||
    inputs.activeRole === "release-readiness" ||
    inputs.activeRole === "security-reviewer" ||
    inputs.activeRole === "performance-reviewer" ||
    inputs.activeRole === "qa-specialist"
  ) {
    return inputs.activeRole;
  }

  if (inputs.taskType === "release-readiness") {
    return "release-readiness";
  }
  if (inputs.taskType === "planning" && (inputs.fileArea === "context" || !inputs.fileArea)) {
    return "dispatcher";
  }
  if (inputs.fileArea === "docs" || inputs.taskType === "docs") {
    return "docs-specialist";
  }
  if (inputs.fileArea === "data" || inputs.taskType === "migration" || inputs.projectType === "data-platform") {
    return "sql-specialist";
  }
  if (inputs.taskType === "testing" || inputs.taskType === "review") {
    return "qa-specialist";
  }
  if (inputs.taskType === "refactor") {
    return "performance-reviewer";
  }
  if (inputs.projectType === "python") {
    return "python-implementer";
  }
  if (inputs.projectType === "node") {
    return "typescript-implementer";
  }
  return "dispatcher";
}

export function recommendMcpPack(inputs: RecommendationInputs): McpPackId {
  const hints = [...(inputs.starterMcpHints ?? []), ...(inputs.authorityFiles ?? [])].join(" ").toLowerCase();

  if (/(xcode|swift|ios|macos|xcworkspace|xcodeproj)/.test(hints)) {
    return "ios-pack";
  }
  if (/(android|gradle|kotlin|androidmanifest)/.test(hints)) {
    return "android-pack";
  }
  if (/(aws|route53|cloudformation|cdk|kiwi-prod|iam identity center)/.test(hints)) {
    return "aws-pack";
  }
  if (
    inputs.projectType === "docs" ||
    inputs.taskType === "planning" ||
    inputs.taskType === "docs" ||
    inputs.taskType === "migration"
  ) {
    return "research-pack";
  }
  if (
    inputs.taskType === "testing" ||
    ((inputs.taskType === "implementation" || inputs.taskType === "review") &&
      (inputs.projectType === "node" || inputs.fileArea === "application"))
  ) {
    return "web-qa-pack";
  }
  return "core-pack";
}

export function normalizeMcpPack(value: string | undefined): McpPackId {
  if (value && MCP_PACK_IDS.includes(value as McpPackId)) {
    return value as McpPackId;
  }
  return "core-pack";
}
