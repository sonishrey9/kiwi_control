# Defaults And Precedence

Bootstrap and first-run setup follow a conservative precedence model.

## Profile selection precedence

When `bootstrap` chooses a starter profile, it resolves in this order:

1. existing trusted repo authority that already points to a profile
2. repo-local Kiwi Control state in `.agent/project.yaml`
3. explicit CLI flags such as `--profile`
4. optional global Kiwi Control defaults in `~/.shrey-junior/defaults/bootstrap.yaml`
5. fallback starter mapping from detected project type
6. canonical default profile from `configs/global.yaml`

This means explicit flags guide new folders, but they do not silently overrule a repo that already declares its own truth.

## Operational precedence

After a repo is bootstrapped, day-to-day operation uses this order:

1. target repo existing authority
2. repo-local Kiwi Control state
3. explicit CLI flags for the current command
4. global Kiwi Control defaults
5. fallback templates

## Why the order is conservative

- repo truth should beat machine defaults
- repo-local state should beat machine-level convenience
- CLI flags should be strong, but not destructive
- global defaults should help first-run UX, not cause config drift
