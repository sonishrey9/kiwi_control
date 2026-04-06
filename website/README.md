# Kiwi Control Public Site

This folder is the static public-beta web surface for Kiwi Control.

Recommended deployment:

- host on **Cloudflare Pages**
- keep **Route 53** as the domain registrar only
- delegate authoritative DNS to **Cloudflare**
- point downloads to **GitHub Releases**

Recommended Pages project root:

- `website/`

Recommended public routes:

- `/`
  - product landing page
- `/install/`
  - install guide and release-channel explanation
- `/beta/`
  - current beta limitations and trust posture

This site is intentionally static and lightweight for the public beta.
