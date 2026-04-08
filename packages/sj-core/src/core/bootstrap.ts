import type { GlobalBootstrapDefaults, LoadedConfig, ProjectType } from "./config.js";
import { getGlobalHomeRoot, loadGlobalBootstrapDefaults } from "./config.js";
import { initOrSyncTarget, summarizeWrites } from "./executor.js";
import { buildRepoContextSeedArtifacts, buildRepoContextTree, persistRepoContextSeedArtifacts, persistRepoContextTreeArtifacts } from "./context-tree.js";
import { buildBootstrapNextAction, buildBootstrapNextFileToRead, buildBootstrapNextSuggestedCommand, buildChecksToRun, buildFirstReadContract } from "./guidance.js";
import { inspectBootstrapTarget, type BootstrapInspection } from "./project-detect.js";
import { PRODUCT_METADATA } from "./product.js";
import { loadProjectOverlay, resolveExecutionMode, type ProfileSelection } from "./profiles.js";
import { buildTemplateContext, selectPortableContract, type TemplateContext } from "./router.js";
import { loadActiveRoleHints, updateActiveRoleHints } from "./state.js";
import type { WriteResult } from "../utils/fs.js";

export interface BootstrapOptions {
  repoRoot: string;
  targetRoot: string;
  explicitProfileName?: string;
  explicitProjectType?: ProjectType;
  dryRun?: boolean;
  diffSummary?: boolean;
  backup?: boolean;
}

export interface BootstrapPlan {
  inspection: BootstrapInspection;
  profileName: string;
  profileSource: "repo-authority" | "repo-local" | "cli" | "global-accelerator" | "project-type" | "fallback-default";
  executionMode: TemplateContext["executionMode"];
  starterSpecialists: string[];
  starterValidationHints: string[];
  starterMcpHints: string[];
  warnings: string[];
  globalHomeRoot: string;
  globalDefaultsFound: boolean;
  activeRole: string;
  supportingRoles: string[];
  firstReadPreview: string[];
  verificationCommands: string[];
  coreContractSurfaces: string[];
  optionalContractSurfaces: string[];
  relevantContractSurfaces: string[];
  skippedContractSurfaces: string[];
  results: WriteResult[];
  nextFileToRead: string;
  nextSuggestedCommand: string;
  recommendedNextCommand: string;
}

export interface PreparedBootstrapContext {
  inspection: BootstrapInspection;
  overlay: Awaited<ReturnType<typeof loadProjectOverlay>>;
  profileResolution: {
    profileName: string;
    profile: LoadedConfig["routing"]["profiles"][string];
    source: BootstrapPlan["profileSource"];
  };
  starterSpecialists: string[];
  starterValidationHints: string[];
  starterMcpHints: string[];
  executionMode: TemplateContext["executionMode"];
  globalDefaults: GlobalBootstrapDefaults | null;
  context: TemplateContext;
}

export async function prepareBootstrapContext(options: BootstrapOptions, config: LoadedConfig): Promise<PreparedBootstrapContext> {
  const inspection = await inspectBootstrapTarget(options.targetRoot, config, options.explicitProjectType);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const globalDefaults = await loadGlobalBootstrapDefaults();
  const profileResolution = resolveBootstrapProfile({
    config,
    inspection,
    ...(overlay?.profile ? { overlayProfile: overlay.profile } : {}),
    ...(options.explicitProfileName ? { explicitProfileName: options.explicitProfileName } : {}),
    globalDefaults
  });
  const starterSpecialists = resolveStarterSpecialists(config, inspection.projectType, profileResolution.profileName, globalDefaults);
  const starterValidationHints = resolveStarterValidationHints(inspection.projectType, globalDefaults);
  const starterMcpHints = resolveStarterMcpHints(config, inspection.projectType, profileResolution.profileName, globalDefaults);
  const executionMode = resolveExecutionMode(
    config,
    {
      profileName: profileResolution.profileName,
      profile: profileResolution.profile,
      source:
        profileResolution.source === "repo-authority" ||
        profileResolution.source === "repo-local" ||
        profileResolution.source === "cli"
          ? profileResolution.source
          : "fallback-default"
    } satisfies ProfileSelection,
    overlay
  );
  const context = buildTemplateContext(options.targetRoot, config, {
    profileName: profileResolution.profileName,
    executionMode,
    projectType: inspection.projectType,
    profileSource: profileResolution.source,
    starterSpecialists: starterSpecialists.join(", "),
    starterValidations: starterValidationHints.join(", "),
    starterMcpHints: starterMcpHints.join(", ")
  });

  return {
    inspection,
    overlay,
    profileResolution,
    starterSpecialists,
    starterValidationHints,
    starterMcpHints,
    executionMode,
    globalDefaults,
    context
  };
}

export async function bootstrapTarget(options: BootstrapOptions, config: LoadedConfig): Promise<BootstrapPlan> {
  const prepared = await prepareBootstrapContext(options, config);
  const { inspection, profileResolution, starterSpecialists, starterValidationHints, starterMcpHints, executionMode, globalDefaults, context } = prepared;
  const contract = selectPortableContract(config, context);

  const results = inspection.authorityOptOut
    ? []
    : await initOrSyncTarget(options.repoRoot, options.targetRoot, config, context, {
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
      diffSummary: options.diffSummary ?? options.dryRun ?? false,
        backup: options.backup ?? false,
        backupLabel: context.generatedAt.replace(/[:.]/g, "-")
      });
  const repoAwareResults =
    inspection.authorityOptOut || options.dryRun
      ? []
      : await syncRepoAwareBootstrapArtifacts(options.targetRoot, {
          projectName: context.projectName,
          projectType: inspection.projectType,
          profileName: profileResolution.profileName,
          profileSource: profileResolution.source,
          activeRole: contract.activeRole,
          recommendedMcpPack: starterMcpHints[0] ?? "core-pack",
          nextRecommendedSpecialist: starterSpecialists[0] ?? contract.activeRole,
          nextSuggestedCommand: buildBootstrapNextSuggestedCommand(options.targetRoot)
        });

  const warnings = buildBootstrapWarnings(inspection, profileResolution.source, options.explicitProfileName);
  const combinedResults = [...results, ...repoAwareResults];
  const hasConflicts = combinedResults.some((result) => result.status === "conflict");
  const recommendedNextCommand = inspection.authorityOptOut
    ? `Review ${inspection.authorityOptOut} and only bootstrap if the repo explicitly opts in.`
    : hasConflicts
      ? `${PRODUCT_METADATA.cli.primaryCommand} sync --target "${options.targetRoot}" --dry-run --diff-summary`
      : `${PRODUCT_METADATA.cli.primaryCommand} status --target "${options.targetRoot}"`;
  const nextSuggestedCommand = inspection.authorityOptOut
    ? recommendedNextCommand
    : hasConflicts
      ? recommendedNextCommand
      : buildBootstrapNextSuggestedCommand(options.targetRoot);

  return {
    inspection,
    profileName: profileResolution.profileName,
    profileSource: profileResolution.source,
    executionMode,
    starterSpecialists,
    starterValidationHints,
    starterMcpHints,
    warnings,
    globalHomeRoot: getGlobalHomeRoot(),
    globalDefaultsFound: Boolean(globalDefaults),
    activeRole: contract.activeRole,
    supportingRoles: contract.supportingRoles,
    firstReadPreview: buildFirstReadContract({
      targetRoot: options.targetRoot,
      contract
    }).slice(0, 8),
    verificationCommands: buildChecksToRun(starterValidationHints),
    coreContractSurfaces: contract.coreSurfaces,
    optionalContractSurfaces: [
      ...contract.instructionSurfaces,
      ...contract.agentSurfaces,
      ...contract.roleSurfaces,
      ...contract.ciSurfaces
    ],
    relevantContractSurfaces: [
      ...contract.coreSurfaces,
      ...contract.instructionSurfaces,
      ...contract.agentSurfaces,
      ...contract.roleSurfaces,
      ...contract.ciSurfaces
    ],
    skippedContractSurfaces: contract.skippedSurfaces,
    results: combinedResults,
    nextFileToRead: buildBootstrapNextFileToRead(),
    nextSuggestedCommand,
    recommendedNextCommand
  };
}

export function formatBootstrapSummary(plan: BootstrapPlan): string {
  const lines = [
    "bootstrap summary",
    `- target kind: ${plan.inspection.targetKind}`,
    `- already initialized: ${plan.inspection.alreadyInitialized ? "yes" : "no"}`,
    `- detected project type: ${plan.inspection.projectType} (${plan.inspection.projectTypeSource})`,
    `- selected profile: ${plan.profileName} (${plan.profileSource})`,
    `- execution mode: ${plan.executionMode}`,
    `- global defaults: ${plan.globalDefaultsFound ? `loaded from ${plan.globalHomeRoot}` : `not found at ${plan.globalHomeRoot}`}`,
    `- authority files: ${plan.inspection.existingAuthorityFiles.length ? plan.inspection.existingAuthorityFiles.join(", ") : "none"}`,
    `- active role: ${plan.activeRole}`,
    `- supporting roles: ${plan.supportingRoles.join(", ") || "none"}`,
    `- starter specialists: ${plan.starterSpecialists.join(", ") || "none"}`,
    `- starter validations: ${plan.starterValidationHints.join(", ") || "none"}`,
    `- starter MCP hints: ${plan.starterMcpHints.join(", ") || "none"}`,
    `- first read preview: ${plan.firstReadPreview.join(", ") || "none"}`,
    `- relevant contract surfaces: ${plan.relevantContractSurfaces.slice(0, 8).join(", ") || "none"}`,
    `- skipped as irrelevant: ${plan.skippedContractSurfaces.slice(0, 8).join(", ") || "none"}`,
    `- verification commands: ${plan.verificationCommands.join(" | ") || buildBootstrapNextAction()}`,
    `- next file to open: ${plan.nextFileToRead}`,
    `- next command: ${plan.nextSuggestedCommand}`
  ];

  if (plan.warnings.length) {
    lines.push("- warnings:");
    for (const warning of plan.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  lines.push("- write plan:");
  lines.push(summarizeWrites(plan.results, plan.inspection.targetRoot, { diffSummary: true, dryRun: true }));
  lines.push(`- recommended next command: ${plan.recommendedNextCommand}`);
  return lines.join("\n");
}

interface BootstrapProfileInputs {
  config: LoadedConfig;
  inspection: BootstrapInspection;
  overlayProfile?: string | undefined;
  explicitProfileName?: string | undefined;
  globalDefaults: GlobalBootstrapDefaults | null;
}

function resolveBootstrapProfile(inputs: BootstrapProfileInputs): {
  profileName: string;
  profile: LoadedConfig["routing"]["profiles"][string];
  source: BootstrapPlan["profileSource"];
} {
  const { config, inspection, overlayProfile, explicitProfileName, globalDefaults } = inputs;

  const authorityProfile = inspection.authorityProfileHint;
  if (authorityProfile && config.routing.profiles[authorityProfile]) {
    return {
      profileName: authorityProfile,
      profile: config.routing.profiles[authorityProfile],
      source: "repo-authority"
    };
  }

  if (overlayProfile && config.routing.profiles[overlayProfile]) {
    return {
      profileName: overlayProfile,
      profile: config.routing.profiles[overlayProfile],
      source: "repo-local"
    };
  }

  if (explicitProfileName && config.routing.profiles[explicitProfileName]) {
    return {
      profileName: explicitProfileName,
      profile: config.routing.profiles[explicitProfileName],
      source: "cli"
    };
  }

  const globalProfile = globalDefaults?.project_type_profiles?.[inspection.projectType] || globalDefaults?.default_profile;
  if (globalProfile && config.routing.profiles[globalProfile]) {
    return {
      profileName: globalProfile,
      profile: config.routing.profiles[globalProfile],
      source: "global-accelerator"
    };
  }

  const projectTypeProfile = fallbackProfilesByProjectType[inspection.projectType];
  if (projectTypeProfile && config.routing.profiles[projectTypeProfile]) {
    return {
      profileName: projectTypeProfile,
      profile: config.routing.profiles[projectTypeProfile],
      source: "project-type"
    };
  }

  return {
    profileName: config.global.defaults.default_profile,
    profile: config.routing.profiles[config.global.defaults.default_profile] ?? config.routing.profiles["product-build"]!,
    source: "fallback-default"
  };
}

export async function syncRepoAwareBootstrapArtifacts(
  targetRoot: string,
  options: {
    projectName: string;
    projectType: ProjectType | string;
    profileName: string;
    profileSource: string;
    activeRole: string;
    recommendedMcpPack: string;
    nextRecommendedSpecialist: string;
    nextSuggestedCommand: string;
  }
): Promise<WriteResult[]> {
  const { state, view } = await buildRepoContextTree(targetRoot, options.projectType);
  const treeResults = await persistRepoContextTreeArtifacts(targetRoot, state, view);
  const memoryResults = await persistRepoContextSeedArtifacts(
    targetRoot,
    buildRepoContextSeedArtifacts(state, {
      projectName: options.projectName,
      projectType: options.projectType,
      profile: options.profileName,
      authoritySource: options.profileSource,
      activeRole: options.activeRole,
      recommendedMcpPack: options.recommendedMcpPack,
      nextRecommendedSpecialist: options.nextRecommendedSpecialist,
      nextSuggestedCommand: options.nextSuggestedCommand
    })
  );
  const existingHints = await loadActiveRoleHints(targetRoot).catch(() => null);
  const preserveContinuity = Boolean(
    existingHints?.latestTaskPacket
      || existingHints?.latestHandoff
      || existingHints?.latestDispatchManifest
      || existingHints?.latestReconcile
  );
  await updateActiveRoleHints(targetRoot, {
    activeRole: preserveContinuity ? existingHints?.activeRole ?? options.activeRole : options.activeRole,
    authoritySource: options.profileSource,
    projectType:
      preserveContinuity && existingHints?.projectType && existingHints.projectType !== "generic"
        ? existingHints.projectType
        : String(options.projectType),
    nextFileToRead: preserveContinuity ? existingHints?.nextFileToRead ?? ".agent/context/context-tree.json" : ".agent/context/context-tree.json",
    nextSuggestedCommand: preserveContinuity ? existingHints?.nextSuggestedCommand ?? options.nextSuggestedCommand : options.nextSuggestedCommand,
    nextAction: preserveContinuity ? existingHints?.nextAction ?? buildBootstrapNextAction() : buildBootstrapNextAction(),
    nextRecommendedSpecialist:
      preserveContinuity ? existingHints?.nextRecommendedSpecialist ?? options.nextRecommendedSpecialist : options.nextRecommendedSpecialist,
    nextSuggestedMcpPack: preserveContinuity ? existingHints?.nextSuggestedMcpPack ?? options.recommendedMcpPack : options.recommendedMcpPack,
    latestMemoryFocus: ".agent/memory/current-focus.json"
  }).catch(() => null);
  return [...treeResults, ...memoryResults];
}

function resolveStarterSpecialists(
  config: LoadedConfig,
  projectType: ProjectType,
  profileName: string,
  globalDefaults: GlobalBootstrapDefaults | null
): string[] {
  const configured = globalDefaults?.project_type_specialists?.[projectType] ?? [];
  const normalizedConfigured =
    projectType === "generic"
      ? configured.filter((specialistId) => genericStarterSpecialists.has(specialistId))
      : configured;
  const candidates = Array.from(new Set([...normalizedConfigured, ...fallbackSpecialistsByProjectType[projectType]]));
  return candidates.filter((specialistId) => {
    const specialist = config.specialists.specialists[specialistId];
    return Boolean(specialist && specialist.allowed_profiles.includes(profileName));
  });
}

function resolveStarterValidationHints(projectType: ProjectType, globalDefaults: GlobalBootstrapDefaults | null): string[] {
  return globalDefaults?.project_type_validation_hints?.[projectType] ?? fallbackValidationsByProjectType[projectType];
}

function resolveStarterMcpHints(
  config: LoadedConfig,
  projectType: ProjectType,
  profileName: string,
  globalDefaults: GlobalBootstrapDefaults | null
): string[] {
  const configured = globalDefaults?.project_type_mcp_hints?.[projectType];
  if (configured?.length) {
    return configured;
  }

  return Object.values(config.mcpServers.mcpServers)
    .filter((server) => server.repoEligible && server.allowedProfiles.includes(profileName) && server.referenceOnly === false)
    .sort((left, right) => trustWeight(right.trustLevel) - trustWeight(left.trustLevel))
    .slice(0, 3)
    .map((server) => server.id ?? server.category);
}

function buildBootstrapWarnings(
  inspection: BootstrapInspection,
  profileSource: BootstrapPlan["profileSource"],
  explicitProfileName?: string
): string[] {
  const warnings: string[] = [];

  if (inspection.authorityProfileHint && explicitProfileName && inspection.authorityProfileHint !== explicitProfileName) {
    warnings.push(`explicit profile ${explicitProfileName} was not used because repo authority already points to ${inspection.authorityProfileHint}`);
  }
  if (inspection.alreadyInitialized) {
    warnings.push("target already contains Kiwi Control state; bootstrap is acting like a safe sync/update");
  }
  if (inspection.authorityOptOut) {
    warnings.push(`repo authority requests repo-local-only behavior; bootstrap stood down (${inspection.authorityOptOut})`);
  }
  if (inspection.targetKind !== "empty-folder" && profileSource === "project-type") {
    warnings.push("no explicit profile was found in repo authority; starter profile was inferred from top-level metadata");
  }

  return warnings;
}

const fallbackProfilesByProjectType: Record<ProjectType, string> = {
  python: "product-build",
  node: "product-build",
  docs: "documentation-heavy",
  "data-platform": "data-platform",
  generic: "product-build"
};

const fallbackSpecialistsByProjectType: Record<ProjectType, string[]> = {
  python: ["python-specialist", "backend-specialist", "qa-specialist", "security-specialist"],
  node: ["fullstack-specialist", "frontend-specialist", "backend-specialist", "qa-specialist"],
  docs: ["docs-specialist", "qa-specialist"],
  "data-platform": ["data-platform-specialist", "backend-specialist", "qa-specialist", "security-specialist"],
  generic: ["architecture-specialist", "review-specialist", "qa-specialist", "docs-specialist"]
};

const genericStarterSpecialists = new Set([
  "architecture-specialist",
  "review-specialist",
  "qa-specialist",
  "docs-specialist"
]);

const fallbackValidationsByProjectType: Record<ProjectType, string[]> = {
  python: ["ruff", "mypy", "pytest", `${PRODUCT_METADATA.cli.primaryCommand} check`],
  node: ["npm test", "npm run build", `${PRODUCT_METADATA.cli.primaryCommand} check`],
  docs: ["docs preview/build", `${PRODUCT_METADATA.cli.primaryCommand} check`],
  "data-platform": ["unit or transform tests", "migration review", `${PRODUCT_METADATA.cli.primaryCommand} check`],
  generic: ["project tests", `${PRODUCT_METADATA.cli.primaryCommand} check`]
};

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
