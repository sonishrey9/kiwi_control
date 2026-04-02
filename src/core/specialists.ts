import type { FileArea, LoadedConfig, SpecialistDefinition, TaskType, ToolName } from "./config.js";

export interface SpecialistSelection {
  specialistId: string;
  specialist: SpecialistDefinition;
  source: "explicit" | "role-default" | "inferred" | "fallback";
  reasons: string[];
}

export interface McpCapability {
  id: string;
  category: string;
  purpose: string;
  trustLevel: "low" | "medium" | "high";
  readOnly: boolean;
  writeCapable: boolean;
  approvalRequired: boolean;
  usageGuidance: string[];
  antiPatterns: string[];
}

export function resolveSpecialist(options: {
  config: LoadedConfig;
  profileName: string;
  taskType: TaskType;
  fileArea: FileArea;
  role?: string;
  tool?: ToolName;
  explicitSpecialistId?: string;
}): SpecialistSelection {
  const registry = options.config.specialists;
  if (options.explicitSpecialistId) {
    const specialist = registry.specialists[options.explicitSpecialistId];
    if (!specialist) {
      throw new Error(`unknown specialist: ${options.explicitSpecialistId}`);
    }
    return {
      specialistId: specialist.id,
      specialist,
      source: "explicit",
      reasons: [`explicit specialist override selected ${specialist.id}`]
    };
  }

  if (options.role) {
    const mappedId = registry.defaults.specialist_by_role[options.role];
    if (mappedId) {
      const mapped = registry.specialists[mappedId];
      if (mapped && mapped.allowed_profiles.includes(options.profileName)) {
        return {
          specialistId: mapped.id,
          specialist: mapped,
          source: "role-default",
          reasons: [`role ${options.role} defaults to ${mapped.id}`]
        };
      }
    }
  }

  let best: { id: string; score: number; reasons: string[] } | null = null;
  for (const [specialistId, specialist] of Object.entries(registry.specialists)) {
    if (!specialist.allowed_profiles.includes(options.profileName)) {
      continue;
    }
    let score = 0;
    const reasons: string[] = [];
    if (options.role && specialist.routing_bias.roles.includes(options.role)) {
      score += 6;
      reasons.push(`role ${options.role}`);
    }
    if (specialist.routing_bias.task_types.includes(options.taskType)) {
      score += 5;
      reasons.push(`task ${options.taskType}`);
    }
    if (specialist.routing_bias.file_areas.includes(options.fileArea)) {
      score += 3;
      reasons.push(`file area ${options.fileArea}`);
    }
    if (options.tool && specialist.preferred_tools.includes(options.tool)) {
      score += 2;
      reasons.push(`tool ${options.tool}`);
    }

    if (!best || score > best.score) {
      best = { id: specialistId, score, reasons };
    }
  }

  if (best && best.score > 0) {
    return {
      specialistId: best.id,
      specialist: registry.specialists[best.id]!,
      source: "inferred",
      reasons: [`inferred from ${best.reasons.join(", ")}`]
    };
  }

  const fallback = registry.specialists[registry.defaults.fallback_specialist];
  if (!fallback) {
    throw new Error(`fallback specialist ${registry.defaults.fallback_specialist} is not defined`);
  }
  return {
    specialistId: fallback.id,
    specialist: fallback,
    source: "fallback",
    reasons: [`fallback specialist ${fallback.id}`]
  };
}

export function resolveRoleSpecialists(options: {
  config: LoadedConfig;
  profileName: string;
  taskType: TaskType;
  fileArea: FileArea;
  roleTools: Record<string, ToolName>;
}): Record<string, SpecialistSelection> {
  const result: Record<string, SpecialistSelection> = {};
  for (const [role, tool] of Object.entries(options.roleTools)) {
    result[role] = resolveSpecialist({
      config: options.config,
      profileName: options.profileName,
      taskType: role === "planner" ? "planning" : role === "reviewer" ? "review" : role === "tester" ? "testing" : options.taskType,
      fileArea: options.fileArea,
      role,
      tool
    });
  }
  return result;
}

export function listEligibleMcpCapabilities(options: {
  config: LoadedConfig;
  profileName: string;
  specialistId: string;
  tool?: ToolName;
}): McpCapability[] {
  return Object.entries(options.config.mcpServers.mcpServers)
    .filter(([, server]) => server.allowedProfiles.includes(options.profileName))
    .filter(([, server]) => !options.tool || server.toolCompatibility.includes(options.tool))
    .filter(([, server]) => !server.compatibleSpecialists || server.compatibleSpecialists.includes(options.specialistId))
    .map(([id, server]) => ({
      id: server.id ?? id,
      category: server.category,
      purpose: server.purpose,
      trustLevel: server.trustLevel,
      readOnly: server.readOnly ?? server.referenceOnly,
      writeCapable: server.writeCapable ?? !server.referenceOnly,
      approvalRequired: server.approvalRequired ?? false,
      usageGuidance: server.usageGuidance ?? [],
      antiPatterns: server.antiPatterns ?? []
    }))
    .sort((left, right) => trustWeight(right.trustLevel) - trustWeight(left.trustLevel));
}

export function recommendNextSpecialist(options: {
  config: LoadedConfig;
  profileName: string;
  taskType: TaskType;
  fileArea: FileArea;
  blocked?: boolean;
}): SpecialistSelection {
  if (options.blocked) {
    return resolveSpecialist({
      config: options.config,
      profileName: options.profileName,
      taskType: "review",
      fileArea: options.fileArea,
      role: "reviewer",
      tool: "claude"
    });
  }

  return resolveSpecialist({
    config: options.config,
    profileName: options.profileName,
    taskType: options.taskType,
    fileArea: options.fileArea
  });
}

function trustWeight(level: "low" | "medium" | "high"): number {
  switch (level) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}
