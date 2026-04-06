<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

<!-- SHREY-JUNIOR:START copilot -->
# Copilot Repo Routing

Use `.agent/project.yaml` and `.agent/context/*` as the canonical repo-local control plane.
Profile: `product-build`
Execution mode: `assisted`

Authority order:

1. existing trusted repo authority files already in the repo
2. promoted canonical docs explicitly referenced by those files
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json` and `.agent/state/checkpoints/latest.json`
6. latest task packet, latest handoff, latest reconcile, and latest dispatch manifest when present
7. `.agent/context/commands.md`, `.agent/context/specialists.md`, `.agent/context/tool-capabilities.md`, and `.agent/context/mcp-capabilities.md`
8. relevant `.github/instructions/*.instructions.md`
9. relevant `.github/agents/*.md`, `.agent/roles/*.md`, and `.agent/templates/role-result.md`
10. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
11. `.agent/project.yaml`
12. `.agent/tasks/` packets when present
13. `.agent/context/architecture.md`, `.agent/context/conventions.md`, and `.agent/context/runbooks.md`

Before non-trivial shared changes:

1. read the current profile and authority order
2. read `.agent/state/active-role-hints.json` and follow its `readNext`, `checksToRun`, and `nextAction`
3. read `.agent/state/current-phase.json`
4. read `.agent/memory/current-focus.json`
5. read the latest handoff and latest reconcile result when present
6. prefer packet-driven framing over generic repo-wide suggestions

Do not treat local editor state, workspace storage, or machine-local prompts as portable repo memory.
Do not store raw secrets in repo files or markdown docs.
Cloud-only or hosted environments may not see machine-global surfaces, so prefer repo-local Shrey Junior artifacts whenever they exist.

Decision rules:

- trivial work may stay direct when it is a typo, wording adjustment, formatting-only change, or one-line local fix with no contract or release impact
- for non-trivial work, assume `run`, `fanout`, or `dispatch` framing exists or should be created first
- if the task is multi-file, guarded, contract-sensitive, security-sensitive, or needs reviewer/tester separation, do not behave like this is an isolated inline edit
- align suggestions with `.agent/checks.yaml`, the active profile, and any existing packets
- if policy or reconcile state is blocked, stop and surface the blocker instead of suggesting freeform edits
- use `.agent/state/active-role-hints.json` as the shortest repo-local path to current role focus, next file to open, next command to consider, latest continuity pointers, next specialist, and suggested MCP pack
- use `.agent/context/specialists.md` as the small registry of what specialist names actually mean in this repo model

Specialists and MCP:

- when specialist-aware routing exists, prefer the curated registry in `.agent/context/specialists.md` over generic suggestions
- Copilot suggestions should treat MCP usage as a repo capability note, not as a direct tool affordance
- MCP usage is policy-driven; do not assume MCP tools should be called just because they are available
<!-- SHREY-JUNIOR:END copilot -->
