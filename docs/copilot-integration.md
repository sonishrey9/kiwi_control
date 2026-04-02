# Copilot Integration

## Scope

Shrey Junior integrates with Copilot-style workflows through repo-local GitHub surfaces rather than relying on personal editor prompts alone.

## Repo-Local Copilot Surfaces

- `.github/copilot-instructions.md`
- `.github/instructions/backend.instructions.md`
- `.github/instructions/frontend.instructions.md`
- `.github/instructions/docs.instructions.md`
- `.github/instructions/data.instructions.md`
- `.github/agents/shrey-junior.md`
- `.github/agents/<specialist>.md`

## What These Files Do

- explain repo-authority precedence
- point Copilot toward `.agent/project.yaml`, `.agent/checks.yaml`, role specs, and latest continuity artifacts
- separate trivial inline work from non-trivial routed work
- expose specialist-oriented guidance using repo-local files

## Proven Behavior

- Bootstrap and standardize can generate these files.
- Validation now checks that these files exist in a standardized repo.
- Context compilation can ingest `.github/instructions/*` and `.github/agents/*`.

## Structurally Supported Behavior

- A Copilot runtime that reads repo-local GitHub instruction surfaces can align more closely with the Shrey Junior contract.
- Specialist agent docs provide a repo-local role contract Copilot-like tools can read.

## Unproven Behavior

- Universal honoring of `.github/agents/*.md` by every Copilot runtime
- Strong orchestration control inside suggestion-oriented UIs
- Consistent use of local CLI commands from cloud-hosted Copilot experiences

## Limitations

- Copilot remains suggestion-oriented and less controllable than an explicit orchestration runtime.
- Repo-local files can guide, but they do not guarantee runtime obedience.
- CI remains the backstop when instruction following is incomplete.
