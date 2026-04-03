import type { FileArea, LoadedConfig, SpecialistDefinition, TaskType, ToolName } from "./config.js";

export interface SpecialistSelection {
  specialistId: string;
  specialist: SpecialistDefinition;
  source: "explicit" | "role-default" | "inferred" | "fallback";
  reasons: string[];
}

export interface SpecialistCatalogEntry {
  specialistId: string;
  name: string;
  purpose: string;
  aliases: string[];
  allowedProfiles: string[];
  preferredTools: ToolName[];
  riskPosture: SpecialistDefinition["risk_posture"];
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
    const canonicalId = normalizeSpecialistId(options.config, options.explicitSpecialistId);
    const specialist = canonicalId ? registry.specialists[canonicalId] : undefined;
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
  projectType?: string;
  activeSpecialistId?: string;
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

  const projectType = options.projectType ?? "generic";
  const explicitSpecialistId = inferPreferredSpecialistId({
    config: options.config,
    projectType,
    taskType: options.taskType,
    fileArea: options.fileArea,
    ...(options.activeSpecialistId ? { activeSpecialistId: options.activeSpecialistId } : {})
  });

  if (explicitSpecialistId) {
    return resolveSpecialist({
      config: options.config,
      profileName: options.profileName,
      taskType: options.taskType,
      fileArea: options.fileArea,
      explicitSpecialistId
    });
  }

  return resolveSpecialist({
    config: options.config,
    profileName: options.profileName,
    taskType: options.taskType,
    fileArea: options.fileArea
  });
}

export function listSpecialists(options: {
  config: LoadedConfig;
  profileName?: string;
}): SpecialistCatalogEntry[] {
  return Object.values(options.config.specialists.specialists)
    .filter((specialist) => !options.profileName || specialist.allowed_profiles.includes(options.profileName))
    .map((specialist) => ({
      specialistId: specialist.id,
      name: specialist.name,
      purpose: specialist.purpose,
      aliases: specialist.aliases ?? [],
      allowedProfiles: specialist.allowed_profiles,
      preferredTools: specialist.preferred_tools,
      riskPosture: specialist.risk_posture
    }))
    .sort((left, right) => left.specialistId.localeCompare(right.specialistId));
}

export function isKnownSpecialistId(config: LoadedConfig, candidate: string | null | undefined): boolean {
  return Boolean(normalizeSpecialistId(config, candidate));
}

export function normalizeSpecialistId(
  config: LoadedConfig,
  candidate: string | null | undefined,
  fallbackSpecialistId?: string
): string | undefined {
  if (!candidate) {
    return fallbackSpecialistId;
  }

  if (config.specialists.specialists[candidate]) {
    return candidate;
  }

  const normalized = candidate.trim().toLowerCase();
  for (const specialist of Object.values(config.specialists.specialists)) {
    if ((specialist.aliases ?? []).some((alias) => alias.toLowerCase() === normalized)) {
      return specialist.id;
    }
  }

  return fallbackSpecialistId;
}

function inferPreferredSpecialistId(options: {
  config: LoadedConfig;
  projectType: string;
  taskType: TaskType;
  fileArea: FileArea;
  activeSpecialistId?: string;
}): string | undefined {
  const activeSpecialistId = normalizeSpecialistId(options.config, options.activeSpecialistId);
  if (activeSpecialistId && options.taskType === "implementation") {
    return activeSpecialistId;
  }

  if (options.taskType === "release-readiness") {
    return "release-specialist";
  }
  if (options.taskType === "review") {
    return options.fileArea === "docs" ? "docs-specialist" : "review-specialist";
  }
  if (options.taskType === "testing") {
    return "qa-specialist";
  }
  if (options.taskType === "refactor") {
    return "refactor-specialist";
  }
  if (options.taskType === "docs" || options.fileArea === "docs") {
    return "docs-specialist";
  }
  if (options.taskType === "migration" || options.fileArea === "data" || options.projectType === "data-platform") {
    return "data-platform-specialist";
  }
  if (options.taskType === "planning" && (options.fileArea === "context" || options.fileArea === "config")) {
    return "architecture-specialist";
  }
  if (options.projectType === "python") {
    return "python-specialist";
  }
  if (options.projectType === "node") {
    if (options.fileArea === "tests") {
      return "qa-specialist";
    }
    if (options.fileArea === "application") {
      return "fullstack-specialist";
    }
  }
  if (options.projectType === "android") {
    return "android-specialist";
  }
  if (options.projectType === "ios" || options.projectType === "macos") {
    return "ios-specialist";
  }
  if (options.fileArea === "infra") {
    return "backend-specialist";
  }
  return undefined;
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
