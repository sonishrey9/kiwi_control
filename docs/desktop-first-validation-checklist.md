# Desktop-first Validation Checklist

This checklist validates Kiwi Control as a real first-repo desktop product, not only as a CLI tool.

## Preconditions

- Install or build the desktop app.
- Open Kiwi Control from the desktop first.
- Use a clean external repo for the first-run flow.
- Capture proof with:
  - `status --json`
  - `pack status --json`
  - desktop render-probe output
  - screenshots for onboarding, blocked state, and pack selection

## Flow

### 1. First launch

Expected result:
- onboarding is desktop-first
- CLI install is optional
- machine setup is presented as one guided action, not as a dashboard
- choosing a repo is the first practical step

Pass:
- the app can be understood without opening Terminal first
- onboarding does not describe `kc` as required
- setup entry points stay compact and honest

### 1a. Machine setup

Commands:

```bash
kc setup status --json --target /path/to/external-repo
kc setup verify --json --target /path/to/external-repo
kc setup --profile desktop-plus-cli --target /path/to/external-repo --dry-run
```

Expected result:
- Kiwi reports machine-global setup separately from repo runtime truth
- detected tools include local helpers such as `ai-setup` when they exist
- setup steps are marked as ready, actionable, blocked, or optional

Pass:
- no machine setup state is written into repo runtime authority
- repeated dry-run setup actions do not mutate files
- setup output is explicit about blocked or unsupported steps

### 2. Choose repo

Expected result:
- the app opens a repo directly
- if repo-local control files are missing, the app clearly asks to initialize

Pass:
- repo selection does not require preinstalled CLI knowledge

### 3. Initialize repo

Command:

```bash
kc init --target /path/to/external-repo
```

Expected result:
- repo-local control files are created
- desktop reflects initialized state without relaunch

Pass:
- `kc status --json` shows initialized repo state
- desktop switches out of onboarding/init-needed state

### 4. Prepare

Command:

```bash
kc prepare "implement a small repo change" --target /path/to/external-repo
```

Expected result:
- bounded context is prepared
- desktop shows the current task and next action

Pass:
- `kc status --json` shows packet-created or prepared lifecycle
- desktop overview reflects the same state

### 5. Run

Command:

```bash
kc run "implement a small repo change" --target /path/to/external-repo
```

Expected result:
- runtime lifecycle moves forward
- recent history updates

Pass:
- desktop history reflects runtime events
- CLI and desktop show the same runtime revision family

### 6. Validate

Command:

```bash
kc validate --target /path/to/external-repo
```

Expected result:
- desktop shows validation result or blocker truthfully

Pass:
- blocked state is clear and not duplicated as multiple primary explanations
- desktop and CLI agree on the blocking reason

### 7. Review

Command:

```bash
kc review --target /path/to/external-repo
```

Expected result:
- review pack is written repo-locally
- desktop can read the updated review-facing state without relaunch

Pass:
- review artifacts exist
- review state is visible from the desktop shell

### 8. Pack selection

Commands:

```bash
kc pack status --json --target /path/to/external-repo
kc pack set web-qa-pack --json --target /path/to/external-repo
kc pack set web-qa-pack --json --target /path/to/external-repo
kc pack clear --json --target /path/to/external-repo
kc pack clear --json --target /path/to/external-repo
```

Expected result:
- executable packs switch immediately
- blocked packs remain blocked
- repeated same actions are true no-ops

Pass:
- runtime revision changes only on semantic pack changes
- repeated same actions do not rewrite:
  - `.agent/state/selected-pack.json`
  - `.agent/state/ready-substrate.json`
  - `.agent/context/agent-pack.json`
  - `.agent/context/repo-map.json`
- desktop reflects pack changes without relaunch

### 9. Blocked-state handling

Expected result:
- overview has one primary blocked explanation
- top shell references the blocked state lightly
- non-overview views do not show another full blocked hero

Pass:
- first-read UI stays simple
- runtime authority still drives the blocker

### 10. Graph build/query

Commands:

```bash
kc graph build --json --target /path/to/external-repo
kc graph status --json --target /path/to/external-repo
kc graph-query --file README.md --json --target /path/to/external-repo
```

Expected result:
- graph authority remains runtime-backed
- graph queries remain truthful and repo-local

Pass:
- status shows graph readiness
- desktop graph surface remains available without becoming the default path

## Proof to capture

- desktop overview screenshot
- onboarding screenshot
- setup status JSON
- setup verify JSON
- blocked-state screenshot
- render-probe payload before and after pack change
- `kc status --json`
- `kc pack status --json`
- artifact hashes before/after repeated pack actions

## Fail conditions

- desktop requires CLI knowledge to get started
- blocked packs appear executable
- repeated same pack action bumps revision
- repeated same pack action rewrites pack-related artifacts
- desktop and CLI disagree on runtime state
- pack or review changes require relaunch to appear
