# Global Integration

This phase makes Kiwi Control intentionally available everywhere without forcing unsafe tool-global mutation.

## Applied integration scope

Global changes now cover the smallest practical preference layer:

- `~/.shrey-junior/` home structure
- `~/.shrey-junior/defaults/bootstrap.yaml`
- `~/.shrey-junior/bin/shrey-junior`
- `~/.local/bin/shrey-junior`
- `~/.codex/AGENTS.md` preference block
- `~/.claude/CLAUDE.md` preference block
- `~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md`
- `~/Library/Application Support/Code/User/mcp.json` remediation to valid JSON

No broader changes are made to:

- VS Code user settings
- VS Code workspace storage
- Codex config TOML
- Claude settings JSON or hooks

## Why this is the safest viable integration

- `~/.local/bin` is already on PATH on this machine
- that makes `shrey-junior` callable from any folder without editing shell config
- repo-local overlays and authority still remain the real working layer
- Codex, Claude, and Copilot now get a lightweight global preference layer without invasive runtime mutation

## Global home contents

- `defaults/bootstrap.yaml`: starter bootstrap defaults
- `specialists/specialists.yaml`: portable specialist registry snapshot
- `policies/policies.yaml`: policy engine snapshot
- `mcp/mcp.servers.json`: sanitized MCP capability registry snapshot
- `adapters/tool-awareness.md`: global workflow awareness reference
- `adapters/global-adapter-strategy.md`: future-facing adapter guidance

## Tool-global preference surfaces

- Codex: append-only preference block in `~/.codex/AGENTS.md`
- Claude: append-only preference block in `~/.claude/CLAUDE.md`
- VS Code / Copilot: prompt file in `~/Library/Application Support/Code/User/prompts/`
- VS Code MCP: valid but empty `mcp.json` to avoid malformed state

The preference blocks now use explicit versioned markers:

- `BEGIN SHREY_JUNIOR_GLOBAL_PREFS v1`
- `END SHREY_JUNIOR_GLOBAL_PREFS v1`
- `BEGIN SHREY_JUNIOR_GLOBAL_PROMPT v1`
- `END SHREY_JUNIOR_GLOBAL_PROMPT v1`

These markers make reapply verification idempotent and rollback testable.

## What is guaranteed

- exactly one managed Kiwi Control preference block can be asserted in Codex and Claude global files
- the VS Code prompt file can be rewritten idempotently
- `mcp.json` is verified as valid JSON
- repo-local authority still overrides the global preference layer
- rollback can restore the backed up global surfaces

## What is not guaranteed

- hard runtime enforcement inside Codex, Claude, or Copilot
- automatic repo entry hooks or hidden background initialization
- global MCP auto-invocation or tool-global policy enforcement beyond documented guidance

This remains a guidance-first integration with explicit verification, not an invisible runtime controller.

## Backup and verification flow

1. run `scripts/backup-global.sh`
2. run `scripts/install-global.sh`
3. run `scripts/apply-global-preferences.sh`
4. run `scripts/verify-global.sh`
5. run `scripts/verify-global-hard.sh`
6. use `scripts/restore-global.sh <backup-dir>` to roll back the tool-global surfaces

This keeps the integration explicit, backed up, and reversible.
