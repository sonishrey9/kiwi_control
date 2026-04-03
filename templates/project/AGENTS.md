# Project Agent Routing

This repository uses Shrey Junior as the repo-local control plane.
Profile: `{{profileName}}`
Execution mode: `{{executionMode}}`

Read in this order before non-trivial work:

1. existing trusted repo authority files already present in the repo
2. promoted canonical docs explicitly referenced by those authority files
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json` and `.agent/state/checkpoints/latest.json`
6. latest task packet, latest handoff, latest reconcile, and latest dispatch manifest when present
7. `.agent/context/commands.md`, `.agent/context/specialists.md`, `.agent/context/tool-capabilities.md`, and `.agent/context/mcp-capabilities.md`
8. relevant `.github/instructions/*.instructions.md`
9. relevant `.github/agents/*.md`, `.agent/roles/*.md`, and `.agent/templates/role-result.md`
10. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
11. `.agent/project.yaml`
12. `.agent/context/architecture.md`, `.agent/context/conventions.md`, and `.agent/context/runbooks.md`
13. `.agent/tasks/` packets when present

Authority rules:

- existing repo authority wins over generated overlays unless the repo explicitly delegates control
- promoted canonical docs explicitly referenced by repo authority must be read early
- generated repo artifacts are supporting control-plane outputs and may be regenerated
- repo-local files are the portable contract; machine-local files and editor state are accelerators only
- cloud-hosted runtimes may not see `~/.codex`, `~/.claude`, or editor-local prompts, so do not treat those as portable truth

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
- use `.agent/state/active-role-hints.json` as the fastest repo-local read for the current lead role, next file to open, next command to consider, latest continuity pointers, next specialist, and suggested MCP pack
- use `.agent/memory/current-focus.json` when you need the shortest continuity summary without rereading the whole state tree

Escalate instead of proceeding directly when:

- the task stops being trivial
- the change becomes multi-file or cross-cutting
- stable contracts or boundary files may change
- reviewer or tester separation becomes necessary
- current phase, handoff, or reconcile state shows unresolved blockers

Specialist guidance:

- prefer the curated specialist registry in `.agent/context/specialists.md` when the task clearly maps to `python-implementer`, `typescript-implementer`, `sql-specialist`, `android-specialist`, `ios-specialist`, `qa-specialist`, `security-reviewer`, `performance-reviewer`, `docs-specialist`, `dispatcher`, `reconciler`, `handoff-editor`, or `release-readiness`
- repo-specific `.agent/roles/*.md` and `.github/agents/*.md` remain narrower overlays when they exist

MCP guidance:

- MCP usage is policy-driven, not improvisational
- only use MCP capabilities that match the active profile, selected specialist, trust level, and approval expectations
- never call an MCP just because it exists
