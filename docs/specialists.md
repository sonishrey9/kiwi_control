# Specialists

Shrey Junior specialists are the portable, repo-safe abstraction layer above machine-local skills.

## Core specialists

- `python-specialist`: Python and backend implementation with safe validation boundaries
- `backend-specialist`: service, API, persistence, and contract-aware backend work
- `frontend-specialist`: UI, browser, and design-aware frontend work
- `fullstack-specialist`: balanced implementation for app and web repos crossing frontend and backend boundaries
- `qa-specialist`: tester evidence, validation coverage, and acceptance confidence
- `review-specialist`: general engineering review and regression risk assessment
- `push-specialist`: push-readiness and review gating
- `release-specialist`: release and phase-close discipline
- `refactor-specialist`: bounded restructures and contract-safe change grouping
- `security-specialist`: auth, permissions, data exposure, and unsafe assumptions
- `docs-specialist`: documentation, summaries, onboarding, and authority flow
- `architecture-specialist`: planning, decomposition, sequencing, and boundary analysis
- `mcp-specialist`: capability-aware MCP routing and policy discipline

## Why specialists exist

- machine-local skills are rich but not portable
- specialists let Shrey Junior speak one stable routing language across Codex, Claude, Copilot, and future tools
- specialists keep validation expectations, MCP eligibility, and escalation rules explicit

## Relationship to roles

- planner usually maps to `architecture-specialist`
- implementer usually maps to `fullstack-specialist` unless a more specific specialist is chosen
- reviewer usually maps to `review-specialist`
- tester usually maps to `qa-specialist`
- security maps to `security-specialist`
- summarizer maps to `docs-specialist`

## Relationship to project types

- Python repos bias toward `python-specialist` and `backend-specialist`
- Node or app repos bias toward `fullstack-specialist` and `frontend-specialist`
- Docs-heavy repos bias toward `docs-specialist`
- Data-platform repos bias toward `backend-specialist`, `qa-specialist`, and `security-specialist`

## Escalation guidance

- use a more specific specialist when the task is clearly domain-shaped
- use `review-specialist` when correctness and regression risk matter more than domain depth
- use `mcp-specialist` when tool or capability eligibility is unclear
