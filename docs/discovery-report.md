# Discovery Report

This report captures the read-only discovery pass that informed v1 and remains the baseline for v2.

## Scope

- Home-level Codex and Claude instruction surfaces
- VS Code user-level Copilot-related setting keys only
- Active repo-level instruction surfaces on the SSD
- Sanitized MCP and hook registry shapes

No secrets, session contents, credential values, or `.env` payloads were read or recorded.

## Summary

The current machine already has:

- a strong Codex global contract in `~/.codex/AGENTS.md`
- a rich Claude global surface in `~/.claude/settings.json`, `~/.claude/rules/`, `~/.claude/agents/`, and ECC hook / MCP registries
- lightweight, repo-portable Copilot instructions in selected repos

The best portable pattern already in use is the Kiwi repo model:

- repo docs are authoritative
- machine-local files are explicitly non-authoritative
- secrets policy is documented in repo docs, not embedded in local agent state

## Sanitized inventory

| Path | Owner tool | Purpose | Safe to ingest directly? | Recommended treatment |
|---|---|---|---|---|
| `~/.codex/AGENTS.md` | Codex | global engineering contract | yes | import principles |
| `~/.claude/settings.json` | Claude | global hooks and permissions | no | reference only |
| `~/.claude/ecc/mcp-configs/mcp-servers.json` | Claude/ECC | MCP registry | partial | import names/schema only |
| `~/.claude/ecc/hooks/hooks.json` | Claude/ECC | hook lifecycle model | partial | import lifecycle names only |
| `kiwi-outreach/AGENTS.md` | repo shared | repo routing and authority model | yes | import pattern |
| `kiwi-outreach/CLAUDE.md` | Claude repo overlay | thin repo routing bridge | yes | import pattern |
| `kiwi-outreach/.github/copilot-instructions.md` | Copilot repo overlay | repo-level portable Copilot routing | yes | import pattern |
| `kiwi-outreach/.claude/settings.local.json` | Claude local repo state | local permissions | no | reference only |
| `kiwi-outreach/.claude/launch.json` | Claude local repo state | launch metadata | no | reference only |
| `remote-jobs/AGENTS.md` | repo shared | verification and completion schema | yes | import pattern |
| `oh-my-codex/AGENTS.md` | third-party workflow | heavy Codex orchestration | partial | reference architecture only |
| `oh-my-openagent/AGENTS.md` | third-party plugin workflow | plugin architecture map | partial | reference architecture only |
| VS Code `settings.json` | Copilot / chat | user settings | no | reference only |
| VS Code `workspaceStorage/*/GitHub.copilot-chat` | Copilot | volatile workspace state | no | ignore |

## Key machine-state findings

- `~/.claude/settings.json` exposes hook lifecycle groups for `SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, `PreCompact`, and `Stop`.
- `~/.claude/ecc/mcp-configs/mcp-servers.json` currently defines a broad shared MCP registry.
- repo-local `.claude/settings.local.json` and `.claude/launch.json` files are active in working repos but are not portable sources of truth.
- repo-level Copilot instructions exist and are a viable portable surface for v1.
- no existing `.agent/project.yaml` or `.agent/checks.yaml` convention was found, so v1 can claim that namespace safely.

## Design implications

- `shrey-junior` should translate canonical config into native repo surfaces rather than trying to unify runtime internals.
- Generated outputs must be additive and marker-managed.
- Machine-local state should be referenced, never imported as authority.
- Claude support should prefer `CLAUDE.md` and repo-local guidance over invasive `.claude` generation.
- Copilot remains at `.github/copilot-instructions.md` in v2.
- The same safe discovery model should feed context compilation rather than expanding into broad machine scanning.
