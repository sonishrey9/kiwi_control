# Kiwi Control Architecture FAQ

## Is Kiwi Control an AI agent?

No. Kiwi Control is a control plane for coding agents. Claude Code, Codex, Cursor, Copilot, and similar tools still perform the agent work. Kiwi Control gives them repo-local context, workflow state, review surfaces, and validation guidance.

## Does Kiwi Control replace Claude Code or Codex?

No. It is designed to work with them. The intended model is: use Kiwi Control to structure the repo workflow, then let your preferred coding agent work with better context and less guesswork.

## How does it reduce wasted token usage?

Kiwi Control reduces waste by narrowing and explaining the working set before an agent starts broad exploration. It uses repo authority, selected context, graph artifacts, review packs, checkpoints, and handoffs to reduce repeated rediscovery.

The public A/B proof shows one controlled run with lower measured Claude usage and wall-clock time. That is evidence from one task, not a universal benchmark or guarantee.

## Does it work locally?

Yes. The core design is local-first and repo-first. The durable contract lives inside the repository, primarily under `.agent/`, with human-facing authority in files such as `AGENTS.md`, `CLAUDE.md`, README, docs, and generated instruction surfaces.

## Does Kiwi Control require a cloud service?

No. The public website hosts downloads, metadata, docs, and proof assets, but the control-plane model does not require a hosted service to coordinate a repo.

## How does it track repo state?

Kiwi Control reads trusted repo authority and writes structured repo-local artifacts such as `.agent/project.yaml`, `.agent/checks.yaml`, `.agent/context/*`, `.agent/memory/*`, and `.agent/state/*`. Commands such as `status`, `guide`, `graph`, `review`, and `check` derive their answers from those files and the current repo state.

## What does `graph` mean?

`kc graph` builds and reports repo intelligence artifacts such as repo maps, symbol indexes, dependency graphs, impact maps, decision graphs, history graphs, and review graphs. These artifacts help an agent understand what might be relevant before it reads too much.

## What does `pack` mean?

`kc pack` reports selected context or MCP/tool guidance for the current repo and task shape. It is routing guidance, not a promise that every external MCP capability exists on every machine.

## What does `review` mean?

`kc review` builds review-oriented guidance from the repo intelligence artifacts and current diff. It helps prioritize risky files, likely validation commands, and reviewer handoff context.

## What does `check` mean?

`kc check` validates the repo-local contract and workflow assumptions. It is a safety and readiness check, not an automatic release or commit action.

## How does the desktop UI relate to the CLI?

The desktop UI reads and visualizes the same repo-local state that the CLI produces. It is not a separate hidden source of truth.

## What is still beta?

Installer signing trust is still release-specific, Homebrew and winget are not live public install paths, and some machine-advisory or usage views depend on local tool availability. Public proof is based on one measured controlled run, not a universal benchmark.

## How can I contribute?

Start with the README, architecture docs, and contribution guidance. Keep changes scoped, testable, and honest about beta limits. Architecture and release-related changes should include verification evidence.

## How do I ask deeper questions?

Use GitHub Issues for reproducible bugs, GitHub Discussions when enabled for product discussion, or reach out to Shrey Soni through the public support links:

- GitHub: https://github.com/sonishrey9
- LinkedIn: https://www.linkedin.com/in/shreykumarsoni/
- Email: sonishrey9@gmail.com
