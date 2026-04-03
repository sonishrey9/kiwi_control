#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(pwd)"

required_files=(
{{verifyRequiredFilesBash}}
)

for file_path in "${required_files[@]}"; do
  if [[ ! -f "$file_path" ]]; then
    echo "missing required repo-contract file: $file_path" >&2
    exit 1
  fi
done

grep -q "SHREY-JUNIOR" "AGENTS.md"
grep -q "SHREY-JUNIOR" "CLAUDE.md"
grep -q "SHREY-JUNIOR" ".github/copilot-instructions.md"

python3 - <<'PY'
from pathlib import Path
import json

required_pointer_paths = [
{{verifyOptionalLatestFilesPython}}
]

phase = json.loads(Path(".agent/state/current-phase.json").read_text(encoding="utf-8"))
if phase.get("artifactType") != "shrey-junior/current-phase":
    raise SystemExit("current-phase.json has the wrong artifactType")
if phase.get("status") != "complete":
    raise SystemExit("current-phase.json must describe a completed bootstrap-ready phase for CI")
if not phase.get("validationsRun"):
    raise SystemExit("current-phase.json must record validationsRun before CI can pass")
if phase.get("warnings"):
    raise SystemExit("current-phase.json still carries warnings")
if phase.get("openIssues"):
    raise SystemExit("current-phase.json still carries openIssues")

active = json.loads(Path(".agent/state/active-role-hints.json").read_text(encoding="utf-8"))
if active.get("artifactType") != "shrey-junior/active-role-hints":
    raise SystemExit("active-role-hints.json has the wrong artifactType")
if not active.get("updatedAt"):
    raise SystemExit("active-role-hints.json must include updatedAt")
if not active.get("activeRole"):
    raise SystemExit("active-role-hints.json must include activeRole")
if not active.get("readNext"):
    raise SystemExit("active-role-hints.json must include readNext")
if not active.get("nextFileToRead"):
    raise SystemExit("active-role-hints.json must include nextFileToRead")
if not active.get("nextSuggestedCommand"):
    raise SystemExit("active-role-hints.json must include nextSuggestedCommand")
if not active.get("checksToRun"):
    raise SystemExit("active-role-hints.json must include checksToRun")
if not active.get("nextAction"):
    raise SystemExit("active-role-hints.json must include nextAction")
search_guidance = active.get("searchGuidance")
if not isinstance(search_guidance, dict):
    raise SystemExit("active-role-hints.json must include searchGuidance")
if "inspectCodebaseFirst" not in search_guidance or "repoDocsFirst" not in search_guidance:
    raise SystemExit("active-role-hints.json searchGuidance is incomplete")

for pointer_key in ["latestCheckpoint", "latestTaskPacket", "latestHandoff", "latestDispatchManifest", "latestReconcile"]:
    pointer_value = active.get(pointer_key)
    if pointer_value and not Path(pointer_value).exists():
        raise SystemExit(f"active-role-hints.json points to a missing file: {pointer_key} -> {pointer_value}")

checkpoint = json.loads(Path(".agent/state/checkpoints/latest.json").read_text(encoding="utf-8"))
if checkpoint.get("artifactType") != "shrey-junior/checkpoint":
    raise SystemExit("latest checkpoint has the wrong artifactType")
if checkpoint.get("schemaVersion") != 1:
    raise SystemExit("latest checkpoint must declare schemaVersion 1")
for key in ["createdAt", "phase", "activeRole", "authoritySource", "summary", "nextRecommendedAction", "nextSuggestedCommand"]:
    if not checkpoint.get(key):
        raise SystemExit(f"latest checkpoint must include {key}")
if not isinstance(checkpoint.get("taskContext"), dict):
    raise SystemExit("latest checkpoint must include taskContext")
if not isinstance(checkpoint.get("dirtyState"), dict):
    raise SystemExit("latest checkpoint must include dirtyState")
if active.get("latestCheckpoint") and active.get("latestCheckpoint") != ".agent/state/checkpoints/latest.json":
    raise SystemExit("active-role-hints.json latestCheckpoint must point to .agent/state/checkpoints/latest.json")

checkpoint_markdown = Path(".agent/state/checkpoints/latest.md")
if not checkpoint_markdown.exists():
    raise SystemExit("latest checkpoint markdown missing")
if "# Checkpoint" not in checkpoint_markdown.read_text(encoding="utf-8"):
    raise SystemExit("latest checkpoint markdown must include a heading")

for pointer_path in required_pointer_paths:
    path = Path(pointer_path)
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        if "artifactType" in payload and not payload["artifactType"]:
            raise SystemExit(f"{pointer_path} must include artifactType when present")
        if pointer_path.endswith(".json") and "updatedAt" not in payload and "createdAt" not in payload:
            raise SystemExit(f"{pointer_path} must include createdAt or updatedAt when present")

project_yaml = Path(".agent/project.yaml").read_text(encoding="utf-8")
if 'project_type: generic' in project_yaml or 'project_type: "generic"' in project_yaml:
    if Path(".github/instructions/backend.instructions.md").exists():
        raise SystemExit("generic repos should not carry backend.instructions.md by default")
    if Path(".github/instructions/frontend.instructions.md").exists():
        raise SystemExit("generic repos should not carry frontend.instructions.md by default")

reconcile_path = Path(".agent/state/reconcile/latest.json")
if reconcile_path.exists():
    reconcile = json.loads(reconcile_path.read_text(encoding="utf-8"))
    if reconcile.get("status") != "ready-for-next-phase":
        raise SystemExit(f"latest reconcile is not ready-for-next-phase: {reconcile.get('status')}")
PY

echo "portable push gate: artifact-backed checks passed"

if command -v shrey-junior >/dev/null 2>&1; then
  echo "portable push gate: running shrey-junior check"
  shrey-junior check --target "$REPO_ROOT"
  echo "portable push gate: running shrey-junior push-check"
  shrey-junior push-check --target "$REPO_ROOT"
else
  echo "portable push gate: shrey-junior CLI unavailable, relying on repo-local artifact checks"
fi

mapfile -t repo_specific_commands < <(python3 - <<'PY'
from pathlib import Path

checks_path = Path(".agent/checks.yaml")
repo_specific_commands = []
if checks_path.exists():
    in_commands = False
    for raw_line in checks_path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        if stripped.startswith("repo_specific_commands:"):
            in_commands = True
            continue
        if in_commands:
            if raw_line.startswith("  - "):
                repo_specific_commands.append(stripped[2:].strip())
                continue
            if not raw_line.startswith("  "):
                break

for command in repo_specific_commands:
    if command:
        print(command)
PY
)

for command in "${repo_specific_commands[@]}"; do
  if [[ -z "$command" ]]; then
    continue
  fi
  echo "running repo-specific check: $command"
  bash -lc "$command"
done

echo "portable repo contract verification passed"
