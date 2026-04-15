# How Kiwi Control Works

Kiwi Control is a local-first, repo-first control plane for coding agents. It does not replace Claude Code, Codex, Cursor, Copilot, or a human engineer. It gives those tools a shared repo-local operating surface: what to read, what is risky, what has already happened, what command should run next, and what evidence should gate a handoff or release.

The short version:

1. The repository keeps the durable truth.
2. `packages/sj-core` derives structured context and workflow state from that truth.
3. `packages/sj-cli` exposes that state through machine-readable commands.
4. `apps/sj-ui` gives the same state a desktop control surface.
5. Coding agents use the outputs to spend less time wandering through irrelevant files.

## What Kiwi Control Is

Kiwi Control is a control plane for serious coding-agent work in real repositories.

It helps with:

- repo onboarding
- context selection
- graph and review surfaces
- role and specialist routing
- validation and push-readiness checks
- checkpoints and handoffs
- local desktop visibility
- measured or estimated token/usage awareness

It is intentionally not:

- a replacement AI agent
- a hidden cloud runtime
- a universal scheduler
- a guarantee of token savings
- a tool that silently mutates global editor or agent settings

## Core Architecture

### `packages/sj-core`

`sj-core` owns repo-local truth derivation. It reads repository authority and `.agent/` state, then builds structured outputs for commands and UI.

Important responsibilities include:

- project detection and bootstrap planning
- context selection and context traces
- repo intelligence artifacts such as repo map, dependency graph, impact map, decision graph, history graph, and review graph
- guidance, workflow, dispatch, collect, reconcile, checkpoint, and handoff logic
- pack selection and MCP/tool capability guidance
- validation, risk, release, and push-readiness signals
- token estimation and token intelligence

### `packages/sj-cli`

`sj-cli` is the operational surface. It wraps core behavior into commands that are useful for humans and machine-readable for agents.

High-value public commands include:

- `kc init`: create the repo-local contract when a repo is not initialized
- `kc status --json`: summarize repo-local state, authority, continuity, and readiness
- `kc guide --json`: tell an agent what to read and what to do next
- `kc graph status --json` and `kc graph build --json`: inspect and refresh repo intelligence artifacts
- `kc pack status --json`: show which context or MCP pack guidance is selected
- `kc review --json`: build review-oriented guidance from the current repo state and diff
- `kc check --json`: validate the repo-local contract and workflow assumptions

### `apps/sj-ui`

`apps/sj-ui` is the Tauri desktop surface. It is not a separate source of truth. It visualizes and operates on the same repo-local state that the CLI and core produce.

The UI focuses on:

- selected repo target
- readiness and validation state
- context tree and graph views
- execution plan and recent activity
- machine setup and advisory state
- handoffs, checkpoints, specialists, and feedback
- token and working-set guidance

### Runtime Bridge

The desktop/runtime bridge helps the CLI and desktop app agree on the active repo target and current state revision. It keeps UI state aligned with repo-local artifacts instead of inventing hidden product state.

## Repo-Local Contract

Kiwi Control writes and reads a portable repo-local contract under `.agent/`.

Common surfaces include:

- `.agent/project.yaml`
- `.agent/checks.yaml`
- `.agent/context/commands.md`
- `.agent/context/tool-capabilities.md`
- `.agent/context/mcp-capabilities.md`
- `.agent/context/specialists.md`
- `.agent/context/*-pack.json`
- `.agent/memory/current-focus.json`
- `.agent/state/active-role-hints.json`
- `.agent/state/current-phase.json`
- `.agent/state/checkpoints/latest.json`
- `.agent/state/review-graph.json`
- `.agent/state/decision-graph.json`
- `.agent/state/history-graph.json`

These files are intentionally inspectable. Open-source users can read them, diff them, and decide whether Kiwi Control's guidance makes sense.

## How Kiwi Fits With Coding Agents

Kiwi Control gives coding agents a better starting position.

Without Kiwi Control, an agent often has to infer:

- which files matter
- which docs are authoritative
- which task phase is active
- what validation commands are expected
- whether previous work had unresolved blockers
- which tool capabilities are available
- how much context it is about to burn

With Kiwi Control, those decisions are surfaced as repo-local artifacts and JSON command outputs. The agent still does the work. Kiwi Control reduces the amount of guesswork around the work.

## How Token Waste Is Reduced

Kiwi Control does not magically make models cheaper. It reduces waste by changing the workflow shape:

- context selection ranks files before an agent reads the whole repo
- graph and review surfaces point to risky or related files
- guidance outputs tell agents which command or file is likely next
- checkpoints and handoffs prevent repeated rediscovery after interruptions
- pack selection keeps MCP/tool guidance scoped to the repo and task
- token intelligence exposes working-set estimates and measured usage when available

The public proof page reports one controlled A/B run where the Kiwi-assisted workflow used less measured Claude cost, fewer turns, and less Claude wall-clock time. That result is useful product evidence, not a universal benchmark.

## Typical Repo Flow

```bash
cd /path/to/repo
kc init
kc status --json
kc guide --json
kc graph status --json
kc graph build --json
kc pack status --json
kc review --json
kc check --json
```

After implementation, a team can checkpoint and hand off:

```bash
kc checkpoint "ready for review"
kc handoff --to review-specialist
kc push-check
```

## How CLI And UI Stay Aligned

The CLI and desktop app share the same repo-local source of truth. The CLI produces structured outputs and updates repo-local state. The UI reads and watches those surfaces, then presents them visually.

This design avoids two common failure modes:

- the UI showing a separate hidden state that the CLI cannot explain
- the CLI producing guidance that the desktop app cannot inspect

## What Is Beta

Kiwi Control is in public beta. The product is useful now, but the release surface still calls out beta limits:

- installer signing and notarization status is release-specific
- Windows installers are live, but signing proof remains incomplete for this beta
- Homebrew and winget are not published install paths yet
- some machine-advisory and token views depend on local tool availability
- measured savings are from one controlled run, not a universal claim

## Where To Inspect More

- [Architecture diagrams](./architecture-diagrams.md)
- [Technical architecture](./technical-architecture.md)
- [Repo lifecycle](./repo-lifecycle.md)
- [Generated artifact policy](./generated-artifacts.md)
- [Security and trust](./security-and-trust.md)
- [Architecture FAQ](./architecture-faq.md)
