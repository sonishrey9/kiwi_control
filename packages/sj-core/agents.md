# SJ Core Instructions

This package owns repo-local truth derivation, context logic, planning, validation, and artifact handling.

## Goals
- Keep behavior deterministic, inspectable, and bounded.
- Prefer explicit schemas, explicit contracts, and composable state builders.
- Reduce god modules when maintainability becomes a blocker.

## Constraints
- Do not move authority from source-controlled inputs into opaque derived artifacts.
- Avoid duplicated policy logic across modules.
- Preserve or improve machine-readable contracts used by CLI and UI.
- Prefer incremental refactors over broad rewrites.

## Verification
Run build and tests.
Verify downstream CLI or UI contract compatibility when changing core output shapes.