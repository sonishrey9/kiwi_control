import path from "node:path";
import { pathExists, readJson } from "../utils/fs.js";
import type { ContextSelectionState } from "./context-selector.js";
import type { TokenUsageState } from "./token-estimator.js";
import type { ContextFeedbackState } from "./context-feedback.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NextAction {
  action: string;
  file: string | null;
  command: string | null;
  reason: string;
  priority: "critical" | "high" | "normal" | "low";
}

export interface DecisionEngineOutput {
  nextActions: NextAction[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export async function nextActionEngine(targetRoot: string): Promise<DecisionEngineOutput> {
  const actions: NextAction[] = [];

  const agentDir = path.join(targetRoot, ".agent");
  const hasAgentDir = await pathExists(agentDir);

  // 1. Check if repo is initialized
  if (!hasAgentDir) {
    actions.push({
      action: "Initialize repo",
      file: null,
      command: "kc init",
      reason: "No .agent directory found. Kiwi Control needs initialization before it can track context, tokens, or feedback.",
      priority: "critical"
    });
    return {
      nextActions: actions,
      summary: "Repo needs initialization. Run kc init to get started."
    };
  }

  // 2. Check context selection
  const ctxPath = path.join(targetRoot, ".agent", "state", "context-selection.json");
  const hasContext = await pathExists(ctxPath);

  if (!hasContext) {
    actions.push({
      action: "Prepare context",
      file: null,
      command: 'kc prepare "your task description"',
      reason: "No context selection exists. Run kc prepare to select relevant files and generate AI instructions.",
      priority: "high"
    });
  } else {
    const ctx = await readJson<ContextSelectionState>(ctxPath);

    if (ctx.confidence === "low") {
      actions.push({
        action: "Verify context selection",
        file: ctx.include[0] ?? null,
        command: "kc status",
        reason: `Context confidence is LOW for "${ctx.task}". Review selected files before starting work.`,
        priority: "high"
      });
    }

    // Check if context is stale (older than 1 hour)
    const contextAge = Date.now() - new Date(ctx.timestamp).getTime();
    if (contextAge > 3600000) {
      actions.push({
        action: "Refresh context",
        file: null,
        command: `kc prepare "${ctx.task}"`,
        reason: "Context selection is over 1 hour old. Re-run prepare to pick up working tree changes.",
        priority: "normal"
      });
    }
  }

  // 3. Check instructions
  const instrPath = path.join(targetRoot, ".agent", "context", "generated-instructions.md");
  const hasInstructions = await pathExists(instrPath);

  if (hasContext && !hasInstructions) {
    actions.push({
      action: "Generate instructions",
      file: null,
      command: 'kc prepare "your task"',
      reason: "Context exists but no instructions were generated. Re-run prepare to create AI constraints.",
      priority: "high"
    });
  }

  if (hasInstructions) {
    actions.push({
      action: "Paste instructions into AI tool",
      file: instrPath,
      command: null,
      reason: "Generated instructions are ready. Copy generated-instructions.md into Claude Code, Codex, or Copilot.",
      priority: "normal"
    });
  }

  // 4. Check token usage
  const tokenPath = path.join(targetRoot, ".agent", "state", "token-usage.json");
  if (await pathExists(tokenPath)) {
    const tokens = await readJson<TokenUsageState>(tokenPath);
    if (tokens.savings_percent < 50) {
      actions.push({
        action: "Narrow task scope",
        file: null,
        command: null,
        reason: `Only ${tokens.savings_percent}% token savings. Consider a more specific task description to reduce context size.`,
        priority: "normal"
      });
    }
  }

  // 5. Check feedback state
  const feedbackPath = path.join(targetRoot, ".agent", "state", "context-feedback.json");
  if (await pathExists(feedbackPath)) {
    const feedback = await readJson<ContextFeedbackState>(feedbackPath);
    if (feedback.totalRuns > 0 && feedback.successRate < 50) {
      actions.push({
        action: "Review context quality",
        file: feedbackPath,
        command: "kc status",
        reason: `Context success rate is ${feedback.successRate}%. Check if task descriptions match actual work.`,
        priority: "high"
      });
    }
  }

  // 6. Check execution log
  const execPath = path.join(targetRoot, ".agent", "state", "execution-log.json");
  if (await pathExists(execPath)) {
    const execLog = await readJson<{ entries: Array<{ success: boolean }> }>(execPath);
    const recentFailures = execLog.entries.slice(0, 3).filter((e) => !e.success).length;
    if (recentFailures >= 2) {
      actions.push({
        action: "Investigate recent failures",
        file: execPath,
        command: "kc status",
        reason: `${recentFailures} of last 3 executions failed. Review execution log for patterns.`,
        priority: "high"
      });
    }
  }

  // Default if nothing specific
  if (actions.length === 0) {
    actions.push({
      action: "Ready for work",
      file: null,
      command: null,
      reason: "All systems nominal. Context, instructions, and feedback are in order.",
      priority: "low"
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const topAction = actions[0];
  const summary = topAction
    ? `${topAction.action}: ${topAction.reason}`
    : "All systems nominal.";

  return { nextActions: actions, summary };
}
