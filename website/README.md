# Kiwi Control Public Site

This folder is the static public-beta web surface for Kiwi Control.

Recommended deployment:

- use **GitHub Pages** for the staged static-site deployment surface
- keep **AWS S3 + CloudFront** as the production host for `kiwi-control.kiwi-ai.in`
- keep **Route 53** authoritative for `kiwi-ai.in`
- publish the site hostname as a **CNAME** to the CloudFront distribution
- keep the public website single-host on `kiwi-control.kiwi-ai.in`
- let `/downloads/` be the public installer entrypoint backed by `/data/latest-release.json`
- use `https://kiwi-control.kiwi-ai.in/latest/downloads.json` as the public machine-readable source of truth for published assets
- only surface release notes or source links when those URLs are actually public and reachable

Recommended production AWS layout:

- one S3 bucket for the public site and release objects
- one CloudFront distribution for HTTPS on `kiwi-control.kiwi-ai.in`

Recommended public routes:

- `/`
  - product landing page
- `/downloads/`
  - human-friendly latest download page backed by `/data/latest-release.json`
- `/commands/`
  - exact first-run commands, command reference, and troubleshooting
- `/architecture/`
  - public explanation of the repo-first architecture, CLI/core/UI split, FAQ, and contact paths
- `/install/`
  - install guide and release-channel explanation
- `/beta/`
  - current beta limitations and trust posture

This site is intentionally static and lightweight for the public beta. Use `node scripts/stage-pages-site.mjs` to create the deployable directory with a same-origin `data/latest-release.json` file mirrored from the public downloads metadata or an explicit `downloads.json`.

GitHub Pages is now the preferred secret-free site deploy target for the staged static site. Production website and release artifact hosting remain on AWS.

## Local direct deploy

If GitHub Actions is temporarily blocked but the AWS resources already exist, deploy the public site directly from local tooling:

```bash
npm run build
npm test
bash scripts/smoke-test.sh
node scripts/ensure-aws-public-site.mjs --site-url "https://kiwi-control.kiwi-ai.in/"
SITE_URL=https://kiwi-control.kiwi-ai.in npm run site:stage -- --downloads-url "https://kiwi-control.kiwi-ai.in" --require-downloads-json
npm run site:publish:aws -- --site-dir dist/site --site-url "https://kiwi-control.kiwi-ai.in"
```

Notes:

- `node scripts/ensure-aws-public-site.mjs` provisions or reuses the bucket, ACM certificate, CloudFront distribution, and Route 53 record.
- `npm run site:publish:aws` uploads only the staged site objects; release artifacts and `latest/downloads.json` are published separately.
- Use `SITE_URL=https://kiwi-control.kiwi-ai.in` as the public metadata base when staging or verifying the site.
- This direct deploy path must not flip `publicReleaseReady` unless the real public host already says the release is ready.
