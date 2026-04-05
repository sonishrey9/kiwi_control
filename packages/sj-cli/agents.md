# SJ CLI Instructions

This package owns user-facing workflows and machine-readable command output.

## Goals
- Keep commands coherent, scriptable, and stable.
- Prefer explicit JSON contracts for UI-facing or automation-facing flows.
- Keep output formatting consistent across commands.

## Constraints
- Avoid mixing human-only output and machine contracts in unstable ways.
- Preserve backward compatibility where reasonable.
- Keep commands thin over core logic when possible.

## Verification
Run build and tests.
Verify JSON outputs explicitly for any command contract changes.