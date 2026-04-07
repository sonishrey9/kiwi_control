# Security Policy

## Supported scope

Kiwi Control is a repo-local control plane. Security issues are especially important in these areas:

- Tauri command handlers
- CLI execution bridges
- file-open and path validation
- repo-local artifact handling under `.agent/`
- machine advisory and environment discovery

## Reporting a vulnerability

Please do not open public issues for security-sensitive reports.

Instead:

1. prepare a minimal reproduction
2. describe impact, affected files, and required privileges
3. send the report privately to the maintainers through the project’s private contact channel

Current private contact route for the public beta:

- sonishrey9@gmail.com
- LinkedIn DM: https://www.linkedin.com/in/shreykumarsoni/
- Phone / Signal / WhatsApp: +91 8109542640

If no private channel is listed yet, open a minimal issue asking for a private reporting route without disclosing the vulnerability details.

## What to include

- affected version or commit
- platform details
- reproduction steps
- expected vs actual behavior
- impact assessment
- suggested mitigation if known

## Response expectations

For the public beta period, maintainers will aim to:

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
