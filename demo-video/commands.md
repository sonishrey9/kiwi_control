# Recording Commands

## Preflight

```bash
cd "/Volumes/shrey ssd/my ssd-playground/test-B"
pwd
ls -la
git status --short
claude --version
claude -p "Reply with exactly CLAUDE_READY for a demo-video check."
```

## Kiwi Control Surfaces

```bash
kc status --json --target "$PWD"
kc guide --json --target "$PWD"
kc graph status --json --target "$PWD"
kc graph build --json --target "$PWD"
kc graph status --json --target "$PWD"
kc pack status --json --target "$PWD"
kc review --json --target "$PWD"
```

## Optional Kiwi UI

```bash
kc ui --target "$PWD"
```

If desktop foregrounding is unreliable, use the browser proof page and the saved JSON outputs instead of forcing the UI shot.

## Claude Code Evidence

```bash
cat ab-output/task-prompt.md
cat ab-output/logs/20-claude-run-b.json | head -40
cat ab-output/metrics.json
```

## App Verification

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 4174
```

Open:

```text
http://127.0.0.1:4174/
```

## Proof Page

```bash
open https://kiwi-control.kiwi-ai.in/proof/
open https://kiwi-control.kiwi-ai.in/downloads/
```

## Raw Evidence

```bash
cat "/Volumes/shrey ssd/my ssd-playground/test-A/ab-output/comparison-table.md"
cat "/Volumes/shrey ssd/my ssd-playground/test-B/ab-output/kc/13-summary.txt"
```
