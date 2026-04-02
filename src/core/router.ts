import path from "node:path";
import type { ChangeSize, ExecutionMode, FileArea, LoadedConfig, TaskType, ToolName } from "./config.js";
import { TOOL_NAMES } from "./config.js";
import { buildBootstrapNextAction, buildCanonicalReadNext, buildChecksToRun, buildFirstReadContract, buildSearchGuidance, buildStopConditions, buildWriteTargets } from "./guidance.js";
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

export type ContractInstructionKey = "backend" | "frontend" | "docs" | "data";

export interface PortableContractSelection {
  projectType: string;
  activeRole: string;
  supportingRoles: string[];
  instructionKeys: ContractInstructionKey[];
  specialistIds: string[];
  coreSurfaces: string[];
  instructionSurfaces: string[];
  agentSurfaces: string[];
  roleSurfaces: string[];
  stateSurfaces: string[];
  ciSurfaces: string[];
  authorityFiles: string[];
  skippedSurfaces: string[];
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
  writeMode?: "managed" | "seed-only";
  contentFormat?: "managed" | "raw";
  templateValues?: Record<string, string>;
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

export function selectPortableContract(config: LoadedConfig, context: TemplateContext): PortableContractSelection {
  const starterSpecialists = parseCsvList(context.starterSpecialists);
  const roleDefaults = config.specialists.defaults.specialist_by_role;
  const specialistIds = uniqueStrings(
    [
      ...starterSpecialists,
      roleDefaults.planner,
      roleDefaults.reviewer,
      roleDefaults.tester
    ].filter((value): value is string => Boolean(value))
  ).filter((specialistId) => {
    const specialist = config.specialists.specialists[specialistId];
    return Boolean(specialist && specialist.allowed_profiles.includes(context.profileName));
  });

  const activeRole =
    resolvePreferredActiveRole(context.projectType, specialistIds) ??
    specialistIds[0] ??
    config.specialists.defaults.fallback_specialist;
  const supportingRoles = specialistIds.filter((specialistId) => specialistId !== activeRole);

  const instructionKeys = resolveInstructionKeys(context.projectType, specialistIds);
  const instructionSurfaces = instructionKeys.map((key) => `.github/instructions/${key}.instructions.md`);
  const roleSurfaces = specialistIds.map((specialistId) => `.agent/roles/${specialistId}.md`);
  const agentSurfaces = [
    ".github/agents/shrey-junior.md",
    ...specialistIds.map((specialistId) => `.github/agents/${specialistId}.md`)
  ];
  const coreSurfaces = [
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ".agent/project.yaml",
    ".agent/checks.yaml",
    ".agent/context/architecture.md",
    ".agent/context/conventions.md",
    ".agent/context/runbooks.md",
    ".agent/roles/README.md",
    ".agent/templates/role-result.md",
    ".agent/state/current-phase.json",
    ".agent/state/active-role-hints.json",
    ".agent/state/handoff/README.md",
    ".agent/state/dispatch/README.md",
    ".agent/state/reconcile/README.md",
    ".agent/scripts/verify-contract.sh"
  ];
  const stateSurfaces = [
    ".agent/state/current-phase.json",
    ".agent/state/active-role-hints.json",
    ".agent/state/handoff/latest.json",
    ".agent/state/dispatch/latest-manifest.json",
    ".agent/state/dispatch/latest-collect.json",
    ".agent/state/reconcile/latest.json",
    ".agent/state/latest-task-packets.json"
  ];
  const ciSurfaces = [".github/workflows/shrey-junior-contract.yml"];
  const authorityFiles = [
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ...instructionSurfaces,
    ".github/agents/shrey-junior.md",
    ...roleSurfaces,
    ".agent/project.yaml",
    ".agent/checks.yaml",
    ".agent/state/current-phase.json",
    ".agent/state/active-role-hints.json"
  ];

  const allOptionalInstructionSurfaces = [
    ".github/instructions/backend.instructions.md",
    ".github/instructions/frontend.instructions.md",
    ".github/instructions/docs.instructions.md",
    ".github/instructions/data.instructions.md"
  ];
  const skippedSurfaces = [
    ...allOptionalInstructionSurfaces.filter((relativePath) => !instructionSurfaces.includes(relativePath)),
    ...Object.keys(config.specialists.specialists)
      .sort((left, right) => left.localeCompare(right))
      .flatMap((specialistId) =>
        specialistIds.includes(specialistId)
          ? []
          : [`.agent/roles/${specialistId}.md`, `.github/agents/${specialistId}.md`]
      )
  ];

  return {
    projectType: context.projectType,
    activeRole,
    supportingRoles,
    instructionKeys,
    specialistIds,
    coreSurfaces,
    instructionSurfaces,
    agentSurfaces,
    roleSurfaces,
    stateSurfaces,
    ciSurfaces,
    authorityFiles,
    skippedSurfaces
  };
}

export function getPortableStateSpecs(config: LoadedConfig, context: TemplateContext): PortableStateSpec[] {
  const contract = selectPortableContract(config, context);
  const defaultReadNext = buildCanonicalReadNext({
    targetRoot: context.targetRoot,
    contract
  });
  const firstReadOrder = buildFirstReadContract({
    targetRoot: context.targetRoot,
    contract
  });
  const defaultChecksToRun = buildChecksToRun(parseCsvList(context.starterValidations));
  const defaultWriteTargets = buildWriteTargets(contract);
  const defaultStopConditions = buildStopConditions({ riskLevel: "low", taskType: "planning" });
  const defaultSearchGuidance = buildSearchGuidance({
    projectType: context.projectType,
    taskType: "planning",
    fileArea: "context"
  });
  const sharedTemplateValues = {
    contractCoreSurfacesYaml: renderYamlList(contract.coreSurfaces),
    contractInstructionSurfacesYaml: renderYamlList(contract.instructionSurfaces),
    contractAgentSurfacesYaml: renderYamlList(contract.agentSurfaces),
    contractRoleSurfacesYaml: renderYamlList(contract.roleSurfaces),
    contractSpecialistsYaml: renderYamlList(contract.specialistIds),
    contractStateSurfacesYaml: renderYamlList(contract.stateSurfaces),
    contractCiSurfacesYaml: renderYamlList(contract.ciSurfaces),
    contractSkippedSurfacesYaml: renderYamlList(contract.skippedSurfaces),
    currentPhaseAuthorityFilesJson: renderJsonArray(contract.authorityFiles),
    activeRole: contract.activeRole,
    supportingRolesJson: renderJsonArray(contract.supportingRoles),
    firstReadOrderYaml: renderYamlList(firstReadOrder),
    verificationCommandsYaml: renderYamlList(defaultChecksToRun),
    bootstrapNextAction: buildBootstrapNextAction(),
    activeRoleReadNextJson: renderJson(defaultReadNext),
    activeRoleWriteTargetsJson: renderJson(defaultWriteTargets),
    activeRoleChecksToRunJson: renderJson(defaultChecksToRun),
    activeRoleStopConditionsJson: renderJson(defaultStopConditions),
    activeRoleSearchGuidanceJson: renderJson(defaultSearchGuidance),
    activeRoleNextAction: buildBootstrapNextAction(),
    verifyRequiredFilesBash: renderBashArray([
      ...contract.coreSurfaces,
      ...contract.instructionSurfaces,
      ...contract.agentSurfaces,
      ...contract.roleSurfaces,
      ...contract.ciSurfaces
    ]),
    verifyOptionalLatestFilesPython: renderPythonList([
      ".agent/state/handoff/latest.json",
      ".agent/state/dispatch/latest-manifest.json",
      ".agent/state/dispatch/latest-collect.json",
      ".agent/state/reconcile/latest.json",
      ".agent/state/latest-task-packets.json"
    ])
  };

  const specs: PortableStateSpec[] = [
    {
      logicalName: ".agent/project.yaml",
      templatePath: config.routing.portable_state.project,
      outputPath: ".agent/project.yaml",
      templateValues: sharedTemplateValues
    },
    {
      logicalName: ".agent/checks.yaml",
      templatePath: config.routing.portable_state.checks,
      outputPath: ".agent/checks.yaml",
      templateValues: sharedTemplateValues
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
    },
    {
      logicalName: ".agent/roles/README.md",
      templatePath: config.routing.portable_state.roles.readme,
      outputPath: ".agent/roles/README.md"
    },
    {
      logicalName: ".agent/templates/role-result.md",
      templatePath: config.routing.portable_state.templates.role_result,
      outputPath: ".agent/templates/role-result.md"
    },
    {
      logicalName: ".agent/state/current-phase.json",
      templatePath: config.routing.portable_state.state.current_phase,
      outputPath: ".agent/state/current-phase.json",
      writeMode: "seed-only",
      contentFormat: "raw",
      templateValues: sharedTemplateValues
    },
    {
      logicalName: ".agent/state/active-role-hints.json",
      templatePath: config.routing.portable_state.state.active_role_hints,
      outputPath: ".agent/state/active-role-hints.json",
      writeMode: "seed-only",
      contentFormat: "raw",
      templateValues: sharedTemplateValues
    },
    {
      logicalName: ".agent/state/handoff/README.md",
      templatePath: config.routing.portable_state.state.handoff_readme,
      outputPath: ".agent/state/handoff/README.md"
    },
    {
      logicalName: ".agent/state/dispatch/README.md",
      templatePath: config.routing.portable_state.state.dispatch_readme,
      outputPath: ".agent/state/dispatch/README.md"
    },
    {
      logicalName: ".agent/state/reconcile/README.md",
      templatePath: config.routing.portable_state.state.reconcile_readme,
      outputPath: ".agent/state/reconcile/README.md"
    },
    {
      logicalName: ".agent/scripts/verify-contract.sh",
      templatePath: config.routing.portable_state.scripts.verify_contract,
      outputPath: ".agent/scripts/verify-contract.sh",
      templateValues: sharedTemplateValues
    },
    {
      logicalName: ".github/agents/shrey-junior.md",
      templatePath: config.routing.portable_state.github.agents.shrey_junior,
      outputPath: ".github/agents/shrey-junior.md"
    },
    {
      logicalName: ".github/workflows/shrey-junior-contract.yml",
      templatePath: config.routing.portable_state.github.workflows.contract,
      outputPath: ".github/workflows/shrey-junior-contract.yml",
      templateValues: sharedTemplateValues
    }
  ];

  const instructionTemplates: Record<ContractInstructionKey, string> = {
    backend: config.routing.portable_state.github.instructions.backend,
    frontend: config.routing.portable_state.github.instructions.frontend,
    docs: config.routing.portable_state.github.instructions.docs,
    data: config.routing.portable_state.github.instructions.data
  };
  for (const key of contract.instructionKeys) {
    specs.push({
      logicalName: `.github/instructions/${key}.instructions.md`,
      templatePath: instructionTemplates[key],
      outputPath: `.github/instructions/${key}.instructions.md`
    });
  }

  const specialistTemplate = config.routing.portable_state.roles.specialist_template;
  const agentTemplate = config.routing.portable_state.github.agents.specialist_template;
  for (const specialistId of contract.specialistIds) {
    const specialist = config.specialists.specialists[specialistId];
    if (!specialist) {
      continue;
    }
    const specialistValues = {
      specialistId,
      specialistName: specialist.name,
      specialistPurpose: specialist.purpose,
      specialistPreferredTools: specialist.preferred_tools.join(", "),
      specialistAllowedProfiles: specialist.allowed_profiles.join(", "),
      specialistRoutingRoles: renderBulletList(specialist.routing_bias.roles),
      specialistRoutingTaskTypes: renderBulletList(specialist.routing_bias.task_types),
      specialistRoutingFileAreas: renderBulletList(specialist.routing_bias.file_areas),
      specialistValidationExpectations: renderBulletList(specialist.validation_expectations),
      specialistResultSchema: renderBulletList(specialist.result_schema_expectations),
      specialistMcpEligibility: renderBulletList(specialist.mcp_eligibility),
      specialistRiskPosture: specialist.risk_posture,
      specialistHandoffGuidance: renderBulletList(specialist.handoff_guidance),
      specialistRoleSpecPath: `.agent/roles/${specialistId}.md`
    };

    specs.push({
      logicalName: `.agent/roles/${specialistId}.md`,
      templatePath: specialistTemplate,
      outputPath: `.agent/roles/${specialistId}.md`,
      templateValues: specialistValues
    });
    specs.push({
      logicalName: `.github/agents/${specialistId}.md`,
      templatePath: agentTemplate,
      outputPath: `.github/agents/${specialistId}.md`,
      templateValues: specialistValues
    });
  }

  return specs;
}

function resolveInstructionKeys(projectType: string, specialistIds: string[]): ContractInstructionKey[] {
  const keys = new Set<ContractInstructionKey>();
  if (projectType === "python") {
    keys.add("backend");
  }
  if (projectType === "node") {
    keys.add("backend");
    keys.add("frontend");
  }
  if (projectType === "docs") {
    keys.add("docs");
  }
  if (projectType === "data-platform") {
    keys.add("data");
  }

  for (const specialistId of specialistIds) {
    if (specialistId === "backend-specialist" || specialistId === "python-specialist") {
      keys.add("backend");
    }
    if (specialistId === "frontend-specialist") {
      keys.add("frontend");
    }
    if (specialistId === "fullstack-specialist") {
      keys.add("backend");
      keys.add("frontend");
    }
    if (specialistId === "docs-specialist") {
      keys.add("docs");
    }
    if (specialistId === "data-platform-specialist") {
      keys.add("data");
    }
  }

  return [...keys].sort();
}

function resolvePreferredActiveRole(projectType: string, specialistIds: string[]): string | undefined {
  const priorityByProjectType: Record<string, string[]> = {
    python: ["python-specialist", "backend-specialist", "architecture-specialist"],
    node: ["fullstack-specialist", "backend-specialist", "frontend-specialist", "architecture-specialist"],
    docs: ["docs-specialist", "architecture-specialist"],
    "data-platform": ["data-platform-specialist", "architecture-specialist"],
    generic: ["architecture-specialist", "review-specialist"]
  };

  const priorities = priorityByProjectType[projectType] ?? priorityByProjectType.generic ?? [];
  return priorities.find((specialistId) => specialistIds.includes(specialistId));
}

function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => Boolean(item));
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)];
}

function renderYamlList(items: string[]): string {
  if (items.length === 0) {
    return "      []";
  }
  return items.map((item) => `      - ${item}`).join("\n");
}

function renderJsonArray(items: string[]): string {
  return JSON.stringify(items, null, 2);
}

function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderBashArray(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  return items.map((item) => `  "${item}"`).join("\n");
}

function renderPythonList(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  return items.map((item) => `    "${item}",`).join("\n");
}

function renderBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- none recorded";
  }
  return items.map((item) => `- ${item}`).join("\n");
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
