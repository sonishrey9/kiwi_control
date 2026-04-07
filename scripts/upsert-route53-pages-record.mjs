import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const DEFAULT_TTL = 300;

const args = parseArgs(process.argv.slice(2));
const siteUrl = new URL(requiredEnv("SITE_URL"));
const cloudflarePayload = args.cloudflareJson ? JSON.parse(await readFile(args.cloudflareJson, "utf8")) : null;
const recordName = stripTrailingDot(siteUrl.hostname);
const zoneName = stripTrailingDot(args.zoneName ?? recordName.split(".").slice(1).join("."));
const ttl = Number(args.ttl ?? DEFAULT_TTL);
const outputPath = args.output ?? null;

if (!zoneName) {
  throw new Error(`Unable to derive Route 53 zone name from SITE_URL=${siteUrl.toString()}`);
}

const cnameTarget = stripTrailingDot(args.cnameTarget ?? cloudflarePayload?.project?.subdomain ?? "");
if (!cnameTarget) {
  throw new Error("Missing Pages CNAME target. Pass --cname-target or provide --cloudflare-json.");
}

const domainValidationRecords = normalizeDomainValidationRecords(
  cloudflarePayload?.customDomain?.validationData ?? null,
  cloudflarePayload?.customDomain?.verificationData ?? null
);

const hostedZoneId = stripHostedZoneId(
  process.env.ROUTE53_HOSTED_ZONE_ID || (await discoverHostedZoneId(zoneName))
);

const changes = [
  buildCnameChange({
    name: recordName,
    target: cnameTarget,
    ttl
  })
];

if (domainValidationRecords.txtName && domainValidationRecords.txtValue) {
  changes.push(
    buildTxtChange({
      name: stripTrailingDot(domainValidationRecords.txtName),
      value: domainValidationRecords.txtValue,
      ttl
    })
  );
}

const changeBatch = {
  Comment: `Route 53 UPSERT for ${recordName} -> ${cnameTarget}`,
  Changes: changes
};

const changeResult = runAwsJson([
  "route53",
  "change-resource-record-sets",
  "--hosted-zone-id",
  hostedZoneId,
  "--change-batch",
  JSON.stringify(changeBatch)
]);

const payload = {
  ok: true,
  hostedZoneId,
  zoneName,
  recordName,
  cnameTarget,
  ttl,
  changes: changes.map((entry) => entry.ResourceRecordSet),
  route53ChangeId: stripHostedZoneId(changeResult.ChangeInfo?.Id ?? ""),
  route53Status: changeResult.ChangeInfo?.Status ?? null
};

if (outputPath) {
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--cname-target") {
      parsed.cnameTarget = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--cloudflare-json") {
      parsed.cloudflareJson = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--ttl") {
      parsed.ttl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--zone-name") {
      parsed.zoneName = argv[index + 1];
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

async function discoverHostedZoneId(zoneName) {
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

function buildCnameChange({ name, target, ttl }) {
  return {
    Action: "UPSERT",
    ResourceRecordSet: {
      Name: ensureTrailingDot(name),
      Type: "CNAME",
      TTL: ttl,
      ResourceRecords: [{ Value: ensureTrailingDot(target) }]
    }
  };
}

function buildTxtChange({ name, value, ttl }) {
  return {
    Action: "UPSERT",
    ResourceRecordSet: {
      Name: ensureTrailingDot(name),
      Type: "TXT",
      TTL: ttl,
      ResourceRecords: [{ Value: JSON.stringify(value) }]
    }
  };
}

function runAwsJson(args) {
  const result = spawnSync("aws", [...args, "--output", "json"], {
    encoding: "utf8",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `aws ${args.join(" ")} failed`);
  }

  return JSON.parse(result.stdout);
}

function stripTrailingDot(value) {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function ensureTrailingDot(value) {
  return value.endsWith(".") ? value : `${value}.`;
}

function stripHostedZoneId(value) {
  return value.replace(/^\/hostedzone\//, "").replace(/^\/change\//, "");
}

function normalizeDomainValidationRecords(validationData, verificationData) {
  const merged = validationData ?? verificationData ?? null;
  if (!merged || typeof merged !== "object") {
    return {
      method: null,
      txtName: null,
      txtValue: null
    };
  }

  return {
    method: merged.method ?? merged.validation_method ?? null,
    txtName: merged.txt_name ?? merged.name ?? null,
    txtValue: merged.txt_value ?? merged.value ?? null
  };
}
