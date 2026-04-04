import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists } from "../utils/fs.js";

export interface CcusageSessionUsage {
  sessionId: string;
  cwd: string;
  startedAt: string;
  lastActivity: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  models: string[];
  isFallbackModel: boolean;
  sourceFile: string;
}

interface RawUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}

const CODEX_HOME_ENV = "CODEX_HOME";
const DEFAULT_CODEX_HOME = path.join(os.homedir(), ".codex");
const DEFAULT_SESSION_DIR = path.join(DEFAULT_CODEX_HOME, "sessions");
const DEFAULT_ARCHIVED_DIR = path.join(DEFAULT_CODEX_HOME, "archived_sessions");
const MAX_SESSION_FILES = 400;
const LEGACY_FALLBACK_MODEL = "gpt-5";

function ensureNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeRawUsage(value: unknown): RawUsage | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const input = ensureNumber(record.input_tokens);
  const cached = ensureNumber(record.cached_input_tokens ?? record.cache_read_input_tokens);
  const output = ensureNumber(record.output_tokens);
  const reasoning = ensureNumber(record.reasoning_output_tokens);
  const total = ensureNumber(record.total_tokens);

  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: total > 0 ? total : input + output
  };
}

function subtractRawUsage(current: RawUsage, previous: RawUsage | null): RawUsage {
  return {
    input_tokens: Math.max(current.input_tokens - (previous?.input_tokens ?? 0), 0),
    cached_input_tokens: Math.max(current.cached_input_tokens - (previous?.cached_input_tokens ?? 0), 0),
    output_tokens: Math.max(current.output_tokens - (previous?.output_tokens ?? 0), 0),
    reasoning_output_tokens: Math.max(current.reasoning_output_tokens - (previous?.reasoning_output_tokens ?? 0), 0),
    total_tokens: Math.max(current.total_tokens - (previous?.total_tokens ?? 0), 0)
  };
}

function convertToDelta(raw: RawUsage) {
  const total = raw.total_tokens > 0 ? raw.total_tokens : raw.input_tokens + raw.output_tokens;
  const cached = Math.min(raw.cached_input_tokens, raw.input_tokens);
  return {
    inputTokens: raw.input_tokens,
    cachedInputTokens: cached,
    outputTokens: raw.output_tokens,
    reasoningOutputTokens: raw.reasoning_output_tokens,
    totalTokens: total
  };
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractModel(value: unknown): string | undefined {
  if (value == null || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directCandidates = [record.model, record.model_name];
  for (const candidate of directCandidates) {
    const model = asNonEmptyString(candidate);
    if (model) {
      return model;
    }
  }

  const info = record.info;
  if (info && typeof info === "object") {
    const infoRecord = info as Record<string, unknown>;
    for (const candidate of [infoRecord.model, infoRecord.model_name]) {
      const model = asNonEmptyString(candidate);
      if (model) {
        return model;
      }
    }
    const metadata = infoRecord.metadata;
    if (metadata && typeof metadata === "object") {
      const model = asNonEmptyString((metadata as Record<string, unknown>).model);
      if (model) {
        return model;
      }
    }
  }

  const metadata = record.metadata;
  if (metadata && typeof metadata === "object") {
    const model = asNonEmptyString((metadata as Record<string, unknown>).model);
    if (model) {
      return model;
    }
  }

  return undefined;
}

function isRepoMatch(targetRoot: string, cwd: string): boolean {
  const normalizedTarget = path.resolve(targetRoot);
  const normalizedCwd = path.resolve(cwd);
  const targetToCwd = path.relative(normalizedTarget, normalizedCwd);
  const cwdToTarget = path.relative(normalizedCwd, normalizedTarget);
  return (
    targetToCwd === "" ||
    cwdToTarget === "" ||
    (!targetToCwd.startsWith("..") && !path.isAbsolute(targetToCwd)) ||
    (!cwdToTarget.startsWith("..") && !path.isAbsolute(cwdToTarget))
  );
}

async function collectJsonlFiles(root: string, files: string[] = []): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (files.length >= MAX_SESSION_FILES) {
      break;
    }

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await collectJsonlFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }

  return files;
}

function getCodexSourceDirs(): string[] {
  const codexHome = process.env[CODEX_HOME_ENV]?.trim()
    ? path.resolve(process.env[CODEX_HOME_ENV] as string)
    : DEFAULT_CODEX_HOME;

  const extraDirs = (process.env.KIWI_CCUSAGE_SESSION_DIRS ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));

  return [...new Set([
    path.join(codexHome, "sessions"),
    path.join(codexHome, "archived_sessions"),
    ...extraDirs
  ])];
}

export async function loadCcusageCompatibleSessionUsage(targetRoot: string): Promise<CcusageSessionUsage[]> {
  const sourceDirs = getCodexSourceDirs();
  const sessionFiles: string[] = [];

  for (const directory of sourceDirs) {
    if (!(await pathExists(directory))) {
      continue;
    }

    if (directory.endsWith("archived_sessions")) {
      const archivedEntries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const entry of archivedEntries) {
        if (sessionFiles.length >= MAX_SESSION_FILES) {
          break;
        }
        if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          sessionFiles.push(path.join(directory, entry.name));
        }
      }
      continue;
    }

    await collectJsonlFiles(directory, sessionFiles);
  }

  const sessions: CcusageSessionUsage[] = [];

  for (const sessionFile of sessionFiles.slice(0, MAX_SESSION_FILES)) {
    const usage = await parseSessionFile(sessionFile, targetRoot);
    if (usage) {
      sessions.push(usage);
    }
  }

  return sessions.sort((left, right) => right.lastActivity.localeCompare(left.lastActivity));
}

async function parseSessionFile(sessionFile: string, targetRoot: string): Promise<CcusageSessionUsage | null> {
  let contents: string;
  try {
    contents = await fs.readFile(sessionFile, "utf8");
  } catch {
    return null;
  }

  const sessionId = deriveSessionId(sessionFile);
  const lines = contents.split(/\r?\n/);
  let cwd: string | null = null;
  let startedAt: string | null = null;
  let lastActivity: string | null = null;
  let previousTotals: RawUsage | null = null;
  const models = new Set<string>();
  let currentModel: string | undefined;
  let currentFallbackModel = false;
  let total = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (parsed == null || typeof parsed !== "object") {
      continue;
    }

    const record = parsed as Record<string, unknown>;
    const type = asNonEmptyString(record.type);
    const timestamp = asNonEmptyString(record.timestamp);
    if (timestamp) {
      lastActivity = timestamp;
      startedAt = startedAt ?? timestamp;
    }

    if (type === "session_meta") {
      const payload = record.payload;
      if (payload && typeof payload === "object") {
        const payloadRecord = payload as Record<string, unknown>;
        cwd = asNonEmptyString(payloadRecord.cwd) ?? cwd;
      }
      continue;
    }

    if (type === "turn_context") {
      const model = extractModel(record.payload);
      if (model) {
        currentModel = model;
        currentFallbackModel = false;
        models.add(model);
      }
      continue;
    }

    if (type !== "event_msg") {
      continue;
    }

    const payload = record.payload;
    if (payload == null || typeof payload !== "object") {
      continue;
    }

    const payloadRecord = payload as Record<string, unknown>;
    if (asNonEmptyString(payloadRecord.type) !== "token_count") {
      continue;
    }

    const info = payloadRecord.info;
    const infoRecord = info && typeof info === "object" ? info as Record<string, unknown> : undefined;
    const lastUsage = normalizeRawUsage(infoRecord?.last_token_usage);
    const totalUsage = normalizeRawUsage(infoRecord?.total_token_usage);

    let raw = lastUsage;
    if (raw == null && totalUsage != null) {
      raw = subtractRawUsage(totalUsage, previousTotals);
    }

    if (totalUsage != null) {
      previousTotals = totalUsage;
    }

    if (raw == null) {
      continue;
    }

    const extractedModel = extractModel({ ...payloadRecord, info: infoRecord });
    if (extractedModel) {
      currentModel = extractedModel;
      currentFallbackModel = false;
      models.add(extractedModel);
    } else if (!currentModel) {
      currentModel = LEGACY_FALLBACK_MODEL;
      currentFallbackModel = true;
      models.add(currentModel);
    }

    const delta = convertToDelta(raw);
    if (
      delta.inputTokens === 0 &&
      delta.cachedInputTokens === 0 &&
      delta.outputTokens === 0 &&
      delta.reasoningOutputTokens === 0
    ) {
      continue;
    }

    total = {
      inputTokens: total.inputTokens + delta.inputTokens,
      cachedInputTokens: total.cachedInputTokens + delta.cachedInputTokens,
      outputTokens: total.outputTokens + delta.outputTokens,
      reasoningOutputTokens: total.reasoningOutputTokens + delta.reasoningOutputTokens,
      totalTokens: total.totalTokens + delta.totalTokens
    };
  }

  if (!cwd || !isRepoMatch(targetRoot, cwd) || total.totalTokens <= 0 || !startedAt || !lastActivity) {
    return null;
  }

  return {
    sessionId,
    cwd,
    startedAt,
    lastActivity,
    inputTokens: total.inputTokens,
    cachedInputTokens: total.cachedInputTokens,
    outputTokens: total.outputTokens,
    reasoningOutputTokens: total.reasoningOutputTokens,
    totalTokens: total.totalTokens,
    models: [...models],
    isFallbackModel: currentFallbackModel,
    sourceFile: sessionFile
  };
}

function deriveSessionId(sessionFile: string): string {
  const codexHome = process.env[CODEX_HOME_ENV]?.trim()
    ? path.resolve(process.env[CODEX_HOME_ENV] as string)
    : DEFAULT_CODEX_HOME;
  const sessionsRoot = path.join(codexHome, "sessions");
  if (sessionFile.startsWith(sessionsRoot)) {
    return path.relative(sessionsRoot, sessionFile).replace(/\\/g, "/").replace(/\.jsonl$/i, "");
  }
  return path.basename(sessionFile, ".jsonl");
}
