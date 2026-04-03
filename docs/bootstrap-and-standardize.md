# Bootstrap And Standardize

## Bootstrap

`bootstrap` prepares a target folder or repo with the portable Kiwi Control contract.

It currently:

1. inspects the target safely using shallow metadata
2. resolves project type
3. resolves profile precedence
4. chooses starter specialists, validations, and MCP hints
5. installs the minimized repo-local contract rather than the full template matrix
6. installs only the relevant Copilot instructions and specialist surfaces for the detected repo shape
7. seeds `current-phase.json` and `active-role-hints.json`
8. installs the repo-local verification script and CI workflow
9. prints a high-signal summary with authority source, selected profile, active role, first-read preview, and next verification commands

## Standardize

`standardize` is the explicit existing-repo upgrade path.

Command:

```bash
kiwi-control standardize --target /path/to/repo [--profile <name>] [--project-type <type>] [--dry-run] [--backup]
```

Behavior:

- reuses the bootstrap planner
- defaults to backup mode when applying changes
- preserves repo-authority stand-down behavior
- applies the same selective contract rules as bootstrap
- is intended for existing repos where `bootstrap` would be semantically confusing

## Stand-Down Behavior

If repo authority explicitly requests repo-local-only behavior or explicitly opts out of Kiwi Control routing, bootstrap and standardize should stand down rather than forcing the contract into place.

## Idempotency

- managed overlay files use stable markers
- seed files such as `.agent/state/current-phase.json` are create-only so valid JSON is preserved
- global accelerator scripts use versioned markers for reapplication

## Dry-Run Expectations

Dry-run output should answer:

- what target shape was detected
- what profile source won
- what active role and supporting roles were selected
- what files a tool should read first after generation
- what specialists would be suggested
- which relevant repo-local files would be created or updated
- which surfaces were skipped as irrelevant
- whether repo authority is causing stand-down
- which verification commands should be run next
