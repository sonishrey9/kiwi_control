# Checkpointing

Shrey Junior checkpoints are compact continuity artifacts for serious work. Use them after meaningful implementation, before QA-heavy review, before handoff, and before push-oriented validation.

Primary artifacts:

- `.agent/state/checkpoints/<timestamp>.json`: machine-readable checkpoint record
- `.agent/state/checkpoints/<timestamp>.md`: human-readable checkpoint summary
- `.agent/state/checkpoints/latest.json`: latest checkpoint pointer payload
- `.agent/state/checkpoints/latest.md`: latest checkpoint pointer summary

Each checkpoint captures:

- phase and active role
- supporting roles
- authority source
- short summary and task context
- files touched / created / deleted
- checks run and pass/fail state
- git branch and commit-before / commit-after when available
- dirty/staged state even before the first commit
- related task packet, handoff, or reconcile artifacts
- next recommended action and next suggested command

Operational guidance:

- Fresh repos start with a bootstrap seed checkpoint. Replace it after real work.
- Prefer `shrey-junior checkpoint "<milestone>" --target <repo>` after non-trivial implementation.
- Review and QA tools should read `active-role-hints.json`, then `current-phase.json`, then `checkpoints/latest.json`.
- Handoff and reconcile artifacts should point back to the latest checkpoint instead of repeating long histories.
- Checkpoints are continuity aids, not commit substitutes. They should stay compact and factual.
