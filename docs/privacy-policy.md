# Kiwi Control Privacy Policy

Last updated: April 4, 2026

## Summary

Kiwi Control is built as a local-first product.

For the normal beta workflow:

- repo-local files stay in the repo you point Kiwi Control at
- desktop state is loaded from repo-local artifacts
- the CLI and desktop bridge use local temporary files on your machine
- core usage does not require a Kiwi-hosted cloud service

## What Kiwi Control processes locally

Kiwi Control reads and writes repo-local continuity artifacts such as:

- `.agent/state/*`
- `.agent/memory/*`
- managed repo instruction surfaces

It may also read safe repo metadata needed for initialization, status, validation, checkpoints, handoffs, and desktop rendering.

## What Kiwi Control does not do in the core product path

In the local-first beta flow, Kiwi Control does not:

- upload your repo contents to a Kiwi-operated backend for core functionality
- move the source of truth out of the repo
- require account creation to use the installed CLI or desktop app

## Temporary local bridge files

When you run `kc ui` or `kiwi-control ui`, Kiwi Control uses local temporary bridge files so the CLI can hand the current repo to the desktop app and wait for readiness.

Those files are stored locally in your system temp directory and are used only for local desktop launch coordination.

## Downloads and release distribution

If you download Kiwi Control from GitHub Releases or future package-manager channels, those platforms may collect standard download, request, or analytics data under their own policies.

Kiwi Control itself should not be described as performing hidden product telemetry for core local usage.

## Future hosted features

If Kiwi Control later ships optional hosted or enterprise features, those features will need their own explicit privacy disclosures before they should be treated as available.

This beta policy covers the current local-first product path only.

## Contact

For privacy questions during the beta, use the release/distribution contact listed with the Kiwi Control release materials.
