import path from "node:path";
import { promises as fs } from "node:fs";
import type { LoadedConfig } from "./config.js";
import type { ProfileSelection, ProjectOverlay } from "./profiles.js";
import { compileRepoContext } from "./context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "./dispatch.js";
import { initOrSyncTarget } from "./executor.js";
import { buildFanoutPackets, buildRunPackets } from "./planner.js";
import { inspectBootstrapTarget } from "./project-detect.js";
import { loadProjectOverlay, resolveExecutionMode } from "./profiles.js";
import { loadLatestReconcileReport } from "./reconcile.js";
import { buildTemplateContext, resolveRoutingDecision, selectPortableContract, type PortableContractSelection } from "./router.js";
import { assessGoalRisk } from "./risk.js";
import { getStatePaths, loadActiveRoleHints, loadContinuitySnapshot, loadLatestCheckpoint } from "./state.js";
import { hasConsistentManagedMarkers, isIgnoredArtifactName, pathExists, readJson, readText } from "../utils/fs.js";
import { parseYaml } from "../utils/yaml.js";

export interface ValidationIssue {
  level: "error" | "warn";
  message: string;
  filePath?: string;
}

export async function validateControlPlane(repoRoot: string, config: LoadedConfig): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (config.global.version !== 2) {
    issues.push({ level: "error", message: "global.yaml version must be 2", filePath: path.join(repoRoot, "configs", "global.yaml") });
  }
  if (config.routing.version !== 2) {
    issues.push({ level: "error", message: "routing.yaml version must be 2", filePath: path.join(repoRoot, "configs", "routing.yaml") });
  }
  if (config.models.version !== 2) {
    issues.push({ level: "error", message: "models.yaml version must be 2", filePath: path.join(repoRoot, "configs", "models.yaml") });
  }
  if (config.guardrails.version !== 2) {
    issues.push({ level: "error", message: "guardrails.yaml version must be 2", filePath: path.join(repoRoot, "configs", "guardrails.yaml") });
  }
  if (config.mcpServers.version !== 2) {
    issues.push({ level: "error", message: "mcp.servers.json version must be 2", filePath: path.join(repoRoot, "configs", "mcp.servers.json") });
  }

  for (const relativePath of [
    "docs/repo-first-upgrade-plan.md",
    "docs/repo-contract-spec.md",
    "docs/contract-minimization.md",
    "docs/copilot-integration.md",
    "docs/claude-role-integration.md",
    "docs/active-role-hints.md",
    "docs/checkpointing.md",
    "docs/artifact-contracts.md",
    "docs/bootstrap-and-standardize.md",
    "docs/global-accelerators.md",
    "docs/ci-enforcement.md",
    "docs/daily-workflow.md",
    "docs/repo-lifecycle.md",
    "docs/technical-architecture.md",
    "docs/repo-first-upgrade-closeout.md",
    "docs/discovery-report.md",
    "docs/architecture.md",
    "docs/migration-plan.md",
    "docs/safety-model.md",
    "docs/managed-files.md",
    "docs/global-bootstrap.md",
    "docs/defaults-precedence.md",
    "docs/global-adapter-strategy.md",
    "docs/global-integration.md",
    "docs/mcp-inventory.md",
    "docs/phase-continuity.md",
    "docs/skill-inventory.md",
    "docs/specialists.md",
    "docs/multi-agent-coordination.md",
    "docs/tool-awareness.md",
    "docs/result-schema.md",
    "prompts/planner.md",
    "prompts/implementer.md",
    "prompts/reviewer.md",
    "prompts/tester.md",
    "prompts/security.md",
    "prompts/summarizer.md",
    "prompts/migration.md",
    "prompts/refactor.md",
    "prompts/bugfix.md",
    "prompts/release-readiness.md",
    "templates/project/AGENTS.md",
    "templates/project/CLAUDE.md",
    "templates/project/.github/copilot-instructions.md",
    "templates/project/.github/instructions/backend.instructions.md",
    "templates/project/.github/instructions/frontend.instructions.md",
    "templates/project/.github/instructions/docs.instructions.md",
    "templates/project/.github/instructions/data.instructions.md",
    "templates/project/.github/agents/shrey-junior.md",
    "templates/project/.github/agents/specialist-agent.md",
    "templates/project/.github/workflows/shrey-junior-contract.yml",
    "templates/project/.agent/project.yaml",
    "templates/project/.agent/checks.yaml",
    "templates/project/.agent/context/architecture.md",
    "templates/project/.agent/context/commands.md",
    "templates/project/.agent/context/conventions.md",
    "templates/project/.agent/context/tool-capabilities.md",
    "templates/project/.agent/context/mcp-capabilities.md",
    "templates/project/.agent/context/runbooks.md",
    "templates/project/.agent/roles/README.md",
    "templates/project/.agent/roles/specialist-role.md",
    "templates/project/.agent/templates/role-result.md",
    "templates/project/.agent/state/current-phase.json",
    "templates/project/.agent/state/active-role-hints.json",
    "templates/project/.agent/state/checkpoints/latest.json",
    "templates/project/.agent/state/checkpoints/latest.md",
    "templates/project/.agent/state/handoff/README.md",
    "templates/project/.agent/state/dispatch/README.md",
    "templates/project/.agent/state/reconcile/README.md",
    "templates/project/.agent/scripts/verify-contract.sh",
    "scripts/install-global.sh",
    "scripts/backup-global.sh",
    "scripts/verify-global.sh",
    "scripts/verify-global-hard.sh",
    "scripts/apply-global-preferences.sh",
    "scripts/restore-global.sh"
  ]) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!(await pathExists(fullPath))) {
      issues.push({ level: "error", message: "required file missing", filePath: fullPath });
    }
  }

  if (!config.routing.profiles[config.global.defaults.default_profile]) {
    issues.push({
      level: "error",
      message: `default profile ${config.global.defaults.default_profile} is not defined`,
      filePath: path.join(repoRoot, "configs", "routing.yaml")
    });
  }

  for (const [profileName, profile] of Object.entries(config.routing.profiles)) {
    if (!config.guardrails.execution_modes[profile.default_execution_mode]) {
      issues.push({
        level: "error",
        message: `profile ${profileName} uses unknown execution mode ${profile.default_execution_mode}`,
        filePath: path.join(repoRoot, "configs", "routing.yaml")
      });
    }
    if (!profile.routing.task_types.implementation) {
      issues.push({
        level: "warn",
        message: `profile ${profileName} does not define an implementation route`,
        filePath: path.join(repoRoot, "configs", "routing.yaml")
      });
    }
  }

  for (const specialistId of [
    "python-specialist",
    "data-platform-specialist",
    "frontend-specialist",
    "backend-specialist",
    "fullstack-specialist",
    "qa-specialist",
    "review-specialist",
    "push-specialist",
    "release-specialist",
    "refactor-specialist",
    "security-specialist",
    "docs-specialist",
    "architecture-specialist",
    "mcp-specialist"
  ]) {
    if (!config.specialists.specialists[specialistId]) {
      issues.push({
        level: "error",
        message: `required specialist missing: ${specialistId}`,
        filePath: path.join(repoRoot, "configs", "specialists.yaml")
      });
    }
  }

  for (const mcpId of ["context7", "filesystem", "github", "playwright", "sequential-thinking", "exa", "firecrawl", "docker"]) {
    if (!config.mcpServers.mcpServers[mcpId]) {
      issues.push({
        level: "warn",
        message: `recommended MCP capability missing: ${mcpId}`,
        filePath: path.join(repoRoot, "configs", "mcp.servers.json")
      });
    }
  }

  for (const promptName of [
    ...Object.values(config.models.task_prompts),
    ...Object.values(config.models.fanout_roles).map((value) => value.prompt),
    ...Object.values(config.models.tool_packets).map((value) => value.default_prompt)
  ]) {
    const promptPath = path.join(repoRoot, "prompts", `${promptName}.md`);
    if (!(await pathExists(promptPath))) {
      issues.push({ level: "error", message: `referenced prompt missing: ${promptName}`, filePath: promptPath });
    }
  }

  const workflowAwareTemplates: Array<{ relativePath: string; requiredSnippets: string[] }> = [
    {
      relativePath: "templates/project/AGENTS.md",
      requiredSnippets: ["active-role-hints.json", "push-check", "dispatch", "promoted canonical docs"]
    },
    {
      relativePath: "templates/project/CLAUDE.md",
      requiredSnippets: ["active-role-hints.json", "latest handoff", "policy", "release-check"]
    },
    {
      relativePath: "templates/project/.github/copilot-instructions.md",
      requiredSnippets: ["active-role-hints.json", "non-trivial", "packet", "policy"]
    }
  ];

  for (const template of workflowAwareTemplates) {
    const fullPath = path.join(repoRoot, template.relativePath);
    if (!(await pathExists(fullPath))) {
      continue;
    }
    const content = await readText(fullPath);
    for (const snippet of template.requiredSnippets) {
      if (!content.includes(snippet)) {
        issues.push({
          level: "warn",
          message: `workflow-awareness snippet missing: ${snippet}`,
          filePath: fullPath
        });
      }
    }
  }

  return issues;
}

export async function validateTargetRepo(
  targetRoot: string,
  config: LoadedConfig,
  selection: ProfileSelection
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const inspection = await inspectBootstrapTarget(targetRoot, config);
  const overlay = await loadProjectOverlay(targetRoot);
  const executionMode = resolveExecutionMode(config, selection, overlay);
  const fallbackContract = selectPortableContract(
    config,
    buildTemplateContext(targetRoot, config, {
      profileName: selection.profileName,
      executionMode,
      projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
      profileSource: selection.source,
      starterSpecialists: overlay?.bootstrap?.specialist_suggestions ?? ""
    })
  );
  const declaredContract = resolveDeclaredContract(overlay, fallbackContract);
  const requiredRepoFiles = [
    ...declaredContract.core,
    ...declaredContract.instructions,
    ...declaredContract.agentSurfaces,
    ...declaredContract.roleSpecs,
    ...declaredContract.ciSurfaces
  ].filter((relativePath) => !["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"].includes(relativePath));

  for (const relativePath of requiredRepoFiles) {
    const fullPath = path.join(targetRoot, relativePath);
    if (!(await pathExists(fullPath))) {
      issues.push({
        level: inspection.alreadyInitialized ? "error" : "warn",
        message: "generated repo-local state missing",
        filePath: fullPath
      });
      continue;
    }

    if (relativePath.endsWith(".yaml")) {
      try {
        const content = await readText(fullPath);
        parseYaml(content);
        if (content.includes("SHREY-JUNIOR") && !hasConsistentManagedMarkers(content)) {
          issues.push({ level: "error", message: "managed markers are unbalanced", filePath: fullPath });
        }
      } catch (error) {
        issues.push({
          level: "error",
          message: `invalid YAML: ${(error as Error).message}`,
          filePath: fullPath
        });
      }
    }

    if (relativePath.endsWith(".json")) {
      try {
        await readJson(fullPath);
      } catch (error) {
        issues.push({
          level: "error",
          message: `invalid JSON: ${(error as Error).message}`,
          filePath: fullPath
        });
      }
    }
  }

  for (const relativePath of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]) {
    const fullPath = path.join(targetRoot, relativePath);
    if (!(await pathExists(fullPath))) {
      issues.push({
        level: inspection.alreadyInitialized ? "error" : "warn",
        message: "native repo surface missing",
        filePath: fullPath
      });
      continue;
    }

    const content = await readText(fullPath);
    if (!content.includes("SHREY-JUNIOR")) {
      issues.push({ level: "warn", message: "surface exists without managed markers", filePath: fullPath });
    }
    if (!hasConsistentManagedMarkers(content)) {
      issues.push({ level: "error", message: "managed markers are unbalanced", filePath: fullPath });
    }
  }

  const expectedRoleFiles = declaredContract.roleSpecs.filter((relativePath) => relativePath.endsWith(".md"));
  if (expectedRoleFiles.length === 0) {
    issues.push({
      level: inspection.alreadyInitialized ? "error" : "warn",
      message: "repo contract resolved no specialist role specs",
      filePath: path.join(targetRoot, ".agent", "roles")
    });
  }

  const roleDir = path.join(targetRoot, ".agent", "roles");
  if (await pathExists(roleDir)) {
    const roleFiles = (await fs.readdir(roleDir))
      .filter((entry) => entry.endsWith(".md") && entry !== "README.md" && !isIgnoredArtifactName(entry));
    if (roleFiles.length === 0) {
      issues.push({
        level: inspection.alreadyInitialized ? "error" : "warn",
        message: "no specialist role specs were generated",
        filePath: roleDir
      });
    }
  }

  const expectedAgentFiles = declaredContract.agentSurfaces.filter((relativePath) => relativePath.endsWith(".md") && !relativePath.endsWith("shrey-junior.md"));
  const githubAgentsDir = path.join(targetRoot, ".github", "agents");
  if (await pathExists(githubAgentsDir)) {
    const agentFiles = (await fs.readdir(githubAgentsDir))
      .filter((entry) => entry.endsWith(".md") && entry !== "shrey-junior.md" && !isIgnoredArtifactName(entry));
    if (agentFiles.length === 0 && expectedAgentFiles.length > 0) {
      issues.push({
        level: inspection.alreadyInitialized ? "error" : "warn",
        message: "no specialist agent surfaces were generated",
        filePath: githubAgentsDir
      });
    }
  }

  if (overlay?.profile && !config.routing.profiles[overlay.profile]) {
    issues.push({
      level: "error",
      message: `target repo references unknown profile ${overlay.profile}`,
      filePath: path.join(targetRoot, ".agent", "project.yaml")
    });
  }

  if (overlay?.profile && overlay.profile !== selection.profileName) {
    issues.push({
      level: "warn",
      message: `validation profile ${selection.profileName} differs from repo overlay profile ${overlay.profile}`,
      filePath: path.join(targetRoot, ".agent", "project.yaml")
    });
  }

  const risk = assessGoalRisk("stabilize shared repo guidance");
  const decision = resolveRoutingDecision(config, {
    goal: "stabilize shared repo guidance",
    profile: selection,
    executionMode,
    riskLevel: risk.level
  });
  const context = buildTemplateContext(targetRoot, config, {
    profileName: selection.profileName,
    executionMode,
    projectType: overlay?.bootstrap?.project_type ?? inspection.projectType,
    profileSource: selection.source,
    starterSpecialists: overlay?.bootstrap?.specialist_suggestions ?? ""
  });

  try {
    const compiledContext = await compileRepoContext({
      targetRoot,
      config,
      profileName: selection.profileName,
      profile: selection.profile,
      overlay,
      executionMode,
      taskType: decision.taskType,
      fileArea: decision.fileArea,
      changeSize: decision.changeSize,
      riskLevel: decision.riskLevel
    });
    for (const conflict of compiledContext.conflicts) {
      issues.push({
        level: conflict.severity === "error" ? "error" : "warn",
        message: conflict.message
      });
    }

    const continuity = await loadContinuitySnapshot(targetRoot);
    const runPackets = await buildRunPackets(config.repoRoot, config, context, "stabilize shared repo guidance", decision, compiledContext, continuity);
    const fanoutPackets = await buildFanoutPackets(config.repoRoot, config, context, "stabilize shared repo guidance", decision, compiledContext, continuity);
    if (runPackets.length !== 3 || fanoutPackets.length !== 4) {
      issues.push({ level: "error", message: "packet generation returned an unexpected packet count" });
    }
  } catch (error) {
    issues.push({ level: "error", message: `context or packet generation failed: ${(error as Error).message}` });
  }

  const statePaths = getStatePaths(targetRoot);
  if (await pathExists(statePaths.currentPhase)) {
    try {
      const currentPhase = await readJson<Record<string, unknown>>(statePaths.currentPhase);
      if (currentPhase.artifactType !== "shrey-junior/current-phase") {
        issues.push({
          level: "error",
          message: "current phase artifactType must be shrey-junior/current-phase",
          filePath: statePaths.currentPhase
        });
      }
      if (typeof currentPhase.timestamp !== "string" || !currentPhase.timestamp) {
        issues.push({
          level: "error",
          message: "current phase must declare timestamp",
          filePath: statePaths.currentPhase
        });
      }
      if (typeof currentPhase.nextRecommendedStep !== "string" || !currentPhase.nextRecommendedStep) {
        issues.push({
          level: "error",
          message: "current phase must declare nextRecommendedStep",
          filePath: statePaths.currentPhase
        });
      }
    } catch (error) {
      issues.push({
        level: "error",
        message: `invalid current phase json: ${(error as Error).message}`,
        filePath: statePaths.currentPhase
      });
    }
  }
  const hasActiveRoleHintsFile = await pathExists(statePaths.activeRoleHints);
  let activeRoleHints: Awaited<ReturnType<typeof loadActiveRoleHints>> = null;
  if (hasActiveRoleHintsFile) {
    try {
      activeRoleHints = await loadActiveRoleHints(targetRoot);
    } catch (error) {
      issues.push({
        level: "error",
        message: `invalid active role hints json: ${(error as Error).message}`,
        filePath: statePaths.activeRoleHints
      });
    }
  }
  if (activeRoleHints) {
    if (activeRoleHints.artifactType !== "shrey-junior/active-role-hints") {
      issues.push({
        level: "error",
        message: "active role hints artifactType must be shrey-junior/active-role-hints",
        filePath: statePaths.activeRoleHints
      });
    }
    if (!activeRoleHints.updatedAt) {
      issues.push({
        level: "error",
        message: "active role hints must declare updatedAt",
        filePath: statePaths.activeRoleHints
      });
    }
    if (!activeRoleHints.activeRole) {
      issues.push({
        level: "error",
        message: "active role hints must declare activeRole",
        filePath: statePaths.activeRoleHints
      });
    }
    if (!Array.isArray(activeRoleHints.readNext) || activeRoleHints.readNext.length === 0) {
      issues.push({
        level: "error",
        message: "active role hints must declare readNext",
        filePath: statePaths.activeRoleHints
      });
    }
    if (!Array.isArray(activeRoleHints.checksToRun) || activeRoleHints.checksToRun.length === 0) {
      issues.push({
        level: "error",
        message: "active role hints must declare checksToRun",
        filePath: statePaths.activeRoleHints
      });
    }
    if (typeof activeRoleHints.nextAction !== "string" || !activeRoleHints.nextAction.trim()) {
      issues.push({
        level: "error",
        message: "active role hints must declare nextAction",
        filePath: statePaths.activeRoleHints
      });
    }
    if (typeof activeRoleHints.nextFileToRead !== "string" || !activeRoleHints.nextFileToRead.trim()) {
      issues.push({
        level: "error",
        message: "active role hints must declare nextFileToRead",
        filePath: statePaths.activeRoleHints
      });
    }
    if (typeof activeRoleHints.nextSuggestedCommand !== "string" || !activeRoleHints.nextSuggestedCommand.trim()) {
      issues.push({
        level: "error",
        message: "active role hints must declare nextSuggestedCommand",
        filePath: statePaths.activeRoleHints
      });
    }
    if (!activeRoleHints.searchGuidance || typeof activeRoleHints.searchGuidance !== "object") {
      issues.push({
        level: "error",
        message: "active role hints must declare searchGuidance",
        filePath: statePaths.activeRoleHints
      });
    }
    for (const [field, value] of Object.entries({
      latestCheckpoint: activeRoleHints.latestCheckpoint,
      latestTaskPacket: activeRoleHints.latestTaskPacket,
      latestHandoff: activeRoleHints.latestHandoff,
      latestDispatchManifest: activeRoleHints.latestDispatchManifest,
      latestReconcile: activeRoleHints.latestReconcile
    })) {
      if (typeof value === "string" && value && !(await pathExists(path.join(targetRoot, value)))) {
        issues.push({
          level: "error",
          message: `active role hints pointer is stale: ${field} -> ${value}`,
          filePath: statePaths.activeRoleHints
        });
      }
    }
  } else if (inspection.alreadyInitialized && !hasActiveRoleHintsFile) {
    issues.push({
      level: "error",
      message: "active role hints file missing",
      filePath: statePaths.activeRoleHints
    });
  }

  const latestCheckpoint = await loadLatestCheckpoint(targetRoot);
  if (await pathExists(statePaths.latestCheckpointJson)) {
    try {
      const checkpoint = await readJson<Record<string, unknown>>(statePaths.latestCheckpointJson);
      if (checkpoint.artifactType !== "shrey-junior/checkpoint") {
        issues.push({
          level: "error",
          message: "latest checkpoint must declare shrey-junior/checkpoint",
          filePath: statePaths.latestCheckpointJson
        });
      }
      if (checkpoint.schemaVersion !== 1) {
        issues.push({
          level: "error",
          message: "latest checkpoint must declare schemaVersion 1",
          filePath: statePaths.latestCheckpointJson
        });
      }
      for (const key of ["createdAt", "phase", "activeRole", "authoritySource", "summary", "nextRecommendedAction", "nextSuggestedCommand"] as const) {
        if (typeof checkpoint[key] !== "string" || !String(checkpoint[key]).trim()) {
          issues.push({
            level: "error",
            message: `latest checkpoint must declare ${key}`,
            filePath: statePaths.latestCheckpointJson
          });
        }
      }
      if (!checkpoint.taskContext || typeof checkpoint.taskContext !== "object") {
        issues.push({
          level: "error",
          message: "latest checkpoint must declare taskContext",
          filePath: statePaths.latestCheckpointJson
        });
      }
      if (!checkpoint.dirtyState || typeof checkpoint.dirtyState !== "object") {
        issues.push({
          level: "error",
          message: "latest checkpoint must declare dirtyState",
          filePath: statePaths.latestCheckpointJson
        });
      }
      if (!Array.isArray(checkpoint.filesTouched) || !Array.isArray(checkpoint.stagedFiles)) {
        issues.push({
          level: "error",
          message: "latest checkpoint must declare filesTouched and stagedFiles",
          filePath: statePaths.latestCheckpointJson
        });
      }
    } catch (error) {
      issues.push({
        level: "error",
        message: `invalid latest checkpoint json: ${(error as Error).message}`,
        filePath: statePaths.latestCheckpointJson
      });
    }
  } else if (inspection.alreadyInitialized) {
    issues.push({
      level: "error",
      message: "latest checkpoint file missing",
      filePath: statePaths.latestCheckpointJson
    });
  }

  if (await pathExists(statePaths.latestCheckpointMarkdown)) {
    const latestMarkdown = await readText(statePaths.latestCheckpointMarkdown);
    if (!latestMarkdown.includes("# Checkpoint")) {
      issues.push({
        level: "error",
        message: "latest checkpoint markdown must include a heading",
        filePath: statePaths.latestCheckpointMarkdown
      });
    }
  } else if (inspection.alreadyInitialized) {
    issues.push({
      level: "error",
      message: "latest checkpoint markdown missing",
      filePath: statePaths.latestCheckpointMarkdown
    });
  }
  if (await pathExists(statePaths.handoffDir)) {
    const entries = await fs.readdir(statePaths.handoffDir);
    for (const entry of entries.filter((item) => item.endsWith(".json") && !isIgnoredArtifactName(item))) {
      const fullPath = path.join(statePaths.handoffDir, entry);
      try {
        const handoff = await readJson<Record<string, unknown>>(fullPath);
        if (handoff.artifactType !== "shrey-junior/handoff") {
          issues.push({
            level: "error",
            message: "handoff artifacts must declare shrey-junior/handoff",
            filePath: fullPath
          });
        }
        if (typeof handoff.createdAt !== "string" || !handoff.createdAt) {
          issues.push({
            level: "error",
            message: "handoff artifacts must declare createdAt",
            filePath: fullPath
          });
        }
        if (!Array.isArray(handoff.readFirst) || !Array.isArray(handoff.checksToRun)) {
          issues.push({
            level: "error",
            message: "handoff artifacts must declare readFirst and checksToRun",
            filePath: fullPath
          });
        }
      } catch (error) {
        issues.push({
          level: "error",
          message: `invalid handoff json: ${(error as Error).message}`,
          filePath: fullPath
        });
      }
    }
  }

  if (await pathExists(statePaths.latestTaskPackets)) {
    try {
      const latestTaskPackets = await readJson<Record<string, unknown>>(statePaths.latestTaskPackets);
      if (latestTaskPackets.artifactType !== "shrey-junior/latest-task-packets") {
        issues.push({
          level: "error",
          message: "latest task packet set should declare shrey-junior/latest-task-packets",
          filePath: statePaths.latestTaskPackets
        });
      }
      if (typeof latestTaskPackets.createdAt !== "string" || !latestTaskPackets.createdAt) {
        issues.push({
          level: "error",
          message: "latest task packet set must declare createdAt",
          filePath: statePaths.latestTaskPackets
        });
      }
      if (Array.isArray(latestTaskPackets.files)) {
        for (const filePath of latestTaskPackets.files as unknown[]) {
          if (typeof filePath === "string" && !(await pathExists(path.join(targetRoot, filePath)))) {
            issues.push({
              level: "error",
              message: `latest task packet set points to a missing file: ${filePath}`,
              filePath: statePaths.latestTaskPackets
            });
          }
        }
      }
    } catch (error) {
      issues.push({
        level: "error",
        message: `invalid latest task packet set json: ${(error as Error).message}`,
        filePath: statePaths.latestTaskPackets
      });
    }
  }

  const latestDispatch = await loadLatestDispatchManifest(targetRoot);
  if (latestDispatch) {
    if (latestDispatch.artifactType !== "shrey-junior/dispatch-manifest") {
      issues.push({
        level: "error",
        message: "latest dispatch manifest must declare shrey-junior/dispatch-manifest"
      });
    }
    if (!latestDispatch.createdAt) {
      issues.push({
        level: "error",
        message: "latest dispatch manifest must declare createdAt"
      });
    }
    if (latestDispatch.roleAssignments.length !== 4) {
      issues.push({
        level: "warn",
        message: "latest dispatch manifest does not contain the full four-role assignment set"
      });
    }
    const latestCollection = await loadLatestDispatchCollection(targetRoot, latestDispatch.dispatchId);
    if (latestCollection && latestCollection.roleResults.length !== latestDispatch.roleAssignments.length) {
      issues.push({
        level: "warn",
        message: "latest collection does not align with dispatch role assignments"
      });
    }
    if (latestCollection?.malformedRoles.length) {
      issues.push({
        level: "warn",
        message: `latest collection contains malformed structured outputs: ${latestCollection.malformedRoles.join(", ")}`
      });
    }
    if (latestCollection?.fallbackRoles.length) {
      issues.push({
        level: "warn",
        message: `latest collection relied on heuristic fallback parsing: ${latestCollection.fallbackRoles.join(", ")}`
      });
    }
    if (latestCollection) {
      if (latestCollection.artifactType !== "shrey-junior/dispatch-collect") {
        issues.push({
          level: "error",
          message: "latest dispatch collection must declare shrey-junior/dispatch-collect"
        });
      }
      if (!latestCollection.createdAt) {
        issues.push({
          level: "error",
          message: "latest dispatch collection must declare createdAt"
        });
      }
    }
    const latestReconcile = await loadLatestReconcileReport(targetRoot, latestDispatch.dispatchId);
    if (latestReconcile && latestReconcile.dispatchId !== latestDispatch.dispatchId) {
      issues.push({
        level: "warn",
        message: "latest reconcile report points to a different dispatch id"
      });
    }
    if (latestReconcile) {
      if (latestReconcile.artifactType !== "shrey-junior/reconcile-report") {
        issues.push({
          level: "error",
          message: "latest reconcile report must declare shrey-junior/reconcile-report"
        });
      }
      if (!latestReconcile.createdAt) {
        issues.push({
          level: "error",
          message: "latest reconcile report must declare createdAt"
        });
      }
    }
  }

  if (inspection.projectType === "generic") {
    for (const instructionSurface of declaredContract.instructions) {
      if (
        instructionSurface.endsWith("backend.instructions.md") ||
        instructionSurface.endsWith("frontend.instructions.md")
      ) {
        issues.push({
          level: "error",
          message: "generic repos must not install backend/frontend instruction surfaces by default",
          filePath: path.join(targetRoot, instructionSurface)
        });
      }
    }
  }

  if (latestCheckpoint && activeRoleHints?.latestCheckpoint && activeRoleHints.latestCheckpoint !== ".agent/state/checkpoints/latest.json") {
    issues.push({
      level: "error",
      message: "active role hints latestCheckpoint must point at .agent/state/checkpoints/latest.json",
      filePath: statePaths.activeRoleHints
    });
  }

  const preview = await initOrSyncTarget(config.repoRoot, targetRoot, config, context, { dryRun: true });
  if (preview.some((result) => result.status === "conflict")) {
    issues.push({ level: "warn", message: "sync preview found conflicts that require manual review" });
  }

  return issues;
}

function resolveDeclaredContract(
  overlay: ProjectOverlay | null,
  fallback: PortableContractSelection
): {
  core: string[];
  instructions: string[];
  agentSurfaces: string[];
  roleSpecs: string[];
  stateArtifacts: string[];
  ciSurfaces: string[];
} {
  const generated = overlay?.contract?.generated_surfaces;
  return {
    core: normalizePathList(generated?.core, fallback.coreSurfaces),
    instructions: normalizePathList(generated?.instructions, fallback.instructionSurfaces),
    agentSurfaces: normalizePathList(generated?.agent_surfaces, fallback.agentSurfaces),
    roleSpecs: normalizePathList(generated?.role_specs, fallback.roleSurfaces),
    stateArtifacts: normalizePathList(generated?.state_artifacts, fallback.stateSurfaces),
    ciSurfaces: normalizePathList(generated?.ci_surfaces, fallback.ciSurfaces)
  };
}

function normalizePathList(value: string[] | undefined, fallback: string[]): string[] {
  return value && value.length > 0 ? value : fallback;
}
