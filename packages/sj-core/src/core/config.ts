import os from "node:os";
import path from "node:path";
import { pathExists, readJson } from "../utils/fs.js";
import { readYamlFile } from "../utils/yaml.js";

export const TOOL_NAMES = ["codex", "claude", "copilot"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export const SPECIALIST_RESULT_FIELDS = [
  "role",
  "status",
  "summary",
  "agreements",
  "conflicts",
  "validations",
  "risks",
  "touched_files",
  "next_steps"
] as const;
export type SpecialistResultField = (typeof SPECIALIST_RESULT_FIELDS)[number];
export const PROJECT_TYPES = ["python", "node", "docs", "data-platform", "generic"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const TASK_TYPES = [
  "planning",
  "implementation",
  "inline",
  "review",
  "testing",
  "docs",
  "bugfix",
  "refactor",
  "migration",
  "release-readiness"
] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const EXECUTION_MODES = ["assisted", "guarded", "inline"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];
export const CHANGE_SIZES = ["small", "medium", "large"] as const;
export type ChangeSize = (typeof CHANGE_SIZES)[number];
export const FILE_AREAS = ["application", "config", "context", "data", "docs", "infra", "tests", "unknown"] as const;
export type FileArea = (typeof FILE_AREAS)[number];
export type RoutingRiskLevel = "low" | "medium" | "high";

export interface GlobalConfig {
  version: number;
  name: string;
  authority: {
    canonical_dirs: string[];
    generated_outputs_are_derived: boolean;
  };
  defaults: {
    task_directory: string;
    context_directory: string;
    managed_prefix: string;
    default_profile: string;
    default_execution_mode: ExecutionMode;
    default_task_type: TaskType;
    default_change_size: ChangeSize;
    authority_files: string[];
  };
  surfaces: Record<ToolName, string>;
}

export interface RoutingSurface {
  file: string;
  template: string;
  block_name: string;
}

export interface RoutingConfig {
  version: number;
  surfaces: Record<ToolName, RoutingSurface>;
  portable_state: {
    project: string;
    checks: string;
    context: {
      architecture: string;
      commands: string;
      specialists: string;
      conventions: string;
      tool_capabilities: string;
      mcp_capabilities: string;
      runbooks: string;
    };
    memory: {
      repo_facts: string;
      architecture_decisions: string;
      domain_glossary: string;
      current_focus: string;
      open_risks: string;
      known_gotchas: string;
      last_successful_patterns: string;
    };
    roles: {
      readme: string;
      specialist_template: string;
    };
    templates: {
      role_result: string;
    };
    state: {
      current_phase: string;
      active_role_hints: string;
      checkpoint_latest_json: string;
      checkpoint_latest_markdown: string;
      handoff_readme: string;
      dispatch_readme: string;
      reconcile_readme: string;
    };
    scripts: {
      verify_contract: string;
    };
    github: {
      instructions: {
        backend: string;
        frontend: string;
        docs: string;
        data: string;
      };
      agents: {
        shrey_junior: string;
        specialist_template: string;
      };
      workflows: {
        contract: string;
      };
    };
  };
  task_packets: {
    directory: string;
    roles: string[];
  };
  defaults: {
    fallback_tool: ToolName;
    planning_tool: ToolName;
    review_tool: ToolName;
    docs_tool: ToolName;
    inline_tool: ToolName;
  };
  profiles: Record<string, RoutingProfile>;
}

export interface ModelsConfig {
  version: number;
  tool_packets: Record<ToolName, { default_prompt: string; role: string }>;
  fanout_roles: Record<string, { prompt: string }>;
  task_prompts: Record<TaskType, string>;
}

export interface GuardrailsConfig {
  version: number;
  sensitive_path_patterns: string[];
  metadata_only_patterns: string[];
  protected_global_roots: string[];
  refuse_global_writes: boolean;
  append_only_surfaces: string[];
  forbidden_scope: {
    default: string[];
    [profileName: string]: string[];
  };
  execution_modes: Record<ExecutionMode, { description: string }>;
}

export interface McpRegistryConfig {
  version: number;
  notes: string;
  mcpServers: Record<
    string,
    {
      id?: string;
      category: string;
      purpose: string;
      portable: boolean;
      treatment: string;
      allowedProfiles: string[];
      trustLevel: "low" | "medium" | "high";
      humanNotes: string;
      toolCompatibility: ToolName[];
      referenceOnly: boolean;
      repoEligible: boolean;
      compatibleSpecialists?: string[];
      readOnly?: boolean;
      writeCapable?: boolean;
      approvalRequired?: boolean;
      usageGuidance?: string[];
      antiPatterns?: string[];
    }
  >;
}

export interface SpecialistDefinition {
  id: string;
  name: string;
  purpose: string;
  aliases?: string[];
  preferred_tools: ToolName[];
  allowed_profiles: string[];
  routing_bias: {
    roles: string[];
    task_types: TaskType[];
    file_areas: FileArea[];
    preferred_primary_tool?: ToolName;
    preferred_review_tool?: ToolName;
  };
  validation_expectations: string[];
  result_schema_expectations: SpecialistResultField[];
  mcp_eligibility: string[];
  risk_posture: "low" | "medium" | "high" | "conservative";
  handoff_guidance: string[];
}

export interface SpecialistsConfig {
  version: number;
  defaults: {
    specialist_by_role: Record<string, string>;
    fallback_specialist: string;
  };
  specialists: Record<string, SpecialistDefinition>;
}

export type PolicyPoint =
  | "pre-run"
  | "pre-fanout"
  | "pre-dispatch"
  | "pre-sync"
  | "post-sync"
  | "pre-checkpoint"
  | "pre-handoff"
  | "pre-push-check"
  | "pre-release-check";

export type PolicyCheckId =
  | "authority-conflicts"
  | "profile-mismatch"
  | "blocked-reconcile"
  | "missing-structured-outputs"
  | "specialist-mismatch"
  | "mcp-ineligibility"
  | "missing-validations"
  | "push-release-blockers";

export interface PolicyCheckRule {
  id: PolicyCheckId;
  severity: "warn" | "block";
}

export interface PoliciesConfig {
  version: number;
  points: Record<PolicyPoint, { checks: PolicyCheckRule[] }>;
}

export interface GlobalBootstrapDefaults {
  version?: number;
  default_profile?: string;
  project_type_profiles?: Partial<Record<ProjectType, string>>;
  project_type_specialists?: Partial<Record<ProjectType, string[]>>;
  project_type_validation_hints?: Partial<Record<ProjectType, string[]>>;
  project_type_mcp_hints?: Partial<Record<ProjectType, string[]>>;
}

export interface GlobalHomePaths {
  root: string;
  configs: string;
  prompts: string;
  specialists: string;
  policies: string;
  mcp: string;
  defaults: string;
  adapters: string;
  bin: string;
}

export interface RoutingProfile {
  description: string;
  default_execution_mode: ExecutionMode;
  review_tool: ToolName;
  sync: {
    default_backup: boolean;
  };
  packet: {
    medium_risk_required_roles: string[];
    high_risk_required_roles: string[];
  };
  routing: {
    task_types: Partial<Record<TaskType, ToolName>>;
    risk_overrides: Partial<
      Record<
        RoutingRiskLevel,
        {
          review_tool?: ToolName;
          required_roles?: string[];
        }
      >
    >;
    file_area_overrides: Partial<Record<FileArea, ToolName>>;
  };
}

export interface LoadedConfig {
  repoRoot: string;
  global: GlobalConfig;
  routing: RoutingConfig;
  models: ModelsConfig;
  guardrails: GuardrailsConfig;
  mcpServers: McpRegistryConfig;
  specialists: SpecialistsConfig;
  policies: PoliciesConfig;
}

export async function loadCanonicalConfig(repoRoot: string): Promise<LoadedConfig> {
  const configDir = path.join(repoRoot, "configs");
  return {
    repoRoot,
    global: await readYamlFile<GlobalConfig>(path.join(configDir, "global.yaml")),
    routing: await readYamlFile<RoutingConfig>(path.join(configDir, "routing.yaml")),
    models: await readYamlFile<ModelsConfig>(path.join(configDir, "models.yaml")),
    guardrails: await readYamlFile<GuardrailsConfig>(path.join(configDir, "guardrails.yaml")),
    mcpServers: await readJson<McpRegistryConfig>(path.join(configDir, "mcp.servers.json")),
    specialists: await readYamlFile<SpecialistsConfig>(path.join(configDir, "specialists.yaml")),
    policies: await readYamlFile<PoliciesConfig>(path.join(configDir, "policies.yaml"))
  };
}

export function getGlobalHomeRoot(): string {
  return process.env.SHREY_JUNIOR_HOME || path.join(os.homedir(), ".shrey-junior");
}

export function getGlobalHomePaths(root = getGlobalHomeRoot()): GlobalHomePaths {
  return {
    root,
    configs: path.join(root, "configs"),
    prompts: path.join(root, "prompts"),
    specialists: path.join(root, "specialists"),
    policies: path.join(root, "policies"),
    mcp: path.join(root, "mcp"),
    defaults: path.join(root, "defaults"),
    adapters: path.join(root, "adapters"),
    bin: path.join(root, "bin")
  };
}

export async function loadGlobalBootstrapDefaults(root = getGlobalHomeRoot()): Promise<GlobalBootstrapDefaults | null> {
  const filePath = path.join(root, "defaults", "bootstrap.yaml");
  if (!(await pathExists(filePath))) {
    return null;
  }

  return readYamlFile<GlobalBootstrapDefaults>(filePath);
}
