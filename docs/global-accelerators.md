# Global Accelerators

## Purpose

Machine-global Shrey Junior surfaces still matter, but they are no longer the source of truth. They are accelerators that point tools back to the repo-local contract whenever it exists.

## Current Accelerator Surfaces

- `~/.codex/AGENTS.md`
- `~/.codex/config.toml`
- `~/.claude/CLAUDE.md`
- `~/.claude/settings.json`
- `~/.claude/commands/shrey-read-first.md`
- `~/.claude/commands/shrey-serious-task.md`
- `~/Library/Application Support/Code/User/prompts/shrey-junior.instructions.md`
- `~/Library/Application Support/Code/User/mcp.json`
- global `shrey-junior` launcher on `PATH`

## Operating Rule

When a repo has been bootstrapped or standardized:

1. repo-local authority comes first
2. repo-local Shrey Junior contract comes next
3. machine-global accelerators only fill the gap when repo-local surfaces do not exist yet

## Practical Read Order Reinforced By Global Files

The accelerator layer should push tools toward the same first reads:

1. trusted repo authority files
2. `.agent/state/active-role-hints.json`
3. `.agent/state/current-phase.json`
4. latest packet, handoff, dispatch, and reconcile pointers
5. relevant path-specific instruction files
6. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`

## Current Local-Only Reinforcements

- Codex global guidance and config now point back to the repo-local contract and preserve supported TOML config instead of inventing a custom format.
- Claude global guidance, safe Bash allowlist settings, and Shrey helper commands now steer serious work back through repo-local continuity artifacts.
- VS Code user prompts and user MCP config remain accelerators for local ergonomics only.

## Proven Behavior

- Global preference layers exist and are marker-versioned.
- Global reapply is idempotent.
- Global rollback is tested.
- Global verification now also covers Codex config, Claude settings, and the Shrey helper commands.

## Structurally Supported Behavior

- Local tools that can see these home-directory files should start with better Shrey Junior alignment.

## Unproven Behavior

- Cloud-hosted agents consistently reading these machine-global files
- Hosted runtimes being able to invoke the local launcher

## Why The Repo Contract Matters More

Cloud and portable environments may only see the repo. That is why the durable control plane has to live in repo-local files, with global accelerators only improving local ergonomics.
