#!/usr/bin/env node
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  immutableCacheControl,
  inferContentType,
  latestCacheControl,
  repoRoot,
  runAws,
  runAwsJson,
  stripTrailingDot
} from "./aws-public-common.mjs";

const args = parseArgs(process.argv.slice(2));
const siteDir = path.resolve(args.siteDir ?? path.join(repoRoot, "dist", "site"));
const siteUrl = new URL(requiredValue(args.siteUrl ?? process.env.SITE_URL, "SITE_URL"));
const bucket = firstNonEmpty(args.bucket, process.env.AWS_PUBLIC_BUCKET, stripTrailingDot(siteUrl.hostname));
const distributionId = args.distributionId ?? resolveDistributionId(siteUrl.hostname);

const siteEntries = await collectSiteEntries(siteDir);

for (const entry of siteEntries) {
  await putObject({
    bucket,
    key: entry.key,
    filePath: entry.filePath,
    cacheControl: cacheControlForKey(entry.key)
  });
}

const payload = {
  ok: true,
  bucket,
  siteDir: path.relative(repoRoot, siteDir).replace(/\\/g, "/"),
  uploadedKeys: siteEntries.map((entry) => entry.key),
  invalidated: false
};

if (distributionId) {
  runAws([
    "cloudfront",
    "create-invalidation",
    "--distribution-id",
    distributionId,
    "--paths",
    "/*"
  ]);
  payload.invalidated = true;
}

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--site-dir") {
      parsed.siteDir = argv[index + 1];
      index += 1;
      continue;
    }
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
    if (token === "--distribution-id") {
      parsed.distributionId = argv[index + 1];
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

function resolveDistributionId(hostname) {
  const payload = runAwsJson(["cloudfront", "list-distributions"]);
  const distributions = payload.DistributionList?.Items ?? [];
  const match = distributions.find((distribution) => {
    const aliases = distribution.Aliases?.Items ?? [];
    return aliases.includes(hostname);
  });
  return match?.Id ?? null;
}

async function collectSiteEntries(rootDir) {
  const files = await walk(rootDir);
  const entries = [];

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    entries.push({
      key: relativePath,
      filePath
    });

    if (relativePath.endsWith("/index.html")) {
      const routeKey = relativePath.slice(0, -"index.html".length);
      if (routeKey.length > 0) {
        entries.push({
          key: routeKey,
          filePath
        });
      }
    }
  }

  return dedupeEntries(entries);
}

async function walk(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function dedupeEntries(entries) {
  const deduped = new Map();
  for (const entry of entries) {
    deduped.set(entry.key, entry);
  }
  return [...deduped.values()];
}

function cacheControlForKey(key) {
  if (key.startsWith("data/") || key.endsWith(".html") || key.endsWith("/")) {
    return latestCacheControl();
  }
  if (key.startsWith("assets/")) {
    return immutableCacheControl();
  }
  return latestCacheControl();
}

async function putObject({ bucket, key, filePath, cacheControl }) {
  runAws([
    "s3api",
    "put-object",
    "--bucket",
    bucket,
    "--key",
    key,
    "--body",
    filePath,
    "--content-type",
    inferContentType(filePath),
    "--cache-control",
    cacheControl
  ]);
}
