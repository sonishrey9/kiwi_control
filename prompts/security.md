# Security Packet

Goal: `{{goal}}`

Project: `{{projectName}}`
Profile: `{{profileName}}`

Guardrails:

- read repo authority, promoted docs, and current phase state before making security claims
- never print secrets
- never weaken existing security controls
- metadata-only reads for risky config surfaces
- refuse direct ingest of `.env`, keys, tokens, and session stores
- keep global configs untouched
- preserve additive sync behavior

Review for:

- unsafe file reads
- unsafe writes to global config
- risky prompt packet contents
- managed file ownership mistakes
- policy-blind MCP usage
- missing escalation for auth, data, security, or release-sensitive work
