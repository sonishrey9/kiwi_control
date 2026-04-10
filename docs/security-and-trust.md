# Kiwi Control Security & Trust

Last updated: April 4, 2026

## Security model summary

Kiwi Control is designed as a local-first, repo-first product.

Security and trust depend on these principles:

- repo-local artifacts are authoritative
- the desktop app is a control surface, not the source of truth
- core usage should not depend on a hidden cloud service
- install and release trust must be described honestly

## What the product does today

Current Kiwi Control beta behavior:

- installed CLI commands: `kiwi-control` and `kc`
- repo-local initialization, status, validation, checkpoints, and handoffs
- local desktop launch bridge for `kc ui`
- desktop auto-load of the current repo after CLI launch acknowledgement
- optional terminal-command enablement happens only after explicit user approval from the desktop app and is not required for desktop usage

## What the product does not claim yet

Do not claim any of the following unless the current release actually includes them:

- signed macOS trust if signing and notarization are incomplete
- signed Windows trust if code signing is incomplete
- updater trust if updater signing is not configured and active
- package-manager availability if Homebrew or winget are not yet published

## Local bridge behavior

`kc ui` uses local request, status, and log files in the system temp directory to coordinate desktop launch and repo targeting.

This bridge is intentionally local and minimal:

- it hands the current repo path from CLI to desktop
- it waits for the desktop app to acknowledge readiness
- it avoids moving repo truth into app-owned storage

## Secrets and repo data

Kiwi Control should not be described as copying repo authority into a Kiwi backend for core usage.

Repo-local files, prompts, instructions, and continuity artifacts remain in the repo. Users are still responsible for the security of their own machines, repositories, and release channels.

## Release trust checklist

Before calling a release fully trusted for public distribution, complete and verify:

1. macOS signing and notarization
2. Windows signing for both NSIS and MSI installers
3. updater signing, if updater artifacts are enabled
4. published release checksums
5. real Homebrew and winget metadata with live URLs and SHA256 values

Use `npm run release:trust -- --platform macos --json` or `npm run release:trust -- --platform windows --json` to classify release trust before writing release notes. The strict form must run on release builders; macOS must report `signed-and-notarized`, and Windows must be verified on a Windows runner. SmartScreen reputation is external to Kiwi's repo checks and must not be implied by a successful signature check alone.

## Enterprise status

Enterprise controls, managed distribution, and hosted support are coming later.

They should not be implied by the current beta unless they are explicitly shipped and documented.
