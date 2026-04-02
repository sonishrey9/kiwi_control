import { promises as fs } from "node:fs";
import path from "node:path";

export const MANAGED_PREFIX = "SHREY-JUNIOR";

export type WriteStatus = "created" | "updated" | "appended" | "unchanged" | "conflict";

export interface WriteResult {
  path: string;
  status: WriteStatus;
  detail: string;
  addedLines?: number;
  removedLines?: number;
  backupPath?: string;
}

export interface WritePlan extends WriteResult {
  currentContent?: string;
  nextContent?: string;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readText(filePath);
  return JSON.parse(raw) as T;
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function managedBlockStart(name: string): string {
  return `<!-- ${MANAGED_PREFIX}:START ${name} -->`;
}

export function managedBlockEnd(name: string): string {
  return `<!-- ${MANAGED_PREFIX}:END ${name} -->`;
}

export function managedFileStart(name: string): string {
  return formatManagedFileMarker("FILE-START", name);
}

export function managedFileEnd(name: string): string {
  return formatManagedFileMarker("FILE-END", name);
}

export function wrapManagedBlock(name: string, content: string): string {
  return `${managedBlockStart(name)}\n${content.trim()}\n${managedBlockEnd(name)}\n`;
}

export function wrapManagedFile(name: string, content: string): string {
  return `${managedFileStart(name)}\n${content.trim()}\n${managedFileEnd(name)}\n`;
}

function replaceBoundedRegion(existing: string, startMarker: string, endMarker: string, replacement: string): string | null {
  const startIndex = existing.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }

  const endIndex = existing.indexOf(endMarker, startIndex);
  if (endIndex === -1) {
    return null;
  }

  const suffixIndex = endIndex + endMarker.length;
  return `${existing.slice(0, startIndex)}${replacement}${existing.slice(suffixIndex)}`;
}

export async function fileContainsManagedFile(filePath: string, logicalName: string): Promise<boolean> {
  if (!(await pathExists(filePath))) {
    return false;
  }
  const existing = await readText(filePath);
  return existing.includes(managedFileStart(logicalName)) && existing.includes(managedFileEnd(logicalName));
}

export async function upsertManagedFile(filePath: string, logicalName: string, content: string): Promise<WriteResult> {
  const plan = await planManagedFile(filePath, logicalName, content);
  return applyWritePlan(plan);
}

export async function upsertManagedBlock(filePath: string, blockName: string, content: string): Promise<WriteResult> {
  const plan = await planManagedBlock(filePath, blockName, content);
  return applyWritePlan(plan);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "task";
}

export function relativeFrom(root: string, filePath: string): string {
  return path.relative(root, filePath) || ".";
}

export function renderDisplayPath(root: string, filePath: string): string {
  if (!filePath.trim()) {
    return filePath;
  }
  if (!path.isAbsolute(filePath)) {
    return filePath;
  }
  const relativePath = path.relative(root, filePath);
  if (!relativePath || relativePath === ".") {
    return ".";
  }
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return filePath;
  }
  return relativePath;
}

export function isIgnoredArtifactName(name: string): boolean {
  return name.startsWith("._") || name === ".DS_Store" || name === "Thumbs.db";
}

function formatManagedFileMarker(kind: "FILE-START" | "FILE-END", name: string): string {
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return `# ${MANAGED_PREFIX}:${kind} ${name}`;
  }

  return `<!-- ${MANAGED_PREFIX}:${kind} ${name} -->`;
}

export async function planManagedFile(filePath: string, logicalName: string, content: string): Promise<WritePlan> {
  const wrapped = wrapManagedFile(logicalName, content);
  if (!(await pathExists(filePath))) {
    return {
      path: filePath,
      status: "created",
      detail: "created managed file",
      nextContent: wrapped,
      ...diffLineCounts("", wrapped)
    };
  }

  const existing = await readText(filePath);
  if (existing === wrapped) {
    return { path: filePath, status: "unchanged", detail: "already up to date", currentContent: existing, nextContent: wrapped, addedLines: 0, removedLines: 0 };
  }

  const replaced = replaceBoundedRegion(existing, managedFileStart(logicalName), managedFileEnd(logicalName), wrapped.trimEnd());
  if (replaced === null) {
    return { path: filePath, status: "conflict", detail: "refused to overwrite unmanaged file", currentContent: existing };
  }

  const next = `${replaced.trimEnd()}\n`;
  return {
    path: filePath,
    status: "updated",
    detail: "updated managed file",
    currentContent: existing,
    nextContent: next,
    ...diffLineCounts(existing, next)
  };
}

export async function planCreateOnlyFile(
  filePath: string,
  logicalName: string,
  content: string,
  options?: { managed?: boolean }
): Promise<WritePlan> {
  const wrapped = options?.managed === false ? `${content.trimEnd()}\n` : wrapManagedFile(logicalName, content);
  if (!(await pathExists(filePath))) {
    return {
      path: filePath,
      status: "created",
      detail: "created seed file",
      nextContent: wrapped,
      ...diffLineCounts("", wrapped)
    };
  }

  const existing = await readText(filePath);
  return {
    path: filePath,
    status: "unchanged",
    detail: "preserved existing seed file",
    currentContent: existing,
    nextContent: existing,
    addedLines: 0,
    removedLines: 0
  };
}

export async function planManagedBlock(filePath: string, blockName: string, content: string): Promise<WritePlan> {
  const wrapped = wrapManagedBlock(blockName, content).trimEnd();
  if (!(await pathExists(filePath))) {
    const next = `${wrapped}\n`;
    return {
      path: filePath,
      status: "created",
      detail: "created file with managed block",
      nextContent: next,
      ...diffLineCounts("", next)
    };
  }

  const existing = await readText(filePath);
  const replaced = replaceBoundedRegion(existing, managedBlockStart(blockName), managedBlockEnd(blockName), wrapped);
  if (replaced !== null) {
    const next = `${replaced.trimEnd()}\n`;
    return {
      path: filePath,
      status: next === existing ? "unchanged" : "updated",
      detail: next === existing ? "managed block already up to date" : "updated managed block",
      currentContent: existing,
      nextContent: next,
      ...diffLineCounts(existing, next)
    };
  }

  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  const next = `${existing}${separator}${wrapped}\n`;
  return {
    path: filePath,
    status: "appended",
    detail: "appended managed block",
    currentContent: existing,
    nextContent: next,
    ...diffLineCounts(existing, next)
  };
}

export async function applyWritePlan(plan: WritePlan, options?: { backupPath?: string }): Promise<WriteResult> {
  if (options?.backupPath && plan.currentContent !== undefined && plan.status !== "unchanged" && plan.status !== "conflict") {
    await writeText(options.backupPath, plan.currentContent);
  }

  if (plan.nextContent !== undefined && plan.status !== "unchanged" && plan.status !== "conflict") {
    await writeText(plan.path, plan.nextContent);
  }

  return {
    path: plan.path,
    status: plan.status,
    detail: plan.detail,
    ...(plan.addedLines !== undefined ? { addedLines: plan.addedLines } : {}),
    ...(plan.removedLines !== undefined ? { removedLines: plan.removedLines } : {}),
    ...(options?.backupPath ? { backupPath: options.backupPath } : {})
  };
}

export function diffLineCounts(before: string, after: string): { addedLines: number; removedLines: number } {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let prefix = 0;
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1;
  }

  let beforeSuffix = beforeLines.length - 1;
  let afterSuffix = afterLines.length - 1;
  while (beforeSuffix >= prefix && afterSuffix >= prefix && beforeLines[beforeSuffix] === afterLines[afterSuffix]) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }

  return {
    addedLines: Math.max(afterSuffix - prefix + 1, 0),
    removedLines: Math.max(beforeSuffix - prefix + 1, 0)
  };
}

export function hasConsistentManagedMarkers(content: string): boolean {
  const starts = (content.match(/SHREY-JUNIOR:(?:START|FILE-START)/g) ?? []).length;
  const ends = (content.match(/SHREY-JUNIOR:(?:END|FILE-END)/g) ?? []).length;
  return starts === ends;
}
