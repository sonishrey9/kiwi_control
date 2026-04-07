# Kiwi Control Public Site

This folder is the static public-beta web surface for Kiwi Control.

Recommended deployment:

- host on **Cloudflare Pages**
- keep **Route 53** authoritative for `kiwi-ai.in`
- publish the site hostname as an external **CNAME** to the Cloudflare Pages subdomain
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
