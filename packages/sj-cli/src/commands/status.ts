import { buildRepoControlState } from "@shrey-junior/sj-core/core/ui-state.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface StatusOptions {
  repoRoot: string;
  targetRoot: string;
  profileName?: string;
  json?: boolean;
  logger: Logger;
}

export async function runStatus(options: StatusOptions): Promise<number> {
  const controlState = await buildRepoControlState({
    repoRoot: options.repoRoot,
    targetRoot: options.targetRoot,
    ...(options.profileName ? { profileName: options.profileName } : {})
  });

  if (options.json) {
    options.logger.info(JSON.stringify(controlState, null, 2));
    return controlState.validation.ok ? 0 : 1;
  }

  const topAction = controlState.kiwiControl.nextActions.actions[0] ?? null;
  const tokenSummary = renderTokenSummary(controlState);
  const nextActionSummary = renderNextActionSummary(topAction, controlState.kiwiControl.nextActions.summary);
  const contextTreeSummary = renderContextTreeSummary(controlState.kiwiControl.contextView.tree);
  const executionPlanSummary = renderExecutionPlan(controlState);

  options.logger.info(
    [
      `repo status: ${controlState.repoState.title} — ${controlState.repoState.detail}`,
      `next action: ${nextActionSummary}`,
      `token summary: ${tokenSummary}`,
      executionPlanSummary,
      ...(contextTreeSummary ? [`context tree:\n${contextTreeSummary}`] : [])
    ].join("\n")
  );

  return 0;
}

function renderNextActionSummary(
  topAction: { action: string; command: string | null; reason: string } | null,
  summary: string
): string {
  if (!topAction) {
    return summary || "No action recorded.";
  }

  if (topAction.command) {
    return `${topAction.action} — run ${topAction.command}`;
  }

  return `${topAction.action} — ${topAction.reason}`;
}

function renderTokenSummary(state: Awaited<ReturnType<typeof buildRepoControlState>>): string {
  const { tokenAnalytics: analytics, measuredUsage } = state.kiwiControl;
  if (!analytics.estimationMethod) {
    return 'Not generated yet — run kc prepare "describe your task"';
  }

  const estimated = `estimated ~${formatTokenCount(analytics.selectedTokens)} selected / ~${formatTokenCount(analytics.fullRepoTokens)} full repo / ~${analytics.savingsPercent}% saved [${analytics.estimationMethod}]`;
  if (!measuredUsage.available) {
    return estimated;
  }

  return `measured ${formatTokenCount(measuredUsage.totalTokens)} across ${measuredUsage.totalRuns} runs (${measuredUsage.source}) | ${estimated}`;
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function renderContextTreeSummary(
  tree: Awaited<ReturnType<typeof buildRepoControlState>>["kiwiControl"]["contextView"]["tree"]
): string | null {
  if (tree.nodes.length === 0) {
    return null;
  }

  const lines = [
    `  ${tree.selectedCount} selected / ${tree.candidateCount} candidate / ${tree.excludedCount} excluded`,
    ...renderContextTreeNodes(tree.nodes, 1, { remaining: 12 })
  ];

  return lines.join("\n");
}

function renderExecutionPlan(
  state: Awaited<ReturnType<typeof buildRepoControlState>>
): string {
  const plan = state.kiwiControl.executionPlan;
  const lines = ["NEXT ACTION PLAN:"];

  for (const [index, step] of plan.steps.entries()) {
    lines.push(`${index + 1}. ${step.description}`);
    lines.push(`   Run: ${step.command}`);
    lines.push(`   Expect: ${step.expectedOutput}`);
    lines.push(`   Verify: ${step.validation}`);
    lines.push(`   Status: ${step.status}`);
  }

  if (plan.blocked) {
    lines.push("   Failure handling: run the corrective command above first. Do not continue until the blocking issue is cleared.");
  }

  if (plan.nextCommands.length > 0) {
    lines.push("Next commands:");
    for (const command of plan.nextCommands) {
      lines.push(`- ${command}`);
    }
  }

  return lines.join("\n");
}

function renderContextTreeNodes(
  nodes: Awaited<ReturnType<typeof buildRepoControlState>>["kiwiControl"]["contextView"]["tree"]["nodes"],
  depth: number,
  limit: { remaining: number }
): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    if (limit.remaining <= 0) {
      break;
    }

    limit.remaining -= 1;
    const indent = "  ".repeat(depth);
    const branch = node.kind === "directory" ? (node.expanded ? "▾" : "▸") : " ";
    const suffix = node.kind === "directory" ? "/" : "";
    lines.push(`${indent}${branch} ${contextTreeStatusIcon(node.status)} ${node.name}${suffix}`);

    if (node.kind === "directory" && node.expanded) {
      lines.push(...renderContextTreeNodes(node.children, depth + 1, limit));
    }
  }

  return lines;
}

function contextTreeStatusIcon(status: "selected" | "candidate" | "excluded"): string {
  switch (status) {
    case "selected":
      return "✓";
    case "excluded":
      return "×";
    default:
      return "•";
  }
}
