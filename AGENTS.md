# Shrey Junior Repo Instructions

This repository builds and maintains a thin repo-local control plane.

## Mission

Keep `shrey-junior` small, additive, and portable.

Do not turn it into a new agent runtime.

## Non-negotiables

- Canonical truth lives only in `configs/`, `prompts/`, and `templates/`.
- Generated repo artifacts are outputs, not authority.
- Never modify user-global Codex, Claude, or Copilot settings from this repo.
- Never read or print secret values.
- Prefer additive managed blocks over rewriting existing repo instructions.
- Keep dependencies minimal and boring.

## Verification

Run:

- `npm run build`
- `npm test`
- `bash scripts/smoke-test.sh`

## Output expectations

Changes should preserve:

- safe metadata-only discovery
- managed marker ownership
- repo-local overlays only
- clear rollback by deleting generated managed files or blocks


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
