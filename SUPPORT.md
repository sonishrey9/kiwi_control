# Support

Kiwi Control is a public beta. Support should stay explicit, modest, and tied to the actual release flow.

## Before opening an issue

Please include:

- OS and shell
- Node version if you installed the CLI manually
- whether you are running from source or a release artifact
- the exact command you ran
- whether the target repo was already initialized
- the release tag or release page you installed from

## Support channels

- bugs and reproducible regressions: GitHub Issues
- product and roadmap discussion: GitHub Discussions when enabled
- install and release source of truth: [GitHub Releases](https://github.com/sonishrey9/kiwi-control/releases/latest)
- creator contact: Shrey Soni
- GitHub: https://github.com/sonishrey9
- LinkedIn: https://www.linkedin.com/in/shreykumarsoni/
- Email: sonishrey9@gmail.com

## Public beta expectations

- response time is best-effort during beta
- GitHub Releases is the source of truth for installable artifacts
- the website should point back to releases, not replace them
- signing and notarization status must be checked against release notes and checksums
- if you are running from source, say so explicitly in bug reports

## macOS external volume warning

If you are using an external macOS volume, mention that immediately.

AppleDouble `._*` files can appear in the working tree or even inside `.git` and break Git pack indexes. If that happens, run:

```bash
npm run clean:macos-sidecars
```

and retry the Git operation, or move the repo to internal storage.

## Scope reminders

- Kiwi Control does not promise universal MCP/runtime parity
- desktop packaging remains beta software until signing is configured per release
- repo-local artifacts remain the ground truth for debugging continuity issues
