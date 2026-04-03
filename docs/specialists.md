# Specialists

Shrey Junior uses one canonical specialist registry end to end. The runtime, repo-local artifacts, CLI, UI, and generated docs should all emit these IDs:

- `architecture-specialist`
- `backend-specialist`
- `frontend-specialist`
- `fullstack-specialist`
- `python-specialist`
- `data-platform-specialist`
- `ios-specialist`
- `android-specialist`
- `qa-specialist`
- `review-specialist`
- `security-specialist`
- `refactor-specialist`
- `docs-specialist`
- `push-specialist`
- `release-specialist`
- `mcp-specialist`

## Why specialists exist

- machine-local skills are rich but not portable
- specialists let Shrey Junior speak one stable routing language across Codex, Claude, Copilot, desktop UI surfaces, and future tools
- specialists keep validation expectations, MCP-pack guidance, handoff rules, and escalation rules explicit
- legacy aliases still normalize for compatibility, but canonical IDs are what new artifacts should store

## Practical routing

- Python repos usually bias toward `python-specialist`
- Node or app repos usually bias toward `fullstack-specialist`, `backend-specialist`, or `frontend-specialist`
- data and migration work usually biases toward `data-platform-specialist`
- review and validation work usually biases toward `review-specialist` or `qa-specialist`
- docs and repo-context cleanup usually biases toward `docs-specialist`
- sequencing and guarded change framing usually biases toward `architecture-specialist`
- push and release discussion should bias toward `release-specialist` or `push-specialist`

## Compatibility Notes

The registry still understands a narrow set of legacy aliases so older repo artifacts do not break immediately:

- `python-implementer` -> `python-specialist`
- `typescript-implementer` -> `fullstack-specialist`
- `sql-specialist` -> `data-platform-specialist`
- `security-reviewer` -> `security-specialist`
- `performance-reviewer` -> `refactor-specialist`
- `handoff-editor` -> `docs-specialist`
- `dispatcher` -> `architecture-specialist`
- `reconciler` -> `review-specialist`
- `release-readiness` -> `release-specialist`

The portable source of truth for day-to-day use is `.agent/context/specialists.md` inside each initialized repo.
