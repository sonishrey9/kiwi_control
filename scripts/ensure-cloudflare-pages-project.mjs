import { writeFile } from "node:fs/promises";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_PRODUCTION_BRANCH = "main";

const args = parseArgs(process.argv.slice(2));
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const projectName = requiredEnv("CLOUDFLARE_PAGES_PROJECT_NAME");
const siteUrl = new URL(requiredEnv("SITE_URL"));
const customDomainName = args.domain ?? siteUrl.hostname;
const outputPath = args.output ?? null;

const client = createClient({ accountId, apiToken });

let created = false;
let updatedProductionBranch = false;

let project = await getProject(client, projectName);
if (!project) {
  project = await client("POST", `/accounts/${accountId}/pages/projects`, {
    name: projectName,
    production_branch: DEFAULT_PRODUCTION_BRANCH
  });
  created = true;
}

if (project.production_branch !== DEFAULT_PRODUCTION_BRANCH) {
  await client("PATCH", `/accounts/${accountId}/pages/projects/${projectName}`, {
    production_branch: DEFAULT_PRODUCTION_BRANCH
  });
  project = await requireProject(client, projectName);
  updatedProductionBranch = true;
}

const pagesSubdomain = derivePagesSubdomain(project, projectName);
let customDomain = await getDomain(client, projectName, customDomainName);

if (!customDomain) {
  customDomain = await client("POST", `/accounts/${accountId}/pages/projects/${projectName}/domains`, {
    name: customDomainName
  });
}

if (customDomain.validation_data?.method === "http") {
  throw new Error(
    `Cloudflare returned HTTP validation for ${customDomainName}, which cannot be completed through Route 53 DNS automation alone.`
  );
}

const payload = {
  ok: true,
  created,
  updatedProductionBranch,
  project: {
    name: project.name,
    subdomain: pagesSubdomain,
    productionBranch: project.production_branch,
    source: project.source ?? null,
    deploymentConfigs: project.deployment_configs ?? null
  },
  customDomain: {
    id: customDomain.id,
    domainId: customDomain.domain_id ?? null,
    name: customDomain.name,
    status: customDomain.status,
    verificationData: customDomain.verification_data ?? null,
    validationData: customDomain.validation_data ?? null
  }
};

if (outputPath) {
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--domain") {
      parsed.domain = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
      continue;
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

    if (response.status === 404) {
      return null;
    }

    const payload = await response.json();
    if (!response.ok || payload.success === false) {
      const errorDetail = Array.isArray(payload.errors) && payload.errors.length > 0
        ? payload.errors.map((item) => `${item.code ?? "unknown"}: ${item.message}`).join("; ")
        : JSON.stringify(payload);
      throw new Error(`Cloudflare API ${method} ${pathname} failed: ${errorDetail}`);
    }

    return payload.result;
  };
}

async function getProject(client, projectName) {
  return client("GET", `/accounts/${accountId}/pages/projects/${projectName}`);
}

async function requireProject(client, projectName) {
  const project = await getProject(client, projectName);
  if (!project) {
    throw new Error(`Cloudflare Pages project ${projectName} was not found after create/update.`);
  }
  return project;
}

async function getDomain(client, projectName, domainName) {
  const domains = await client("GET", `/accounts/${accountId}/pages/projects/${projectName}/domains`);
  return domains?.find((item) => item.name === domainName) ?? null;
}

function derivePagesSubdomain(project, projectName) {
  const subdomain =
    project.subdomain ??
    project.domains?.find((domain) => typeof domain === "string" && domain.endsWith(".pages.dev")) ??
    `${projectName}.pages.dev`;
  return stripTrailingDot(subdomain);
}

function stripTrailingDot(value) {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}
