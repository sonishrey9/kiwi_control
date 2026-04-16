# Kiwi Control Command Guide

This is the practical command guide for first-time Kiwi Control users.

## The two command names

Kiwi Control installs the same CLI under two names:

- `kiwi-control`
- `kc`

Use whichever you prefer. Most day-to-day examples use `kc` because it is shorter.

## Fastest first session

If the repo is not initialized yet:

```bash
cd /path/to/repo
kc init
kc status
kc guide
kc graph build
kc pack status
kc review
kc check
kc ui
```

If the repo is already initialized:

```bash
cd /path/to/repo
kc status
kc guide
kc graph status
kc graph build
kc pack status
kc review
kc check
kc ui
```

## What to run first

### `kc init`

Use this when a repo is not initialized for Kiwi Control yet.

```bash
kc init
```

### `kc status`

Use this first when you want the current repo state and readiness.

```bash
kc status
kc status --json
```

### `kc guide`

Use this after `status` to get the next useful files and commands.

```bash
kc guide
kc guide --json
```

### `kc graph status` and `kc graph build`

Use graph commands when you want repo intelligence status or a refreshed graph.

```bash
kc graph status
kc graph status --json
kc graph build
kc graph build --json
```

### `kc pack status`

Use this to see the current pack selection and capability guidance.

```bash
kc pack status
kc pack status --json
```

### `kc review`

Use this to get review-oriented guidance from the current repo state and diff.

```bash
kc review
kc review --json
```

### `kc check`

Use this before review, handoff, or push discussion.

```bash
kc check
kc check --json
```

### `kc ui`

Use this to launch or attach to the desktop app.

```bash
kc ui
kc ui --json
```

## Common workflow commands

These are the most useful follow-on commands after onboarding:

### `kc next`

Show the next useful step from the current repo state.

```bash
kc next
kc next --json
```

### `kc validate`

Run validation-oriented workflow checks for the current task or repo state.

```bash
kc validate
kc validate "refresh docs and command guide"
kc validate --json
```

### `kc trace`

Inspect execution trace and runtime continuity details.

```bash
kc trace
kc trace --json
```

### `kc checkpoint`

Record a milestone before review, handoff, or push discussion.

```bash
kc checkpoint "ready for review"
```

### `kc handoff`

Create a structured handoff to another role.

```bash
kc handoff --to qa-specialist
```

### `kc push-check`

Check whether the repo looks ready for push discussion.

```bash
kc push-check
```

## JSON-first commands for agents

If you want to feed Kiwi Control output into another agent or tool, start with JSON:

```bash
kc status --json
kc guide --json
kc graph build --json
kc pack status --json
kc review --json
kc check --json
```

## Typical patterns

## New repo onboarding

```bash
kc init
kc status
kc guide
kc graph build
kc review
kc check
```

## Existing repo orientation

```bash
kc status
kc guide
kc graph status
kc graph build
kc review
kc check
```

## Before opening the desktop app

```bash
kc status
kc ui
```

## Before asking Claude Code, Codex, or Cursor to go deep

```bash
kc status --json
kc guide --json
kc graph build --json
kc pack status --json
kc review --json
```

That keeps the first agent read narrower and more repo-aware.

## Troubleshooting

## `kc ui` does not open anything

Check whether the desktop app is installed first:

```bash
kc ui
```

If you are on a CLI-only machine with no desktop install, the command cannot open the app for you.

## `kc` works but `kiwi-control` does not

Re-run the wrapper install so both commands are installed together.

macOS or Linux:

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex
```

## I only want the CLI

Use the wrapper installers. They install the CLI bundle only by default.

## I only installed the desktop app

That is supported. For basic desktop usage, you do not need the CLI. If you later want terminal commands too, run the wrapper install or use installer-owned CLI setup where supported.

## I am using Claude Code, Codex, or Cursor. What should I do first?

Run:

```bash
kc status
kc guide
kc graph build
kc review
```

Then start the coding-agent work from that repo state.

## Related docs

- [Install guide](./install.md)
- [How Kiwi Control works](./how-kiwi-control-works.md)
- [Architecture FAQ](./architecture-faq.md)
