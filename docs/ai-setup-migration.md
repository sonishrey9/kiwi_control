# ai-setup Migration Note

Kiwi Control now absorbs most of the practical workflow value that `ai-setup` used to provide, but it does it through Kiwi-native command, runtime, and desktop surfaces instead of a single shell-only initializer.

## Kiwi now subsumes

- machine setup detection and verification through `kc setup status` and `kc setup verify`
- machine repair and install entry points through `kc setup repair` and `kc setup install`
- one-shot setup orchestration through `kc setup --profile ...`
- repo contract init or sync through Kiwi bootstrap flows
- runtime-backed repo graph refresh
- repo hygiene for supported setup artifacts
- desktop onboarding entry points for setup

## Kiwi still delegates to existing write engines

- `scripts/install-global.sh`
- `scripts/apply-global-preferences.sh`
- `scripts/sj-init.sh`

These are still the canonical writers for global CLI and machine-global preference surfaces in this pass.

## Kiwi still depends on external binaries when they are present

- `lean-ctx`
- `repomix`

Kiwi wraps and verifies them. Kiwi does not claim to install those binaries itself yet.

## ai-setup after this pass

- If local `ai-setup` is present, Kiwi detects it and reports it as a compatibility helper.
- Kiwi no longer needs `ai-setup` as the primary fix path for normal supported setup flows.
- `ai-setup` is not runtime authority and is not required for repo execution truth.

## Intentionally still separate

- machine setup remains machine-global
- repo runtime truth remains repo-local and runtime-backed
- blocked packs remain blocked unless real integrations are added
- installer packaging polish for DMG / Windows installer remains a separate release track
