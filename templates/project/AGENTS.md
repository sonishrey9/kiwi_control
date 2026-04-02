# Project Agent Routing

This repository uses Shrey Junior as the repo-local control plane.
Profile: `{{profileName}}`
Execution mode: `{{executionMode}}`

Read in this order before non-trivial work:

1. existing trusted repo authority files already present in the repo
2. promoted canonical docs explicitly referenced by those authority files
3. `.agent/project.yaml`
4. `.agent/checks.yaml`
5. `.agent/state/current-phase.json` when present
6. latest handoff and latest reconcile artifacts when present
7. `.agent/context/architecture.md`
8. `.agent/context/conventions.md`
9. `.agent/context/runbooks.md`
10. `.agent/tasks/` packets when present

Authority rules:

- existing repo authority wins over generated overlays unless the repo explicitly delegates control
- promoted canonical docs explicitly referenced by repo authority must be read early
- generated repo artifacts are supporting control-plane outputs and may be regenerated
- machine-local files and editor state are reference-only

Safety rules:

- never store raw secrets in repo files
- do not treat `~/.codex`, `~/.claude`, `.claude/settings.local.json`, `.vscode/*`, or workspace storage as portable repo memory
- prefer additive changes and managed markers
- escalate when authority files disagree

Workflow thresholds:

- trivial work may stay direct when it is a typo, wording fix, one-line local change, or low-risk formatting with no contract, auth, data, security, release, or multi-file impact
- non-trivial work should use Shrey Junior framing when it touches multiple files, changes interfaces or stable contracts, is guarded or cross-cutting, affects auth/data/security/release behavior, or benefits from reviewer/tester separation

Use the control plane like this:

- use `run` for a single-owner non-trivial task that still needs repo-aware framing
- use `fanout` when planner / implementer / reviewer / tester separation is useful
- use `dispatch` when multiple small roles may work in parallel and outputs need later collection and reconciliation
- use `collect` and `reconcile` before trusting multi-role work
- use `checkpoint` at meaningful phase boundaries and before cross-tool handoff
- use `handoff` when Codex, Claude, Copilot, or another tool is continuing the next phase
- use `push-check` before recommending push for non-trivial, guarded, contract-sensitive, or release-sensitive work
- use `release-check` and `phase-close` when the phase is nearing review, release, or a clean handoff boundary

Escalate instead of proceeding directly when:

- the task stops being trivial
- the change becomes multi-file or cross-cutting
- stable contracts or boundary files may change
- reviewer or tester separation becomes necessary
- current phase, handoff, or reconcile state shows unresolved blockers

Specialist guidance:

- prefer specialist-aware routing over generic freeform work when the task clearly maps to `python-specialist`, `qa-specialist`, `push-specialist`, `security-specialist`, `refactor-specialist`, or `docs-specialist`
- specialists refine validation expectations, handoff guidance, risk posture, and MCP eligibility; they do not replace repo authority

MCP guidance:

- MCP usage is policy-driven, not improvisational
- only use MCP capabilities that match the active profile, selected specialist, trust level, and approval expectations
- never call an MCP just because it exists
