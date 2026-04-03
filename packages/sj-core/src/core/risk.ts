export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

export function assessGoalRisk(goal: string): RiskAssessment {
  const patterns: Array<[RiskLevel, RegExp, string]> = [
    ["high", /(global|system-wide|~\/\.claude|~\/\.codex|workspaceStorage)/i, "touches global tool state"],
    ["high", /(secret|token|password|ssh|pem|env value)/i, "mentions sensitive material"],
    ["high", /(cross-cutting|wide-ranging|rewrite|production|migration)/i, "suggests broad or risky changes"],
    ["medium", /(delete|remove|overwrite|replace|refactor)/i, "may change existing behavior"]
  ];

  const reasons = patterns
    .filter(([, regex]) => regex.test(goal))
    .map(([, , reason]) => reason);

  if (reasons.some((reason) => reason === "touches global tool state" || reason === "mentions sensitive material")) {
    return { level: "high", reasons };
  }

  if (reasons.length > 0) {
    return { level: "medium", reasons };
  }

  return { level: "low", reasons: [] };
}
