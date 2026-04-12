# Kiwi Control Public Site

This folder is the static public-beta web surface for Kiwi Control.

Recommended deployment:

- host on **Cloudflare Pages**
- keep **Route 53** authoritative for `kiwi-ai.in`
- publish the site hostname as an external **CNAME** to the Cloudflare Pages subdomain
- keep the public website single-host on `kiwi-control.kiwi-ai.in`
- let `/downloads/` be the public installer entrypoint backed by `/data/latest-release.json`
- keep **GitHub Releases** as the current host for attached release assets, release notes, and release history unless a different binary-hosting path is explicitly published

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

## Local direct deploy

If GitHub Actions is temporarily blocked but the Pages project already exists, deploy the public site directly from local tooling:

```bash
npx --yes wrangler login
npm run build
npm test
bash scripts/smoke-test.sh
npm run site:stage
npm run site:deploy:pages
```

Notes:

- `npm run site:deploy:pages` re-stages `dist/site` before uploading it to the existing `kiwi-control` Pages project.
- If you already have `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` exported locally, the deploy script will also verify the Pages project and custom domain before uploading.
- In a non-interactive shell, Wrangler cannot complete `wrangler login` inline. Export `CLOUDFLARE_API_TOKEN` first in that case.
- This direct deploy path only updates the website. It does not create a GitHub Release and should not flip `publicReleaseReady` unless a real release metadata payload is provided.
