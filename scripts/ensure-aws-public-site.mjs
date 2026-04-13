#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { ensureTrailingDot, runAws, runAwsJson, stripHostedZoneId, stripTrailingDot } from "./aws-public-common.mjs";

const args = parseArgs(process.argv.slice(2));
const siteUrl = new URL(requiredValue(args.siteUrl ?? process.env.SITE_URL, "SITE_URL"));
const siteHost = stripTrailingDot(siteUrl.hostname);
const bucketName = firstNonEmpty(args.bucket, process.env.AWS_PUBLIC_BUCKET, siteHost);
const awsRegion = firstNonEmpty(args.region, process.env.AWS_REGION, "ap-south-1");
const priceClass = firstNonEmpty(args.priceClass, "PriceClass_100");
const outputPath = args.output ?? null;

const zoneName = args.zoneName ?? siteHost.split(".").slice(1).join(".");
const hostedZoneId = stripHostedZoneId(
  process.env.ROUTE53_HOSTED_ZONE_ID || discoverHostedZoneId(zoneName)
);

await ensureBucket(bucketName, awsRegion);
await ensureBucketPublicRead(bucketName);
const certificate = await ensureCertificate(siteHost, hostedZoneId);
const distribution = await ensureDistribution({
  siteHost,
  bucketName,
  awsRegion,
  certificateArn: certificate.certificateArn,
  priceClass
});
const route53 = await upsertAliasRecord({
  hostedZoneId,
  siteHost,
  distributionDomain: distribution.domainName
});

const payload = {
  ok: true,
  siteUrl: siteUrl.toString(),
  siteHost,
  bucket: {
    name: bucketName,
    region: awsRegion
  },
  certificate,
  distribution,
  route53
};

if (outputPath) {
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--site-url") {
      parsed.siteUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--bucket") {
      parsed.bucket = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--region") {
      parsed.region = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--zone-name") {
      parsed.zoneName = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--price-class") {
      parsed.priceClass = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function requiredValue(value, name) {
  if (!value) {
    throw new Error(`Missing required value: ${name}`);
  }
  return value;
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" ? value.length > 0 : value != null);
}

function discoverHostedZoneId(zoneName) {
  const payload = runAwsJson([
    "route53",
    "list-hosted-zones-by-name",
    "--dns-name",
    zoneName,
    "--max-items",
    "10"
  ]);

  const exactMatch = payload.HostedZones?.find((zone) => stripTrailingDot(zone.Name) === zoneName && zone.Config?.PrivateZone !== true);
  if (!exactMatch?.Id) {
    throw new Error(`Unable to auto-discover a public hosted zone for ${zoneName}. Set ROUTE53_HOSTED_ZONE_ID.`);
  }

  return exactMatch.Id;
}

async function ensureBucket(bucketName, awsRegion) {
  const head = runAws([
    "s3api",
    "head-bucket",
    "--bucket",
    bucketName
  ], {
    allowFailure: true
  });

  if ((head.status ?? 1) === 0) {
    return;
  }

  const args = [
    "s3api",
    "create-bucket",
    "--bucket",
    bucketName,
    "--region",
    awsRegion
  ];
  if (awsRegion !== "us-east-1") {
    args.push(
      "--create-bucket-configuration",
      JSON.stringify({ LocationConstraint: awsRegion })
    );
  }

  runAws(args);
}

async function ensureBucketPublicRead(bucketName) {
  runAws([
    "s3api",
    "put-public-access-block",
    "--bucket",
    bucketName,
    "--public-access-block-configuration",
    JSON.stringify({
      BlockPublicAcls: false,
      IgnorePublicAcls: false,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false
    })
  ]);

  runAws([
    "s3api",
    "put-bucket-policy",
    "--bucket",
    bucketName,
    "--policy",
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${bucketName}/*`
        }
      ]
    })
  ]);
}

async function ensureCertificate(siteHost, hostedZoneId) {
  const certificateArn = findCertificateArn(siteHost) ?? requestCertificate(siteHost);
  await upsertCertificateValidationRecords(certificateArn, hostedZoneId);
  await waitForCertificate(certificateArn);
  const described = describeCertificate(certificateArn);

  return {
    certificateArn,
    status: described.Certificate?.Status ?? "UNKNOWN",
    region: "us-east-1",
    domainName: described.Certificate?.DomainName ?? siteHost
  };
}

function findCertificateArn(siteHost) {
  const payload = runAwsJson([
    "acm",
    "list-certificates",
    "--region",
    "us-east-1",
    "--certificate-statuses",
    "ISSUED",
    "PENDING_VALIDATION"
  ]);

  for (const summary of payload.CertificateSummaryList ?? []) {
    if (summary.DomainName === siteHost || (summary.SubjectAlternativeNameSummaries ?? []).includes(siteHost)) {
      return summary.CertificateArn;
    }
  }

  return null;
}

function requestCertificate(siteHost) {
  const payload = runAwsJson([
    "acm",
    "request-certificate",
    "--region",
    "us-east-1",
    "--domain-name",
    siteHost,
    "--validation-method",
    "DNS",
    "--idempotency-token",
    siteHost.replace(/[^a-z0-9]/gi, "").slice(0, 32)
  ]);

  if (!payload.CertificateArn) {
    throw new Error(`Failed to request certificate for ${siteHost}.`);
  }

  return payload.CertificateArn;
}

function describeCertificate(certificateArn) {
  return runAwsJson([
    "acm",
    "describe-certificate",
    "--region",
    "us-east-1",
    "--certificate-arn",
    certificateArn
  ]);
}

async function upsertCertificateValidationRecords(certificateArn, hostedZoneId) {
  const described = describeCertificate(certificateArn);
  const changes = [];
  for (const option of described.Certificate?.DomainValidationOptions ?? []) {
    const record = option.ResourceRecord;
    if (!record?.Name || !record?.Value || !record?.Type) {
      continue;
    }
    changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: ensureTrailingDot(stripTrailingDot(record.Name)),
        Type: record.Type,
        TTL: 300,
        ResourceRecords: [{ Value: ensureTrailingDot(stripTrailingDot(record.Value)) }]
      }
    });
  }

  if (changes.length === 0) {
    return;
  }

  runAws([
    "route53",
    "change-resource-record-sets",
    "--hosted-zone-id",
    hostedZoneId,
    "--change-batch",
    JSON.stringify({
      Comment: `Certificate validation for ${certificateArn}`,
      Changes: changes
    })
  ]);
}

async function waitForCertificate(certificateArn) {
  runAws([
    "acm",
    "wait",
    "certificate-validated",
    "--region",
    "us-east-1",
    "--certificate-arn",
    certificateArn
  ]);
}

async function ensureDistribution({ siteHost, bucketName, awsRegion, certificateArn, priceClass }) {
  const existing = findDistribution(siteHost);
  if (existing) {
    return {
      id: existing.Id,
      domainName: stripTrailingDot(existing.DomainName),
      status: existing.Status
    };
  }

  const originId = `${bucketName}-origin`;
  const config = {
    CallerReference: `${siteHost}-${Date.now()}`,
    Aliases: {
      Quantity: 1,
      Items: [siteHost]
    },
    DefaultRootObject: "index.html",
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: originId,
          DomainName: `${bucketName}.s3.${awsRegion}.amazonaws.com`,
          OriginPath: "",
          CustomHeaders: { Quantity: 0 },
          S3OriginConfig: {
            OriginAccessIdentity: ""
          },
          ConnectionAttempts: 3,
          ConnectionTimeout: 10,
          OriginShield: { Enabled: false }
        }
      ]
    },
    OriginGroups: { Quantity: 0 },
    DefaultCacheBehavior: {
      TargetOriginId: originId,
      ViewerProtocolPolicy: "redirect-to-https",
      TrustedSigners: { Enabled: false, Quantity: 0 },
      TrustedKeyGroups: { Enabled: false, Quantity: 0 },
      AllowedMethods: {
        Quantity: 2,
        Items: ["HEAD", "GET"],
        CachedMethods: {
          Quantity: 2,
          Items: ["HEAD", "GET"]
        }
      },
      SmoothStreaming: false,
      Compress: true,
      LambdaFunctionAssociations: { Quantity: 0 },
      FunctionAssociations: { Quantity: 0 },
      FieldLevelEncryptionId: "",
      CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
      GrpcConfig: { Enabled: false }
    },
    CacheBehaviors: { Quantity: 0 },
    CustomErrorResponses: { Quantity: 0 },
    Comment: "Kiwi Control public site",
    PriceClass: priceClass,
    Enabled: true,
    ViewerCertificate: {
      ACMCertificateArn: certificateArn,
      SSLSupportMethod: "sni-only",
      MinimumProtocolVersion: "TLSv1.2_2021",
      Certificate: certificateArn,
      CertificateSource: "acm"
    },
    Restrictions: {
      GeoRestriction: {
        RestrictionType: "none",
        Quantity: 0
      }
    },
    WebACLId: "",
    HttpVersion: "http2",
    IsIPV6Enabled: true,
    Staging: false
  };

  const created = runAwsJson([
    "cloudfront",
    "create-distribution",
    "--distribution-config",
    JSON.stringify(config)
  ]);

  const distribution = created.Distribution;
  runAws([
    "cloudfront",
    "wait",
    "distribution-deployed",
    "--id",
    distribution.Id
  ]);

  return {
    id: distribution.Id,
    domainName: stripTrailingDot(distribution.DomainName),
    status: distribution.Status
  };
}

function findDistribution(siteHost) {
  const payload = runAwsJson([
    "cloudfront",
    "list-distributions"
  ]);

  return payload.DistributionList?.Items?.find((distribution) =>
    (distribution.Aliases?.Items ?? []).includes(siteHost)
  ) ?? null;
}

async function upsertAliasRecord({ hostedZoneId, siteHost, distributionDomain }) {
  const result = runAwsJson([
    "route53",
    "change-resource-record-sets",
    "--hosted-zone-id",
    hostedZoneId,
    "--change-batch",
    JSON.stringify({
      Comment: `Alias ${siteHost} to ${distributionDomain}`,
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: ensureTrailingDot(siteHost),
            Type: "CNAME",
            TTL: 300,
            ResourceRecords: [{ Value: ensureTrailingDot(distributionDomain) }]
          }
        }
      ]
    })
  ]);

  return {
    hostedZoneId,
    recordName: siteHost,
    distributionDomain,
    route53ChangeId: stripHostedZoneId(result.ChangeInfo?.Id ?? ""),
    route53Status: result.ChangeInfo?.Status ?? null
  };
}
