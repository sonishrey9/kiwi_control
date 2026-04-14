import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./load-local-env.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CLOUDFRONT_ZONE_ID = "Z2FDTNDATAQYW2";
export const DEFAULT_AWS_REGION = "ap-south-1";

loadLocalEnv();

export function buildAwsEnv(overrides = {}) {
  const env = {
    ...process.env,
    ...overrides
  };

  if (env.AWS_PROFILE) {
    delete env.AWS_ACCESS_KEY_ID;
    delete env.AWS_SECRET_ACCESS_KEY;
    delete env.AWS_SESSION_TOKEN;
    delete env.AWS_SECRET;
  }

  if (!env.AWS_SECRET_ACCESS_KEY && env.AWS_SECRET) {
    env.AWS_SECRET_ACCESS_KEY = env.AWS_SECRET;
  }
  if (!env.AWS_DEFAULT_REGION && env.AWS_REGION) {
    env.AWS_DEFAULT_REGION = env.AWS_REGION;
  }
  if (!env.AWS_REGION) {
    env.AWS_REGION = env.AWS_DEFAULT_REGION ?? DEFAULT_AWS_REGION;
  }
  if (!env.AWS_DEFAULT_REGION) {
    env.AWS_DEFAULT_REGION = env.AWS_REGION ?? DEFAULT_AWS_REGION;
  }

  return env;
}

export function runAws(args, options = {}) {
  const result = spawnSync("aws", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: buildAwsEnv(options.env),
    input: options.input ?? undefined
  });

  if (!options.allowFailure && (result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `aws ${args.join(" ")} failed`);
  }

  return result;
}

export function runAwsJson(args, options = {}) {
  const command = [...args];
  if (!command.includes("--output")) {
    command.push("--output", "json");
  }
  const result = runAws(command, options);
  return JSON.parse(result.stdout);
}

export function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function stripTrailingDot(value) {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

export function ensureTrailingDot(value) {
  return value.endsWith(".") ? value : `${value}.`;
}

export function stripHostedZoneId(value) {
  return value.replace(/^\/hostedzone\//, "").replace(/^\/change\//, "");
}

export function joinUrl(baseUrl, pathname) {
  return `${stripTrailingSlash(baseUrl)}/${pathname.replace(/^\/+/, "")}`;
}

export function inferContentType(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (fileName.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (fileName.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (fileName.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (fileName.endsWith(".txt")) {
    return "text/plain; charset=utf-8";
  }
  if (fileName.endsWith(".sh")) {
    return "text/x-shellscript; charset=utf-8";
  }
  if (fileName.endsWith(".ps1")) {
    return "text/plain; charset=utf-8";
  }
  if (fileName.endsWith(".rb")) {
    return "text/x-ruby; charset=utf-8";
  }
  if (fileName.endsWith(".xml")) {
    return "application/xml; charset=utf-8";
  }
  if (fileName.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (fileName.endsWith(".png")) {
    return "image/png";
  }
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (fileName.endsWith(".ico")) {
    return "image/x-icon";
  }
  if (fileName.endsWith(".dmg")) {
    return "application/x-apple-diskimage";
  }
  if (fileName.endsWith(".msi")) {
    return "application/x-msi";
  }
  if (fileName.endsWith(".exe")) {
    return "application/vnd.microsoft.portable-executable";
  }
  if (fileName.endsWith(".zip")) {
    return "application/zip";
  }
  if (fileName.endsWith(".tar.gz")) {
    return "application/gzip";
  }
  return "application/octet-stream";
}

export function latestCacheControl() {
  return "public, max-age=300";
}

export function immutableCacheControl() {
  return "public, max-age=31536000, immutable";
}

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function headOrGet(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      return {
        url,
        ok: true,
        status: head.status,
        method: "HEAD",
        error: null
      };
    }
  } catch {
    // Fall through to GET.
  }

  try {
    const get = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0"
      }
    });
    return {
      url,
      ok: get.ok,
      status: get.status,
      method: "GET",
      error: null
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      method: "GET",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
