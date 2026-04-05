# SJ UI Instructions

This package owns the Kiwi Control desktop experience.

## Goals
- Keep the UI interactive, trustworthy, and operator-friendly.
- Preserve coherence of the visual system.
- Improve usability, keyboard support, focus behavior, and inspector clarity.
- Refactor large renderer files into smaller modules when needed.

## Constraints
- Do not migrate to React unless explicitly requested.
- Do not redesign casually.
- Prefer stable IDs, explicit action contracts, and durable persistence for high-value actions.
- Add tests for nontrivial UI behavior or bridge changes.

## Verification
Run package-specific build or test commands when this package changes.
Verify command-triggered flows and keyboard behavior where applicable.