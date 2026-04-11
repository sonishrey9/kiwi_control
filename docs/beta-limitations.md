# Kiwi Control Public Beta Limitations

Last updated: April 6, 2026

Kiwi Control is shipping as a local-first public beta. The core repo-local control-plane experience is real and usable, but some parts of the product and distribution story are intentionally still rough.

## Current beta limitations

### Desktop trust and packaging

- Windows desktop signing is not finalized yet.
- macOS signing and notarization are still manual.
- Auto-update trust is not enabled for public use yet.
- The public website is the source of truth for beta release status. GitHub Release assets are the current beta binary host until another delivery path is explicitly published. Homebrew and winget should only be treated as live once they are actually published.

### Product UX

- Invalid repo state can still block checkpoint, handoff, and validation flows. Kiwi now explains these blocks more clearly, but the product still expects users to repair repo-local state instead of silently bypassing it.
- Placeholder-task flows are still a common source of weak context selection unless users prepare with a concrete task.
- Some desktop surfaces still lean on heuristic explanation and bounded selection rather than full semantic graphs or perfect measured token attribution.

### Tool/runtime expectations

- Kiwi Control is a repo-local control plane, not a universal agent runtime.
- Runtime parity should not be assumed across Codex, Claude-style tools, Copilot, Cursor, or hosted environments.
- Machine-local accelerators improve experience when available, but they do not replace repo-local truth.

### Contributor environment caveats

- Some external macOS volumes create `._*` AppleDouble files inside `.git`, which can break Git pack indexes and make large clones unreliable.
- If you hit Git errors like `non-monotonic index ... ._pack-*.idx`, move the repo to internal storage or recursively remove `._*` files inside `.git` before continuing.

## What is stable enough for beta

- Repo-local initialization, status, validation, checkpoints, and handoffs
- Context trees, bounded selection, and execution-plan state
- Desktop repo auto-load from `kiwi-control ui`
- Warm-state desktop loading and background refresh
- GitHub Release-based CLI and desktop artifact distribution

## What users should expect

- Kiwi will be explicit when a repo is blocked, invalid, or only partially hydrated.
- Kiwi will not silently mutate repo-local authority just because the desktop is open.
- Kiwi may use warm snapshots and staged hydration for speed, but should label cached, refreshing, degraded, and ready states honestly.

## Recommended beta wording

Use this framing consistently in public materials:

- local-first public beta
- repo-local authority
- GitHub Releases first
- Windows-first desktop beta, macOS desktop beta next
- strong CLI/core, improving desktop polish
