# Kiwi Control Security & Trust

Last updated: April 13, 2026

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
- Windows packaging is being upgraded so the setup EXE can handle terminal command setup during install, but public “ready by default” claims still require real Windows-host proof
- macOS pkg is the intended default path for install-time terminal command setup, while the in-app repair step remains fallback only
- the standalone CLI bundle installs `kiwi-control` and `kc` only; it does not install the desktop app

## What the product does not claim yet

Do not claim any of the following unless the current release actually includes them:

- signed macOS trust if signing and notarization are incomplete
- signed Windows trust if code signing is incomplete
- Windows post-install `kc` readiness by default if the setup EXE path has not been proven on a real Windows host
- Windows MSI default-CLI readiness if MSI has not been separately proven to the same bar as the setup EXE
- macOS pkg default-CLI readiness if the pkg installer path has not actually been verified for the current release
- updater trust if updater signing is not configured and active
- package-manager availability if Homebrew or winget are not yet published

## Local bridge behavior

`kc ui` uses local request, status, and log files in the system temp directory to coordinate desktop launch and repo targeting.

This bridge is intentionally local and minimal:

- it hands the current repo path from CLI to desktop
- it waits for the desktop app to acknowledge readiness
- it avoids moving repo truth into app-owned storage

`kc ui` is a local launch or attach path. It only works when Kiwi Control Desktop is already installed on the same machine.

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

Website-hosted release status and GitHub-hosted release assets do not change this trust bar. Public download availability only means the artifacts are reachable. Public release trust still depends on:

- macOS signed + notarized + stapled artifacts
- Windows signed NSIS and MSI installers verified on Windows
- published checksums and release notes that match the current artifacts

Install-time CLI readiness is a separate claim from trust:

- macOS pkg may make `kc` available during install even when the build is still an unsigned beta
- unsigned beta builds may still require a manual first-open override on macOS
- Windows installer-owned PATH success still needs separate real-host proof before it becomes a public default-ready claim

## Enterprise status

Enterprise controls, managed distribution, and hosted support are coming later.

They should not be implied by the current beta unless they are explicitly shipped and documented.
