# Specialists

Shrey Junior now uses a smaller curated portable specialist vocabulary for repo-local routing:

- `python-implementer`
- `typescript-implementer`
- `sql-specialist`
- `android-specialist`
- `ios-specialist`
- `qa-specialist`
- `security-reviewer`
- `performance-reviewer`
- `docs-specialist`
- `dispatcher`
- `reconciler`
- `handoff-editor`
- `release-readiness`

## Why specialists exist

- machine-local skills are rich but not portable
- specialists let Shrey Junior speak one stable routing language across Codex, Claude, Copilot, and future tools
- specialists keep validation expectations, MCP-pack guidance, handoff rules, and escalation rules explicit

## Practical routing

- Python repos usually bias toward `python-implementer`
- Node or app repos usually bias toward `typescript-implementer`
- data and migration work usually biases toward `sql-specialist`
- review and validation work usually biases toward `qa-specialist`
- docs and repo-context cleanup usually biases toward `docs-specialist`
- cross-role routing and restart logic usually biases toward `dispatcher`, `reconciler`, or `handoff-editor`
- push discussion should bias toward `release-readiness`

The portable source of truth for day-to-day use is `.agent/context/specialists.md` inside each initialized repo.
