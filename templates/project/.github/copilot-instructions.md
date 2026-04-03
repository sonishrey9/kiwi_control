# Copilot Repo Routing

Use `.agent/project.yaml` and `.agent/context/*` as the canonical repo-local control plane.
Profile: `{{profileName}}`
Execution mode: `{{executionMode}}`

Authority order:

1. existing trusted repo authority files already in the repo
2. promoted canonical docs explicitly referenced by those files
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. latest task packet, latest handoff, latest reconcile, and latest dispatch manifest when present
6. relevant `.github/instructions/*.instructions.md`
7. relevant `.github/agents/*.md`, `.agent/roles/*.md`, and `.agent/templates/role-result.md`
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`
10. `.agent/context/commands.md`, `.agent/context/tool-capabilities.md`, and `.agent/context/mcp-capabilities.md`
11. `.agent/tasks/` packets when present
12. `.agent/context/architecture.md`, `.agent/context/conventions.md`, and `.agent/context/runbooks.md`

Before non-trivial shared changes:

1. read the current profile and authority order
2. read `.agent/state/active-role-hints.json` and follow its `readNext`, `checksToRun`, and `nextAction`
3. read `.agent/state/current-phase.json`
4. read the latest handoff and latest reconcile result when present
4. prefer packet-driven framing over generic repo-wide suggestions

Do not treat local editor state, workspace storage, or machine-local prompts as portable repo memory.
Do not store raw secrets in repo files or markdown docs.
Cloud-only or hosted environments may not see machine-global surfaces, so prefer repo-local Shrey Junior artifacts whenever they exist.

Decision rules:

- trivial work may stay direct when it is a typo, wording adjustment, formatting-only change, or one-line local fix with no contract or release impact
- for non-trivial work, assume `run`, `fanout`, or `dispatch` framing exists or should be created first
- if the task is multi-file, guarded, contract-sensitive, security-sensitive, or needs reviewer/tester separation, do not behave like this is an isolated inline edit
- align suggestions with `.agent/checks.yaml`, the active profile, and any existing packets
- if policy or reconcile state is blocked, stop and surface the blocker instead of suggesting freeform edits
- use `.agent/state/active-role-hints.json` as the shortest repo-local path to current role focus, next file to open, next command to consider, and latest continuity pointers

Specialists and MCP:

- when specialist-aware routing exists, prefer it over generic suggestions for frontend, backend, fullstack, python, data-platform, QA, security, docs, refactor, architecture, or push/release work
- Copilot suggestions should treat MCP usage as a repo capability note, not as a direct tool affordance
- MCP usage is policy-driven; do not assume MCP tools should be called just because they are available
