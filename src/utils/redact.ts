const SENSITIVE_PATTERNS = [
  /\.env/i,
  /secret/i,
  /token/i,
  /password/i,
  /(^|[\\/])[^\\/]*key[^\\/]*$/i,
  /\.pem$/i,
  /ssh/i,
  /aws/i,
  /render/i,
  /credential/i,
  /workspaceStorage/i,
  /session/i,
  /chat/i
];

const METADATA_ONLY_PATTERNS = [
  /settings\.json$/i,
  /settings\.local\.json$/i,
  /launch\.json$/i,
  /mcp-servers\.json$/i,
  /hooks\.json$/i
];

export function normalizePathForMatch(input: string): string {
  return input.replace(/\\/g, "/");
}

export function isSensitivePath(input: string): boolean {
  const normalized = normalizePathForMatch(input);
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isMetadataOnlyPath(input: string): boolean {
  const normalized = normalizePathForMatch(input);
  return METADATA_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function redactText(input: string): string {
  return input
    .replace(/\b(AKIA[0-9A-Z]{16})\b/g, "[REDACTED_AWS_KEY]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_API_KEY]")
    .replace(
      /\b(secret|token|password|api[_-]?key)\b\s*[:=]\s*["']?[^"'\n]+["']?/gi,
      (_match, key: string) => `${key}: [REDACTED]`
    );
}

export function summarizeObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

