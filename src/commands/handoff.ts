import { loadCanonicalConfig } from "../core/config.js";
import { compileRepoContext } from "../core/context.js";
import { inspectGitState } from "../core/git.js";
import { buildHandoffBaseName, buildHandoffRecord, renderHandoffBrief, renderHandoffMarkdown } from "../core/handoff.js";
import { loadProjectOverlay, resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import { loadCurrentPhase, writeHandoffArtifacts } from "../core/state.js";
import type { Logger } from "../core/logger.js";
import type { ToolName } from "../core/config.js";

export interface HandoffOptions {
  repoRoot: string;
  targetRoot: string;
  toTool: ToolName;
  profileName?: string;
  logger: Logger;
}

export async function runHandoff(options: HandoffOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const overlay = await loadProjectOverlay(options.targetRoot);
  const selection = await resolveProfileSelection(options.targetRoot, config, options.profileName);
  const currentPhase = await loadCurrentPhase(options.targetRoot);
  const executionMode = resolveExecutionMode(config, selection, overlay, currentPhase?.mode);
  const compiledContext = await compileRepoContext({
    targetRoot: options.targetRoot,
    config,
    profileName: selection.profileName,
    profile: selection.profile,
    overlay,
    executionMode,
    taskType: currentPhase?.routingSummary.taskType ?? config.global.defaults.default_task_type,
    fileArea: currentPhase?.routingSummary.fileArea ?? "application",
    changeSize: currentPhase?.routingSummary.changeSize ?? config.global.defaults.default_change_size,
    riskLevel: currentPhase?.routingSummary.riskLevel ?? "medium"
  });
  const gitState = await inspectGitState(options.targetRoot);
  const handoff = buildHandoffRecord({
    toTool: options.toTool,
    currentPhase,
    context: compiledContext,
    gitState
  });
  const baseName = buildHandoffBaseName(handoff);
  const artifacts = await writeHandoffArtifacts(
    options.targetRoot,
    baseName,
    handoff,
    renderHandoffMarkdown(handoff),
    renderHandoffBrief(handoff)
  );
  options.logger.info(`handoff markdown: ${artifacts.markdownPath}`);
  options.logger.info(`handoff json: ${artifacts.jsonPath}`);
  options.logger.info(`handoff brief: ${artifacts.briefPath}`);
  return handoff.status === "blocked" ? 1 : 0;
}
