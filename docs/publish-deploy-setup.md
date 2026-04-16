# Publish And Deploy Setup

This document is the source of truth for Kiwi Control's publish and deploy setup after the GitHub Actions hardening pass.

## Architecture

Kiwi Control now separates publish responsibilities into four lanes:

- `ci.yml`
  - secret-free validation only
  - build, test, smoke, and optional cross-platform verification
- `pages-site.yml`
  - secret-free staged site deployment to GitHub Pages
  - useful for docs/site review and a GitHub-native public mirror
- `release.yml`
  - package release artifacts
  - publish release/download artifacts to the production AWS host through OIDC
  - publish the production website after release metadata is live
- `bootstrap-production-aws.yml`
  - manual infrastructure bootstrap and repair for the AWS production host
  - separated from routine publishing on purpose

Production remains on `https://kiwi-control.kiwi-ai.in`. GitHub Pages is a safe static deployment surface, not the default production domain.

## Secret Model

What no longer needs long-lived AWS secrets:

- `deploy-site.yml`
- `release.yml` production publish jobs
- `bootstrap-production-aws.yml`

What still may require secrets:

- Apple signing and notarization material for signed macOS desktop releases
- Windows signing certificate material for signed Windows installers

Those signing inputs are still separate from AWS publish auth and should remain narrowly scoped.

## GitHub Settings

Configure these GitHub settings manually:

1. Enable GitHub Pages with source set to `GitHub Actions`.
2. Keep or create the `production` environment.
3. Use the built-in `github-pages` environment for `pages-site.yml`.
4. Optionally add protection rules to the `production` environment so only trusted branches/tags can publish.

Recommended `production` environment variables:

- `AWS_REGION`
  - example: `ap-south-1`
- `AWS_PUBLIC_BUCKET`
  - current production bucket: `kiwi-control.kiwi-ai.in`
- `AWS_CLOUDFRONT_DISTRIBUTION_ID`
  - the production CloudFront distribution id for `kiwi-control.kiwi-ai.in`
- `AWS_OIDC_ROLE_ARN`
  - routine publish role for site + downloads
- `AWS_INFRA_OIDC_ROLE_ARN`
  - bootstrap-only role for `ensure-aws-public-site.mjs`
- `SITE_URL`
  - current production site: `https://kiwi-control.kiwi-ai.in`
- `DOWNLOADS_URL`
  - current production downloads base: `https://kiwi-control.kiwi-ai.in`
- `REPO_URL`
  - `https://github.com/sonishrey9/kiwi-control`
- `ROUTE53_HOSTED_ZONE_ID`
  - optional, only needed when you want bootstrap automation to skip hosted zone discovery

## Workflow Permissions

Current workflow intent:

- `ci.yml`
  - `contents: read`
- `pages-site.yml`
  - `contents: read`
  - `pages: write`
  - `id-token: write`
- `deploy-site.yml`
  - `contents: read`
  - `id-token: write`
- `release.yml`
  - default `contents: read`
  - release upload job overrides to `contents: write` and `id-token: write`
- `bootstrap-production-aws.yml`
  - `contents: read`
  - `id-token: write`

## AWS OIDC Setup

Create or reuse the GitHub Actions OIDC provider in AWS:

- provider url: `https://token.actions.githubusercontent.com`
- audience: `sts.amazonaws.com`

Official references:

- [GitHub OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers)
- [AWS IAM OIDC role setup](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)

### Routine Publish Role

Use this role for:

- `deploy-site.yml`
- `release.yml` jobs `publish-release-assets` and `publish-production-site`

Trust policy example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:sonishrey9/kiwi-control:environment:production"
        }
      }
    }
  ]
}
```

Recommended permission scope for the routine publish role:

- S3 object upload only for the production bucket
  - `s3:PutObject`
  - resource: `arn:aws:s3:::kiwi-control.kiwi-ai.in/*`
- CloudFront invalidation only for the production distribution
  - `cloudfront:CreateInvalidation`
  - resource: the specific distribution

If you omit `AWS_CLOUDFRONT_DISTRIBUTION_ID` and rely on alias discovery, you must also allow CloudFront read/list permissions. The safer default is to set the distribution id explicitly and avoid list permissions.

### Bootstrap Role

Use this role only for:

- `bootstrap-production-aws.yml`

Trust policy can use the same repository/environment restriction as the routine publish role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:sonishrey9/kiwi-control:environment:production"
        }
      }
    }
  ]
}
```

Recommended permission scope for the bootstrap role:

- S3 bootstrap:
  - `s3:CreateBucket`
  - `s3:HeadBucket`
  - `s3:PutBucketPolicy`
  - `s3:PutPublicAccessBlock`
- ACM:
  - `acm:ListCertificates`
  - `acm:RequestCertificate`
  - `acm:DescribeCertificate`
- CloudFront:
  - `cloudfront:ListDistributions`
  - `cloudfront:CreateDistribution`
  - `cloudfront:GetDistribution`
  - `cloudfront:CreateInvalidation`
- Route 53:
  - `route53:ListHostedZonesByName`
  - `route53:ChangeResourceRecordSets`
  - `route53:GetChange`

This role is intentionally broader than the routine publish role and should stay manual-only.

## DNS And Domain Assumptions

Current production assumptions:

- production site url: `https://kiwi-control.kiwi-ai.in`
- production downloads metadata: `https://kiwi-control.kiwi-ai.in/latest/downloads.json`
- production release metadata mirrored into the site: `/data/latest-release.json`
- Route 53 remains authoritative for `kiwi-ai.in`
- production web traffic is expected to terminate through CloudFront in front of S3

GitHub Pages should be treated as:

- a static mirror or review surface
- not the default production host unless you intentionally migrate DNS and accept the hosting trade-offs

## Manual Setup Checklist

GitHub:

1. In `Settings -> Pages`, set source to `GitHub Actions`.
2. Create or review the `production` environment.
3. Add the environment variables listed above to `production`.
4. Add any required signing secrets separately if signed desktop releases are needed.
5. Optionally require approvals for the `production` environment.

AWS:

1. Create the GitHub Actions OIDC provider if it does not already exist.
2. Create the routine publish role and set its ARN as `AWS_OIDC_ROLE_ARN`.
3. Create the bootstrap role and set its ARN as `AWS_INFRA_OIDC_ROLE_ARN`.
4. Set `AWS_PUBLIC_BUCKET` to the real production bucket.
5. Set `AWS_CLOUDFRONT_DISTRIBUTION_ID` to the real production distribution id.
6. Set `ROUTE53_HOSTED_ZONE_ID` if you want bootstrap to avoid hosted-zone discovery.

Operational use:

1. Run `bootstrap-production-aws.yml` only when you need to create or repair AWS hosting infrastructure.
2. Run `release.yml` for tagged release packaging and production artifact publish.
3. Run `deploy-site.yml` for production site-only updates that should mirror existing downloads metadata.
4. Let `pages-site.yml` keep the GitHub Pages site updated without cloud secrets.
