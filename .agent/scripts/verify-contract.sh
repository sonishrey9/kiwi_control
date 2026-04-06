<!-- SHREY-JUNIOR:FILE-START .agent/scripts/verify-contract.sh -->
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(pwd)"

required_files=(
  "AGENTS.md"
  "CLAUDE.md"
  ".github/copilot-instructions.md"
  ".agent/project.yaml"
  ".agent/checks.yaml"
  ".agent/context/commands.md"
  ".agent/context/specialists.md"
  ".agent/context/tool-capabilities.md"
  ".agent/context/mcp-capabilities.md"
  ".agent/context/context-tree.json"
  ".agent/memory/repo-facts.json"
  ".agent/memory/current-focus.json"
  ".agent/memory/open-risks.json"
  ".agent/roles/README.md"
  ".agent/templates/role-result.md"
  ".agent/state/current-phase.json"
  ".agent/state/active-role-hints.json"
  ".agent/state/context-tree.json"
  ".agent/state/checkpoints/latest.json"
  ".agent/state/checkpoints/latest.md"
  ".agent/state/handoff/README.md"
  ".agent/state/dispatch/README.md"
  ".agent/state/reconcile/README.md"
  ".agent/scripts/verify-contract.sh"
  ".github/instructions/backend.instructions.md"
  ".github/instructions/frontend.instructions.md"
  ".github/agents/shrey-junior.md"
  ".github/agents/fullstack-specialist.md"
  ".github/agents/frontend-specialist.md"
  ".github/agents/backend-specialist.md"
  ".github/agents/qa-specialist.md"
  ".github/agents/architecture-specialist.md"
  ".github/agents/review-specialist.md"
  ".agent/roles/fullstack-specialist.md"
  ".agent/roles/frontend-specialist.md"
  ".agent/roles/backend-specialist.md"
  ".agent/roles/qa-specialist.md"
  ".agent/roles/architecture-specialist.md"
  ".agent/roles/review-specialist.md"
  ".github/workflows/shrey-junior-contract.yml"
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
    ".agent/state/handoff/latest.json",
    ".agent/state/dispatch/latest-manifest.json",
    ".agent/state/dispatch/latest-collect.json",
    ".agent/state/reconcile/latest.json",
    ".agent/state/latest-task-packets.json",
]

phase = json.loads(Path(".agent/state/current-phase.json").read_text(encoding="utf-8"))
if phase.get("artifactType") != "shrey-junior/current-phase":
    raise SystemExit("current-phase.json has the wrong artifactType")
if phase.get("status") != "complete":
    raise SystemExit("current-phase.json must describe a completed bootstrap-ready phase for CI")
if not phase.get("validationsRun"):
    raise SystemExit("current-phase.json must record validationsRun before CI can pass")
for key in ["latestMemoryFocus", "nextRecommendedSpecialist", "nextSuggestedMcpPack"]:
    if not phase.get(key):
        raise SystemExit(f"current-phase.json must include {key}")
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
if not active.get("nextRecommendedSpecialist"):
    raise SystemExit("active-role-hints.json must include nextRecommendedSpecialist")
if not active.get("nextSuggestedMcpPack"):
    raise SystemExit("active-role-hints.json must include nextSuggestedMcpPack")
if not active.get("checksToRun"):
    raise SystemExit("active-role-hints.json must include checksToRun")
if not active.get("nextAction"):
    raise SystemExit("active-role-hints.json must include nextAction")
search_guidance = active.get("searchGuidance")
if not isinstance(search_guidance, dict):
    raise SystemExit("active-role-hints.json must include searchGuidance")
if "inspectCodebaseFirst" not in search_guidance or "repoDocsFirst" not in search_guidance:
    raise SystemExit("active-role-hints.json searchGuidance is incomplete")

for pointer_key in ["latestMemoryFocus", "latestCheckpoint", "latestTaskPacket", "latestHandoff", "latestDispatchManifest", "latestReconcile"]:
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
for key in ["latestMemoryFocus", "nextRecommendedSpecialist", "nextSuggestedMcpPack"]:
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

repo_facts = json.loads(Path(".agent/memory/repo-facts.json").read_text(encoding="utf-8"))
if repo_facts.get("artifactType") != "shrey-junior/repo-facts":
    raise SystemExit("repo-facts.json has the wrong artifactType")
current_focus = json.loads(Path(".agent/memory/current-focus.json").read_text(encoding="utf-8"))
if current_focus.get("artifactType") != "shrey-junior/current-focus":
    raise SystemExit("current-focus.json has the wrong artifactType")
for key in ["currentFocus", "focusOwnerRole", "nextRecommendedSpecialist", "nextSuggestedMcpPack", "nextFileToRead", "nextSuggestedCommand"]:
    if not current_focus.get(key):
        raise SystemExit(f"current-focus.json must include {key}")
open_risks = json.loads(Path(".agent/memory/open-risks.json").read_text(encoding="utf-8"))
if open_risks.get("artifactType") != "shrey-junior/open-risks":
    raise SystemExit("open-risks.json has the wrong artifactType")
if not isinstance(open_risks.get("risks"), list):
    raise SystemExit("open-risks.json must include a risks array")

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

if command -v kiwi-control >/dev/null 2>&1; then
  echo "portable push gate: running kiwi-control check"
  kiwi-control check --target "$REPO_ROOT"
  echo "portable push gate: running kiwi-control push-check"
  kiwi-control push-check --target "$REPO_ROOT"
elif command -v shrey-junior >/dev/null 2>&1; then
  echo "portable push gate: kiwi-control unavailable, using shrey-junior compatibility alias for check"
  shrey-junior check --target "$REPO_ROOT"
  echo "portable push gate: kiwi-control unavailable, using shrey-junior compatibility alias for push-check"
  shrey-junior push-check --target "$REPO_ROOT"
else
  echo "portable push gate: Kiwi Control CLI unavailable, relying on repo-local artifact checks"
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
<!-- SHREY-JUNIOR:FILE-END .agent/scripts/verify-contract.sh -->
