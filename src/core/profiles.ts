import path from "node:path";
import type { ChangeSize, ExecutionMode, FileArea, LoadedConfig, RoutingProfile, TaskType, ToolName } from "./config.js";
import { parseYaml } from "../utils/yaml.js";
import { pathExists, readText } from "../utils/fs.js";

export interface ProjectOverlay {
  version?: number;
  profile?: string;
  routing?: {
    preferred_execution_mode?: ExecutionMode;
    primary_tool_override?: ToolName;
  };
  rules?: {
    machine_local_state_is_reference_only?: boolean;
    global_config_changes_allowed?: boolean;
    additive_sync_only?: boolean;
    backup_before_sync?: boolean;
  };
}

export interface ProfileSelection {
  profileName: string;
  profile: RoutingProfile;
  source: "cli" | "repo" | "default";
}

export interface ProjectContextOptions {
  explicitProfileName?: string;
  explicitExecutionMode?: ExecutionMode;
  explicitTool?: ToolName;
  explicitTaskType?: TaskType;
  explicitFileArea?: FileArea;
  explicitChangeSize?: ChangeSize;
}

export async function loadProjectOverlay(targetRoot: string): Promise<ProjectOverlay | null> {
  const projectFile = path.join(targetRoot, ".agent", "project.yaml");
  if (!(await pathExists(projectFile))) {
    return null;
  }

  const raw = await readText(projectFile);
  return parseYaml<ProjectOverlay>(raw);
}

export async function resolveProfileSelection(
  targetRoot: string,
  config: LoadedConfig,
  explicitProfileName?: string
): Promise<ProfileSelection> {
  if (explicitProfileName) {
    return {
      profileName: explicitProfileName,
      profile: resolveProfile(explicitProfileName, config),
      source: "cli"
    };
  }

  const overlay = await loadProjectOverlay(targetRoot);
  if (overlay?.profile && config.routing.profiles[overlay.profile]) {
    return {
      profileName: overlay.profile,
      profile: resolveProfile(overlay.profile, config),
      source: "repo"
    };
  }

  return {
    profileName: config.global.defaults.default_profile,
    profile: resolveProfile(config.global.defaults.default_profile, config),
    source: "default"
  };
}

export function resolveProfile(name: string, config: LoadedConfig): RoutingProfile {
  const profile = config.routing.profiles[name];
  if (!profile) {
    throw new Error(`unknown profile: ${name}`);
  }
  return profile;
}

export function resolveExecutionMode(
  config: LoadedConfig,
  selection: ProfileSelection,
  overlay: ProjectOverlay | null,
  explicitExecutionMode?: ExecutionMode
): ExecutionMode {
  return (
    explicitExecutionMode ??
    overlay?.routing?.preferred_execution_mode ??
    selection.profile.default_execution_mode ??
    config.global.defaults.default_execution_mode
  );
}

export function resolvePrimaryToolOverride(overlay: ProjectOverlay | null, explicitTool?: ToolName): ToolName | undefined {
  return explicitTool ?? overlay?.routing?.primary_tool_override;
}
