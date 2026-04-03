# Signing Notes

Desktop and updater signing are not active by default in this repo.

Before publishing trusted desktop bundles, configure:

- Tauri updater signing keys
- Apple signing identity and notarization flow
- Windows code signing certificate
- Linux packaging/signing policy for the chosen distribution format

Do not claim signed-release trust until those secrets and workflows are actually wired.
