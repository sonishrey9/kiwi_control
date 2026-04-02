export interface CommandRisk {
  allowed: boolean;
  reasons: string[];
}

export function evaluatePreCommand(command: string): CommandRisk {
  const riskyTerms = ["rm -rf", "git reset --hard", "~/.claude", "~/.codex", "workspaceStorage"];
  const reasons = riskyTerms.filter((term) => command.includes(term));
  return {
    allowed: reasons.length === 0,
    reasons
  };
}

