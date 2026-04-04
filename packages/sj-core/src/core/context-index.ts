import path from "node:path";
import { pathExists, readJson, readText, writeText } from "../utils/fs.js";

type IndexedDiscoveredFile = {
  file: string;
  mtime: number;
};

type ImportableExtension =
  | ".ts"
  | ".tsx"
  | ".js"
  | ".jsx"
  | ".mjs"
  | ".cjs"
  | ".py";

const IMPORTABLE_EXTENSIONS = new Set<ImportableExtension>([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py"
]);

export interface ContextIndexFileRecord {
  file: string;
  mtime: number;
  imports: string[];
}

export interface ContextImpactAnalysis {
  changedFiles: string[];
  forwardDependencies: string[];
  reverseDependencies: string[];
  impactedFiles: string[];
}

export interface ContextIndexState {
  artifactType: "kiwi-control/context-index";
  version: 1;
  timestamp: string;
  indexedFiles: number;
  updatedFiles: string[];
  removedFiles: string[];
  reusedFiles: number;
  files: ContextIndexFileRecord[];
  reverseDependencies: Record<string, string[]>;
  lastChangedFiles: string[];
  lastImpact: ContextImpactAnalysis;
}

export interface BuildContextIndexOptions {
  targetRoot: string;
  discoveredFiles: IndexedDiscoveredFile[];
  changedFiles: string[];
}

function contextIndexPath(targetRoot: string): string {
  return path.join(targetRoot, ".agent", "state", "context-index.json");
}

export async function loadContextIndex(targetRoot: string): Promise<ContextIndexState | null> {
  const outputPath = contextIndexPath(targetRoot);
  if (!(await pathExists(outputPath))) {
    return null;
  }

  try {
    const state = await readJson<ContextIndexState>(outputPath);
    if (state.artifactType !== "kiwi-control/context-index" || state.version !== 1) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export async function buildContextIndex(options: BuildContextIndexOptions): Promise<ContextIndexState> {
  const existing = await loadContextIndex(options.targetRoot);
  const existingRecords = new Map(
    (existing?.files ?? []).map((entry) => [entry.file, entry] as const)
  );

  const importableFiles = options.discoveredFiles
    .filter((entry) => isImportableFile(entry.file))
    .sort((left, right) => left.file.localeCompare(right.file));
  const importableSet = new Set(importableFiles.map((entry) => entry.file));
  const changedSet = new Set(options.changedFiles);

  const updatedFiles: string[] = [];
  let reusedFiles = 0;
  const records: ContextIndexFileRecord[] = [];

  for (const entry of importableFiles) {
    const previous = existingRecords.get(entry.file);
    if (previous && previous.mtime === entry.mtime && !changedSet.has(entry.file)) {
      records.push(previous);
      reusedFiles += 1;
      continue;
    }

    const imports = await parseFileImports(options.targetRoot, entry.file);
    records.push({
      file: entry.file,
      mtime: entry.mtime,
      imports
    });
    updatedFiles.push(entry.file);
  }

  const removedFiles = [...existingRecords.keys()]
    .filter((file) => !importableSet.has(file))
    .sort((left, right) => left.localeCompare(right));
  const reverseDependencies = buildReverseDependencyMap(records);
  const lastImpact = analyzeImpact(records, reverseDependencies, options.changedFiles);

  const state: ContextIndexState = {
    artifactType: "kiwi-control/context-index",
    version: 1,
    timestamp: new Date().toISOString(),
    indexedFiles: records.length,
    updatedFiles,
    removedFiles,
    reusedFiles,
    files: records,
    reverseDependencies,
    lastChangedFiles: options.changedFiles,
    lastImpact
  };

  await persistContextIndex(options.targetRoot, state);
  return state;
}

export async function persistContextIndex(
  targetRoot: string,
  state: ContextIndexState
): Promise<string> {
  const outputPath = contextIndexPath(targetRoot);
  await writeText(outputPath, `${JSON.stringify(state, null, 2)}\n`);
  return outputPath;
}

function isImportableFile(filePath: string): boolean {
  return IMPORTABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase() as ImportableExtension);
}

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function uniqueFiles(files: string[]): string[] {
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function buildReverseDependencyMap(files: ContextIndexFileRecord[]): Record<string, string[]> {
  const reverse = new Map<string, Set<string>>();
  const knownFiles = new Set(files.map((entry) => entry.file));

  for (const entry of files) {
    for (const importedFile of entry.imports) {
      if (!knownFiles.has(importedFile)) {
        continue;
      }
      const importers = reverse.get(importedFile) ?? new Set<string>();
      importers.add(entry.file);
      reverse.set(importedFile, importers);
    }
  }

  return Object.fromEntries(
    [...reverse.entries()]
      .map(([file, importers]) => [file, [...importers].sort((left, right) => left.localeCompare(right))] as const)
      .sort((left, right) => left[0].localeCompare(right[0]))
  );
}

function analyzeImpact(
  files: ContextIndexFileRecord[],
  reverseDependencies: Record<string, string[]>,
  changedFiles: string[]
): ContextImpactAnalysis {
  const fileMap = new Map(files.map((entry) => [entry.file, entry] as const));
  const importableChangedFiles = changedFiles.filter((file) => fileMap.has(file));

  const forwardDependencies = uniqueFiles(
    importableChangedFiles.flatMap((file) => fileMap.get(file)?.imports ?? [])
  );
  const reverseDependents = uniqueFiles(
    importableChangedFiles.flatMap((file) => reverseDependencies[file] ?? [])
  );
  const secondHopDependents = uniqueFiles(
    reverseDependents.flatMap((file) => reverseDependencies[file] ?? [])
  );

  const impactedFiles = uniqueFiles(
    [...forwardDependencies, ...reverseDependents, ...secondHopDependents].filter(
      (file) => !importableChangedFiles.includes(file)
    )
  );

  return {
    changedFiles: importableChangedFiles,
    forwardDependencies,
    reverseDependencies: uniqueFiles([...reverseDependents, ...secondHopDependents]),
    impactedFiles
  };
}

async function parseFileImports(targetRoot: string, file: string): Promise<string[]> {
  const ext = path.extname(file).toLowerCase() as ImportableExtension;
  const fullPath = path.join(targetRoot, file);

  let content: string;
  try {
    content = await readText(fullPath);
  } catch {
    return [];
  }

  const imports = extractImports(content, ext);
  const resolvedImports = await Promise.all(
    imports.map((specifier) => resolveImportPath(targetRoot, file, specifier))
  );

  return uniqueFiles(
    resolvedImports.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
  );
}

function extractImports(content: string, ext: ImportableExtension): string[] {
  const imports: string[] = [];

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    const esImports = content.matchAll(/(?:import|export)\s+.*?from\s+["']([^"']+)["']/g);
    for (const match of esImports) {
      if (match[1] && isRelativeImport(match[1])) {
        imports.push(match[1]);
      }
    }

    const requires = content.matchAll(/require\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of requires) {
      if (match[1] && isRelativeImport(match[1])) {
        imports.push(match[1]);
      }
    }

    const dynamicImports = content.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of dynamicImports) {
      if (match[1] && isRelativeImport(match[1])) {
        imports.push(match[1]);
      }
    }
  }

  if (ext === ".py") {
    const fromImports = content.matchAll(/from\s+(\.\S+)\s+import/g);
    for (const match of fromImports) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }

  return imports;
}

async function resolveImportPath(
  targetRoot: string,
  sourceFile: string,
  importSpecifier: string
): Promise<string | null> {
  const sourceDir = path.dirname(sourceFile);
  let resolved = path.normalize(path.join(sourceDir, importSpecifier)).replace(/\.js$/, "");

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".py"];

  for (const extension of extensions) {
    const candidate = `${resolved}${extension}`;
    if (await pathExists(path.join(targetRoot, candidate))) {
      return candidate;
    }
  }

  for (const extension of extensions) {
    const candidate = path.join(resolved, `index${extension}`);
    if (await pathExists(path.join(targetRoot, candidate))) {
      return candidate;
    }
  }

  return null;
}
