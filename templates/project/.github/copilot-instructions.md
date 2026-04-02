# Copilot Repo Routing

Use `.agent/project.yaml` and `.agent/context/*` as the canonical repo-local control plane.
Profile: `{{profileName}}`
Execution mode: `{{executionMode}}`

Authority order:

1. existing trusted repo authority files already in the repo
2. promoted canonical docs explicitly referenced by those files
3. `.agent/project.yaml`
4. `.agent/checks.yaml`
5. `.agent/tasks/` packets when present
6. `.agent/context/*`

Before non-trivial shared changes:

1. read the current profile and authority order
2. read `.agent/state/current-phase.json` when present
3. read the latest handoff and latest reconcile result when present
4. prefer packet-driven framing over generic repo-wide suggestions

Do not treat local editor state, workspace storage, or machine-local prompts as portable repo memory.
Do not store raw secrets in repo files or markdown docs.

Decision rules:

- trivial work may stay direct when it is a typo, wording adjustment, formatting-only change, or one-line local fix with no contract or release impact
- for non-trivial work, assume `run`, `fanout`, or `dispatch` framing exists or should be created first
- if the task is multi-file, guarded, contract-sensitive, security-sensitive, or needs reviewer/tester separation, do not behave like this is an isolated inline edit
- align suggestions with `.agent/checks.yaml`, the active profile, and any existing packets
- if policy or reconcile state is blocked, stop and surface the blocker instead of suggesting freeform edits

Specialists and MCP:

- when specialist-aware routing exists, prefer it over generic suggestions for python, QA, security, docs, refactor, or push/release work
- MCP usage is policy-driven; do not assume MCP tools should be called just because they are available
