# Kiwi Control Public Site

This folder is the static public-beta web surface for Kiwi Control.

Recommended deployment:

- host on **Cloudflare Pages**
- keep **Route 53** authoritative for `kiwi-ai.in`
- publish the site hostname as an external **CNAME** to the Cloudflare Pages subdomain
- point public installers, checksums, and the release manifest to a production **Cloudflare R2 custom domain**
- keep **GitHub Releases** for release notes and release history

Recommended Pages project root:

- `website/`

Recommended public routes:

- `/`
  - product landing page
- `/downloads/`
  - human-friendly latest download page backed by `/data/latest-release.json`
- `/install/`
  - install guide and release-channel explanation
- `/beta/`
  - current beta limitations and trust posture

This site is intentionally static and lightweight for the public beta. Use `node scripts/stage-pages-site.mjs` to create the deployable Pages directory with a same-origin `data/latest-release.json` file.
