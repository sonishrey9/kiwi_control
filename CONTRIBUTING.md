# Contributing to Kiwi Control

Kiwi Control is a public beta. Contributions should improve the product without weakening its repo-first, local-first model.

## Before you start

Read these first:

- [README.md](./README.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/generated-artifacts.md](./docs/generated-artifacts.md)
- [SUPPORT.md](./SUPPORT.md)
- [SECURITY.md](./SECURITY.md)
- [docs/README.md](./docs/README.md)

## Contribution priorities

The highest-value public contributions are:

- installer and release quality
- repo-local workflow clarity
- desktop polish and test coverage
- CLI output consistency
- documentation that helps users install, trust, and debug the product honestly

Avoid broad speculative rewrites.

## Generated artifacts

Kiwi Control uses repo-local generated artifacts for continuity, review, and verification, but not all of them belong in Git.

Before committing:

- restore or ignore volatile `.agent/**/*.json` and `.ndjson` runtime files
- restore or ignore local proof outputs such as `.playwright-cli/**` and `output/playwright/**`
- restore or ignore `dist/release/**` unless the task explicitly changes release packaging source
- remove AppleDouble sidecars such as `._*`

See [docs/generated-artifacts.md](./docs/generated-artifacts.md) for the exact policy.

## Guardrails

- preserve repo-local authority boundaries
- keep diffs targeted and reviewable
- do not add heavy dependencies casually
- keep file and command surfaces explicit
- do not weaken path validation or desktop command allowlists
- do not over-claim release trust, signing, or runtime parity

## Setup

Requirements:

- Node.js 22+
- npm 10+
- Rust/Cargo for desktop builds

Install dependencies:

```bash
npm install
```

## Verification

Default local loop:

```bash
npm run build
npm test
bash scripts/smoke-test.sh
```

Desktop development:

```bash
npm run ui:dev
```

Desktop production build:

```bash
npm run ui:desktop:build
```

macOS sidecar cleanup:

```bash
npm run clean:macos-sidecars
```

If you are on an external macOS volume and Git starts failing with `non-monotonic index ... ._pack-*.idx`, run the cleanup command again or move the repo to internal storage.

## Pull requests

Please include:

- the problem statement
- user-facing impact
- release/install impact, if any
- exact verification commands run
- exact results
- platform(s) exercised for desktop changes
- remaining limitations or follow-up work

## Public beta expectations

- GitHub Releases is the source of truth for installable artifacts
- the website should stay aligned with the release flow
- support response time is best-effort during beta
- user-facing docs should prefer `kiwi-control` and `kc`
- internal compatibility names should stay implementation details unless they matter for contributor work

## Security-sensitive areas

Be extra careful when touching:

- Tauri command handlers
- CLI execution bridges
- file opening behavior
- repo path validation
- `.agent/` authority artifacts

Never weaken:

- path-boundary checks
- explicit command allowlists
- repo-local authority rules
- read-only machine advisory guarantees
