import path from "node:path";
import { promises as fs } from "node:fs";
import type { LoadedConfig } from "./config.js";
import type { ProfileSelection } from "./profiles.js";
import { compileRepoContext } from "./context.js";
import { loadLatestDispatchCollection, loadLatestDispatchManifest } from "./dispatch.js";
import { initOrSyncTarget } from "./executor.js";
import { buildFanoutPackets, buildRunPackets } from "./planner.js";
import { loadProjectOverlay, resolveExecutionMode } from "./profiles.js";
import { loadLatestReconcileReport } from "./reconcile.js";
import { buildTemplateContext, resolveRoutingDecision } from "./router.js";
import { assessGoalRisk } from "./risk.js";
import { getStatePaths, loadContinuitySnapshot } from "./state.js";
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
    "templates/project/.agent/project.yaml",
    "templates/project/.agent/checks.yaml",
    "templates/project/.agent/context/architecture.md",
    "templates/project/.agent/context/conventions.md",
    "templates/project/.agent/context/runbooks.md",
    "scripts/install-global.sh",
    "scripts/backup-global.sh",
    "scripts/verify-global.sh"
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
      requiredSnippets: ["trivial work", "push-check", "dispatch", "promoted canonical docs"]
    },
    {
      relativePath: "templates/project/CLAUDE.md",
      requiredSnippets: ["current-phase.json", "latest handoff", "policy", "release-check"]
    },
    {
      relativePath: "templates/project/.github/copilot-instructions.md",
      requiredSnippets: ["trivial work", "non-trivial", "packet", "policy"]
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
  const overlay = await loadProjectOverlay(targetRoot);
  const executionMode = resolveExecutionMode(config, selection, overlay);

  for (const relativePath of [
    ".agent/project.yaml",
    ".agent/checks.yaml",
    ".agent/context/architecture.md",
    ".agent/context/conventions.md",
    ".agent/context/runbooks.md"
  ]) {
    const fullPath = path.join(targetRoot, relativePath);
    if (!(await pathExists(fullPath))) {
      issues.push({ level: "warn", message: "generated repo-local state missing", filePath: fullPath });
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
  }

  for (const relativePath of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]) {
    const fullPath = path.join(targetRoot, relativePath);
    if (!(await pathExists(fullPath))) {
      issues.push({ level: "warn", message: "native repo surface missing", filePath: fullPath });
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
    executionMode
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
      await readJson(statePaths.currentPhase);
    } catch (error) {
      issues.push({
        level: "error",
        message: `invalid current phase json: ${(error as Error).message}`,
        filePath: statePaths.currentPhase
      });
    }
  }
  if (await pathExists(statePaths.handoffDir)) {
    const entries = await fs.readdir(statePaths.handoffDir);
    for (const entry of entries.filter((item) => item.endsWith(".json") && !isIgnoredArtifactName(item))) {
      const fullPath = path.join(statePaths.handoffDir, entry);
      try {
        await readJson(fullPath);
      } catch (error) {
        issues.push({
          level: "error",
          message: `invalid handoff json: ${(error as Error).message}`,
          filePath: fullPath
        });
      }
    }
  }

  const latestDispatch = await loadLatestDispatchManifest(targetRoot);
  if (latestDispatch) {
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
    const latestReconcile = await loadLatestReconcileReport(targetRoot, latestDispatch.dispatchId);
    if (latestReconcile && latestReconcile.dispatchId !== latestDispatch.dispatchId) {
      issues.push({
        level: "warn",
        message: "latest reconcile report points to a different dispatch id"
      });
    }
  }

  const preview = await initOrSyncTarget(config.repoRoot, targetRoot, config, context, { dryRun: true });
  if (preview.some((result) => result.status === "conflict")) {
    issues.push({ level: "warn", message: "sync preview found conflicts that require manual review" });
  }

  return issues;
}
