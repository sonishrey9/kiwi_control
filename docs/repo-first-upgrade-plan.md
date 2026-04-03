# Repo-First Upgrade Plan

## Goal

Move Kiwi Control from a machine-accelerated workflow helper toward a portable repo-first agent contract that cooperative tools can consume even when machine-global files are unavailable.

## Gap Map

| Area | Status before upgrade | Gap |
| --- | --- | --- |
| Repo-local overlays (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`) | Implemented | Needed stronger references to repo-local state, specialist roles, and portable continuity artifacts |
| `.agent/project.yaml` and `.agent/checks.yaml` | Implemented | Needed to become a fuller contract surface, not just bootstrap metadata |
| Repo-local Copilot-native surfaces (`.github/instructions/*.instructions.md`, `.github/agents/*.md`) | Partial | Missing generation, validation, and docs |
| Repo-local specialist role specs | Partial | Specialist routing existed in config only; repo-local role contracts were missing |
| File-based task and continuity contracts | Partial | Packets, handoffs, dispatch, and reconcile existed, but latest pointers and stable schema language were incomplete |
| Existing repo standardization path | Partial | `bootstrap` worked, but there was no explicit repo-standardization command |
| CI contract enforcement | Partial | Push checks existed locally, but generated repos did not carry a portable contract verification workflow |
| Local-global preference surfaces | Implemented | Needed clearer framing as accelerators that defer to repo-local truth |
| Architecture and portability docs | Partial | Existing docs described the system, but not the full repo-first contract or local vs cloud visibility model |

## Upgrade Principles

1. Repo-local truth beats user-global accelerators.
2. Repo-local artifacts should be sufficient for continuity.
3. Generated state should stay human-readable.
4. CI is the backstop where prompts cannot enforce behavior.
5. Cloud portability should rely on repo-local files, not home-directory configuration.

## Planned Deliverables

- Canonical repo-local contract templates
- Copilot-native repo surfaces
- Claude-style specialist role specs
- Stable task and continuity artifact contracts
- `standardize` flow for existing repos
- Portable CI verification template
- Honest architecture and closeout documentation
