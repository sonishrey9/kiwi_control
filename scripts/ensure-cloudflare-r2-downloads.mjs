#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_DOWNLOADS_URL = "https://downloads.kiwi-control.kiwi-ai.in";
const DEFAULT_BUCKET = "kiwi-control-downloads";
const DEFAULT_ZONE_NAME = "kiwi-ai.in";
const DEFAULT_MIN_TLS = "1.2";

const args = parseArgs(process.argv.slice(2));
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const downloadsUrl = stripTrailingSlash(args.downloadsUrl ?? process.env.DOWNLOADS_URL ?? "");
const bucketName = args.bucket ?? process.env.CLOUDFLARE_R2_BUCKET ?? DEFAULT_BUCKET;
const outputPath = args.output ?? null;
const zoneName = args.zoneName ?? DEFAULT_ZONE_NAME;
const expectedDownloadsUrl = args.expectedDownloadsUrl ?? DEFAULT_DOWNLOADS_URL;
const downloadsHost = new URL(downloadsUrl).hostname;

if (!downloadsUrl) {
  throw new Error("Missing DOWNLOADS_URL. Pass --downloads-url or set DOWNLOADS_URL.");
}
if (stripTrailingSlash(downloadsUrl) !== stripTrailingSlash(expectedDownloadsUrl)) {
  throw new Error(`DOWNLOADS_URL must be ${expectedDownloadsUrl}, received ${downloadsUrl}.`);
}

const client = createClient({ accountId, apiToken });

const zone = await requireZone(client, zoneName);
const bucket = await ensureBucket(client, accountId, bucketName);
const customDomain = await ensureCustomDomain({
  client,
  accountId,
  bucketName,
  zoneId: zone.id,
  downloadsHost
});

const payload = {
  ok: true,
  accountId,
  bucketCreated: bucket.created,
  bucketName: bucket.name,
  customDomainAttached: customDomain.attached,
  customDomainEnabled: customDomain.enabled,
  domainStatus: customDomain.result?.status ?? customDomain.updated?.status ?? customDomain.current?.status ?? null,
  zoneId: zone.id,
  zoneName,
  downloadsUrl,
  downloadsHost
};

if (outputPath) {
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--downloads-url") {
      parsed.downloadsUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--bucket") {
      parsed.bucket = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--zone-name") {
      parsed.zoneName = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--expected-downloads-url") {
      parsed.expectedDownloadsUrl = argv[index + 1];
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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function stripTrailingDot(value) {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function createClient({ accountId, apiToken }) {
  return async function request(method, pathname, body) {
    const response = await fetch(`${CLOUDFLARE_API_BASE}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
      const errorDetail = Array.isArray(payload?.errors) && payload.errors.length > 0
        ? payload.errors.map((item) => `${item.code ?? "unknown"}: ${item.message}`).join("; ")
        : JSON.stringify(payload);
      throw new Error(`Cloudflare API ${method} ${pathname} failed: ${errorDetail}`);
    }

    return payload?.result ?? null;
  };
}

async function requireZone(client, zoneName) {
  const zones = await client("GET", `/zones?name=${encodeURIComponent(zoneName)}&status=active`);
  const zone = Array.isArray(zones) ? zones.find((entry) => stripTrailingDot(entry.name) === zoneName) : null;
  if (!zone?.id) {
    throw new Error(`Cloudflare does not know zone ${zoneName} in this account. Add the zone first or use Cloudflare partial setup for ${zoneName}.`);
  }
  return zone;
}

async function ensureBucket(client, accountId, bucketName) {
  const existing = await findBucket(client, accountId, bucketName);
  if (existing) {
    return {
      created: false,
      name: existing.name
    };
  }

  const created = await client("POST", `/accounts/${accountId}/r2/buckets`, {
    name: bucketName
  });

  return {
    created: true,
    name: created?.name ?? bucketName
  };
}

async function findBucket(client, accountId, bucketName) {
  const payload = await client("GET", `/accounts/${accountId}/r2/buckets?name_contains=${encodeURIComponent(bucketName)}&per_page=1000`);
  const buckets = payload?.buckets ?? [];
  return buckets.find((entry) => entry.name === bucketName) ?? null;
}

async function ensureCustomDomain({ client, accountId, bucketName, zoneId, downloadsHost }) {
  const domains = await client("GET", `/accounts/${accountId}/r2/buckets/${bucketName}/domains/custom`);
  const current = domains?.domains?.find((entry) => stripTrailingDot(entry.domain) === downloadsHost) ?? null;

  if (!current) {
    const result = await client("POST", `/accounts/${accountId}/r2/buckets/${bucketName}/domains/custom`, {
      domain: downloadsHost,
      enabled: true,
      minTLS: DEFAULT_MIN_TLS,
      zoneId
    });
    return {
      attached: true,
      enabled: true,
      result
    };
  }

  const needsEnable = current.enabled !== true || current.minTLS !== DEFAULT_MIN_TLS;
  if (!needsEnable) {
    return {
      attached: false,
      enabled: false,
      current
    };
  }

  const updated = await client("PUT", `/accounts/${accountId}/r2/buckets/${bucketName}/domains/custom/${encodeURIComponent(downloadsHost)}`, {
    enabled: true,
    minTLS: DEFAULT_MIN_TLS
  });

  return {
    attached: false,
    enabled: true,
    current,
    updated
  };
}
