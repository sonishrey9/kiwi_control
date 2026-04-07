# Security Policy

## Supported scope

Kiwi Control is a repo-local control plane. Security issues are especially important in:

- Tauri command handlers
- CLI execution bridges
- file-open and path validation
- repo-local artifact handling under `.agent/`
- release/install distribution integrity

## Reporting a vulnerability

Do not open a public issue for security-sensitive reports.

Send a private report to:

- sonishrey9@gmail.com

Please include:

- affected version or commit
- platform details
- reproduction steps
- expected vs actual behavior
- impact assessment
- suggested mitigation, if known

## Response expectations

For the public beta period, maintainers aim to:

- acknowledge reports promptly
- confirm whether the issue is in scope
- provide status updates when a fix is in progress

## Security boundaries

This repository should preserve:

- explicit command allowlists
- path-boundary enforcement
- repo-local authority rules
- non-destructive defaults
- machine-global state as advisory, not authoritative
