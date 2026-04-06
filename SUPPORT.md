# Support

Kiwi Control is currently a public beta. Support expectations should stay explicit and modest.

## Before opening an issue

Please include:

- OS and shell
- Node version
- whether you are running from source or a release artifact
- the exact command used
- whether the target repo was already initialized

## Support channels

- bugs and reproducible regressions: GitHub Issues
- roadmap and product discussion: GitHub Discussions once enabled
- security-sensitive reports: use private reporting instead of public issues

## Public beta expectations

- Issues are welcome, but response time is best-effort during beta.
- GitHub Releases is the source of truth for installable artifacts.
- Desktop signing/notarization status should always be checked against the release notes.
- If you are running from source, mention that explicitly in any report.
- If you are using an external macOS volume, mention that too, because AppleDouble `._*` files can corrupt Git metadata on some drives.

## Scope reminders

- Shrey Junior does not promise universal MCP support
- desktop packaging is still pre-release scaffolding until signing is configured
- repo-local artifacts remain the ground truth for debugging continuity issues
