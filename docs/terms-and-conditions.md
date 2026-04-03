# Kiwi Control Terms & Conditions

Last updated: April 4, 2026

## Product status

Kiwi Control is currently distributed as a public beta.

That means:

- functionality may change between beta releases
- package-manager availability may lag behind GitHub Releases
- signing, notarization, and updater readiness must be described honestly per release

## License and repository terms

Use of the source repository, packaged CLI bundle, and packaged desktop bundle is governed by the license and release terms published with this repository and its release assets.

Do not assume commercial support, managed hosting, or enterprise commitments unless they are explicitly stated in the release materials.

## Acceptable use

You are responsible for how you use Kiwi Control in your own repositories and environments.

You should not use Kiwi Control to:

- bypass repo authority or team policies
- misrepresent unsigned or unpublished artifacts as trusted releases
- perform destructive automation that the product explicitly leaves out of scope

## Local-first control plane limits

Kiwi Control is a repo-backed control surface.

The desktop app is not the source of truth. Repo-local artifacts remain authoritative, and deleting or changing those artifacts affects the product state shown by the CLI and app.

## No hidden service guarantee

Core product usage in this beta is intended to work without a Kiwi-operated cloud backend.

If future hosted or enterprise features are introduced, they will need explicit product, pricing, and legal terms before they should be treated as part of the public contract.

## Warranty and support

Kiwi Control beta releases are provided on an as-available basis unless a release note or separate agreement says otherwise.

If a release is unsigned, unpublished to a package manager, or marked as manual-only, that limitation is part of the current product status and should not be hidden.

## Contact

For beta release questions, use the release/distribution contact listed with the Kiwi Control release materials.
