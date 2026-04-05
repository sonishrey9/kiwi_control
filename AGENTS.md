# Shrey Junior Repo Instructions

Kiwi Control is a thin repo-local control plane.

Keep this repository small, additive, portable, and debuggable.

Do not turn it into a general-purpose agent runtime.

## Mission

Improve the product intentionally while preserving the repo-local architecture:
- `packages/sj-core` owns repo-local truth derivation, planning, validation, and artifact handling
- `packages/sj-cli` owns operator workflows and machine-readable command output
- `apps/sj-ui` owns desktop presentation and Tauri interaction

Design, UX, interaction, module structure, persistence, and release engineering may be improved when the task clearly requires it.

## Hard constraints

- Do not move core authority away from repo-local files without explicit justification.
- Canonical human-maintained truth lives in `configs/`, `prompts/`, and `templates/`.
- Treat generated repo artifacts as outputs or derived state unless the code explicitly defines them as durable repo-local state.
- Do not expose secrets.
- Do not modify user-global Codex, Claude, Copilot, or editor settings from this repo.
- Do not introduce heavy dependencies without clear payoff.
- Do not make speculative refactors with no product, maintenance, or release benefit.

## Change policy

- Prefer intentional, scoped, and verified improvements.
- Prefer small reviewable diffs.
- Prefer explicit contracts over hidden coupling.
- Prefer additive managed changes where practical.
- Preserve backward compatibility where reasonable.

If the current design is clearly blocking usability, maintainability, trust, or release-readiness, improve it directly.

## Multi-agent workflow

For large tasks, use plan-first execution.

When safe, split work into parallel subagents or workstreams such as:
- UI and interaction
- core and contracts
- tests and verification
- release and open-source packaging

Each workstream should return:
1. exact files changed
2. exact behavior changed
3. exact verification commands
4. exact results
5. merge risks

Consolidate all work into one coherent patch set.

## Verification

Run relevant checks before considering work complete.

Baseline:
- `npm run build`
- `npm test`
- `bash scripts/smoke-test.sh`

When changing UI, also run relevant UI-specific checks.
When changing CLI contracts, verify machine-readable outputs explicitly.

## Output expectations

For substantial tasks, provide:
1. plan
2. exact files changed
3. exact diffs or exact code where relevant
4. exact verification commands
5. exact results
6. remaining risks
7. next recommended step

Do not stop at analysis when implementation is requested.

## Tooling guidance

Use repo-aware structural tools before broad file scanning when available and useful.

Prefer graph or structure-aware tools first for:
- architecture discovery
- impact analysis
- call and dependency tracing
- review context
- test coverage lookup

Fall back to direct file reads, grep, or glob when structural tooling is insufficient.

## Release priorities

When the task is release-readiness or open-source launch, prioritize:
1. correctness and trust
2. maintainability
3. tests and verification
4. contributor readiness
5. polish
6. net-new features


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
