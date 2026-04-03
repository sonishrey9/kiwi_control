# Repo Contract Spec

## Purpose

The portable repo contract is the smallest set of repo-local files Shrey Junior installs so a cooperative tool can orient, route work, preserve continuity, and understand required checks without relying on machine-global configuration.

## Authority Model

Authority order:

1. Explicit trusted repo authority files already present in the repo
2. Repo-local generated overlays and state
3. User-global accelerators such as `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, and editor prompt surfaces
4. Fallback templates and defaults

Repo-local explicit opt-out or conflict guidance still wins over generated Shrey Junior contract files.

## Universal Core Versus Selective Surfaces

### Universal core

These are installed in every bootstrapped or standardized repo:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agent/project.yaml`
- `.agent/checks.yaml`
- `.agent/context/architecture.md`
- `.agent/context/commands.md`
- `.agent/context/specialists.md`
- `.agent/context/tool-capabilities.md`
- `.agent/context/mcp-capabilities.md`
- `.agent/context/conventions.md`
- `.agent/context/runbooks.md`
- `.agent/memory/repo-facts.json`
- `.agent/memory/architecture-decisions.md`
- `.agent/memory/domain-glossary.md`
- `.agent/memory/current-focus.json`
- `.agent/memory/open-risks.json`
- `.agent/memory/known-gotchas.md`
- `.agent/memory/last-successful-patterns.md`
- `.agent/templates/role-result.md`
- `.agent/state/current-phase.json`
- `.agent/state/active-role-hints.json`
- `.agent/state/checkpoints/latest.json`
- `.agent/state/checkpoints/latest.md`
- `.agent/state/*/README.md`
- `.agent/scripts/verify-contract.sh`
- `.github/agents/shrey-junior.md`
- `.github/workflows/shrey-junior-contract.yml`

### Selective surfaces

These are generated only when relevant:

- `.github/instructions/*.instructions.md`
- `.github/agents/<specialist>.md`
- `.agent/roles/<specialist>.md`

The exact selected surfaces are recorded in `.agent/project.yaml`.

## Canonical First-Read Order

For a bootstrapped or standardized repo, the intended read order is:

1. explicit trusted repo authority files already present in the repo
2. promoted canonical repo docs referenced by that authority
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json`
6. `.agent/state/checkpoints/latest.json`
7. latest packet, handoff, dispatch, and reconcile pointers
8. `.agent/context/commands.md`, `.agent/context/specialists.md`, `.agent/context/tool-capabilities.md`, and `.agent/context/mcp-capabilities.md`
9. relevant path-specific instruction files
10. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
11. `.agent/project.yaml` for the installed contract shape

## Required Repo-Local Surfaces

| Path | Role | Source of truth or generated |
| --- | --- | --- |
| `AGENTS.md` | Codex-facing repo instruction surface | Generated overlay |
| `CLAUDE.md` | Claude-facing repo instruction surface | Generated overlay |
| `.github/copilot-instructions.md` | Copilot-facing repo instruction surface | Generated overlay |
| `.github/instructions/*.instructions.md` | Domain-specific Copilot guidance | Generated overlay |
| `.github/agents/*.md` | Repo-local agent and role surfaces | Generated overlay |
| `.agent/project.yaml` | Portable repo contract metadata | Generated contract |
| `.agent/checks.yaml` | Required validation/readiness checks | Generated contract |
| `.agent/context/commands.md` | Command discovery and next-step guidance | Generated starter context |
| `.agent/context/specialists.md` | Curated specialist registry and routing aid | Generated starter context |
| `.agent/context/tool-capabilities.md` | Honest tool-family capability matrix | Generated starter context |
| `.agent/context/mcp-capabilities.md` | MCP and external lookup decision guide | Generated starter context |
| `.agent/memory/*.json`, `.agent/memory/*.md` | Portable shared memory bank | Generated starter context plus runtime updates |
| `.agent/context/architecture.md`, `.agent/context/conventions.md`, `.agent/context/runbooks.md` | Human-readable repo context | Generated starter context |
| `.agent/roles/*.md` | Specialist role definitions | Generated contract |
| `.agent/templates/role-result.md` | Structured role result schema | Generated contract |
| `.agent/scripts/verify-contract.sh` | Repo-local verification and CI gate | Generated contract |
| `.agent/tasks/*` | Task packets for run/fanout/dispatch | Generated runtime artifact |
| `.agent/state/current-phase.json` | Phase continuity state | Generated runtime artifact |
| `.agent/state/active-role-hints.json` | Current active role, next reads, checks, and latest continuity pointers | Generated runtime artifact |
| `.agent/state/checkpoints/latest.json`, `.agent/state/checkpoints/latest.md` | Latest git-aware continuity checkpoint | Generated runtime artifact |
| `.agent/state/handoff/*` | Cross-tool handoff state | Generated runtime artifact |
| `.agent/state/dispatch/*` | Dispatch manifests and collections | Generated runtime artifact |
| `.agent/state/reconcile/*` | Reconcile summaries | Generated runtime artifact |
| `.github/workflows/shrey-junior-contract.yml` | Portable CI backstop | Generated overlay |

## Required Versus Optional

- Required contract files are installed at bootstrap or standardize time.
- Latest continuity pointers such as `.agent/state/handoff/latest.json` or `.agent/state/reconcile/latest.json` are optional until the related workflow has run.
- Task packets are optional until `run`, `fanout`, or `dispatch` has been used.

## Versioning Rules

- Task packets use `schema: shrey-junior/task-packet@v1` frontmatter.
- Specialist role specs use `schema: shrey-junior/specialist-role@v1`.
- Copilot agent surfaces use `schema: shrey-junior/copilot-agent@v1`.
- Current phase artifacts use `artifactType: "shrey-junior/current-phase"`.
- Latest task packet pointers use `artifactType: "shrey-junior/latest-task-packets"`.
- Active role hints use `artifactType: "shrey-junior/active-role-hints"`.
- Checkpoints use `artifactType: "shrey-junior/checkpoint"`.

Generated overlays that may be re-applied should use stable managed markers or explicit schema fields.

## Portability Rules

1. Generated repo-local files must not contain absolute machine-local paths.
2. Repo-local files must remain understandable without hidden runtime state.
3. Machine-global configuration may accelerate behavior, but it is not the portable contract.
4. Cloud-hosted agents may not see `~/.codex`, `~/.claude`, editor prompts, or the local launcher.

## Practical Interpretation

If a tool can only see the repo, the repo-local contract should still let it:

- understand repo authority
- inspect the active profile
- identify the active role and the next files to read
- read current phase and latest handoff
- read the latest task packet set
- understand specialist roles
- inspect portable repo-local memory without depending on hidden session state
- see required checks before push or review
