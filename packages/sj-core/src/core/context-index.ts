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
  exports: string[];
  localFunctions: string[];
  calledSymbols: string[];
  importCallTargets: string[];
  relationships: string[];
}

export interface ContextImpactAnalysis {
  changedFiles: string[];
  forwardDependencies: string[];
  reverseDependencies: string[];
  impactedFiles: string[];
  dependencyDistances: Record<string, number>;
  dependencyChains: Record<string, string[]>;
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
    const structure = await parseFileStructure(options.targetRoot, entry.file);
    records.push({
      file: entry.file,
      mtime: entry.mtime,
      imports,
      exports: structure.exports,
      localFunctions: structure.localFunctions,
      calledSymbols: structure.calledSymbols,
      importCallTargets: structure.importCallTargets,
      relationships: uniqueFiles([...imports, ...structure.importCallTargets])
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
    for (const relatedFile of entry.relationships) {
      if (!knownFiles.has(relatedFile)) {
        continue;
      }
      const importers = reverse.get(relatedFile) ?? new Set<string>();
      importers.add(entry.file);
      reverse.set(relatedFile, importers);
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
    importableChangedFiles.flatMap((file) => fileMap.get(file)?.relationships ?? [])
  );
  const { reverseDependents, reverseChains, reverseDistances } = walkReverseDependencies(
    importableChangedFiles,
    reverseDependencies
  );
  const { forwardChains, forwardDistances } = walkForwardDependencies(importableChangedFiles, fileMap);
  const impactedFiles = uniqueFiles(
    [...forwardDependencies, ...reverseDependents].filter((file) => !importableChangedFiles.includes(file))
  );
  const dependencyDistances = Object.fromEntries(
    impactedFiles
      .map((file) => [
        file,
        Math.min(
          forwardDistances[file] ?? Number.POSITIVE_INFINITY,
          reverseDistances[file] ?? Number.POSITIVE_INFINITY
        )
      ] as const)
      .filter(([, distance]) => Number.isFinite(distance))
      .sort((left, right) => left[0].localeCompare(right[0]))
  );
  const dependencyChains = Object.fromEntries(
    impactedFiles
      .map((file) => {
        const forward = forwardChains[file];
        const reverse = reverseChains[file];
        const chosen =
          reverse && forward
            ? reverse.length <= forward.length ? reverse : forward
            : reverse ?? forward;
        return [file, chosen] as const;
      })
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      .sort((left, right) => left[0].localeCompare(right[0]))
  );

  return {
    changedFiles: importableChangedFiles,
    forwardDependencies,
    reverseDependencies: reverseDependents,
    impactedFiles,
    dependencyDistances,
    dependencyChains
  };
}

function walkReverseDependencies(
  changedFiles: string[],
  reverseDependencies: Record<string, string[]>
): {
  reverseDependents: string[];
  reverseChains: Record<string, string[]>;
  reverseDistances: Record<string, number>;
} {
  const queue = changedFiles.map((file) => ({ file, chain: [file], distance: 0 }));
  const reverseChains: Record<string, string[]> = {};
  const reverseDistances: Record<string, number> = {};

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const dependent of reverseDependencies[current.file] ?? []) {
      const nextDistance = current.distance + 1;
      if (reverseDistances[dependent] !== undefined && reverseDistances[dependent] <= nextDistance) {
        continue;
      }
      reverseDistances[dependent] = nextDistance;
      reverseChains[dependent] = [...current.chain, dependent];
      queue.push({ file: dependent, chain: reverseChains[dependent] as string[], distance: nextDistance });
    }
  }

  return {
    reverseDependents: uniqueFiles(Object.keys(reverseDistances)),
    reverseChains,
    reverseDistances
  };
}

function walkForwardDependencies(
  changedFiles: string[],
  fileMap: Map<string, ContextIndexFileRecord>
): {
  forwardChains: Record<string, string[]>;
  forwardDistances: Record<string, number>;
} {
  const queue = changedFiles.map((file) => ({ file, chain: [file], distance: 0 }));
  const forwardChains: Record<string, string[]> = {};
  const forwardDistances: Record<string, number> = {};

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const dependency of fileMap.get(current.file)?.relationships ?? []) {
      const nextDistance = current.distance + 1;
      if (forwardDistances[dependency] !== undefined && forwardDistances[dependency] <= nextDistance) {
        continue;
      }
      forwardDistances[dependency] = nextDistance;
      forwardChains[dependency] = [...current.chain, dependency];
      queue.push({ file: dependency, chain: forwardChains[dependency] as string[], distance: nextDistance });
    }
  }

  return { forwardChains, forwardDistances };
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

async function parseFileStructure(
  targetRoot: string,
  file: string
): Promise<{
  exports: string[];
  localFunctions: string[];
  calledSymbols: string[];
  importCallTargets: string[];
}> {
  const ext = path.extname(file).toLowerCase() as ImportableExtension;
  const fullPath = path.join(targetRoot, file);

  let content: string;
  try {
    content = await readText(fullPath);
  } catch {
    return {
      exports: [],
      localFunctions: [],
      calledSymbols: [],
      importCallTargets: []
    };
  }

  const exports = extractExports(content, ext);
  const localFunctions = extractLocalFunctions(content, ext);
  const calledSymbols = extractCalledSymbols(content, ext);
  const importedSymbols = extractImportedSymbols(content, ext);
  const resolvedImportedSymbols = await Promise.all(
    importedSymbols.map(async (entry) => ({
      localName: entry.localName,
      sourceFile: await resolveImportPath(targetRoot, file, entry.sourceFile)
    }))
  );

  const importCallTargets = uniqueFiles(
    resolvedImportedSymbols
      .filter((entry) => entry.sourceFile && calledSymbols.includes(entry.localName))
      .map((entry) => entry.sourceFile as string)
  );

  return {
    exports,
    localFunctions,
    calledSymbols,
    importCallTargets
  };
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

function extractExports(content: string, ext: ImportableExtension): string[] {
  const exports = new Set<string>();

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    for (const match of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
      if (match[1]) exports.add(match[1]);
    }
    for (const match of content.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
      if (match[1]) exports.add(match[1]);
    }
    for (const match of content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g)) {
      const list = match[1];
      if (!list) continue;
      for (const item of list.split(",")) {
        const exported = item.trim().split(/\s+as\s+/i).pop()?.trim();
        if (exported) exports.add(exported);
      }
    }
    for (const match of content.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)) {
      if (match[1]) exports.add(match[1]);
    }
    for (const match of content.matchAll(/module\.exports\s*=\s*\{\s*([^}]+)\s*\}/g)) {
      const list = match[1];
      if (!list) continue;
      for (const item of list.split(",")) {
        const exported = item.trim().split(":")[0]?.trim();
        if (exported) exports.add(exported);
      }
    }
  }

  if (ext === ".py") {
    for (const match of content.matchAll(/^\s*(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
      if (match[1] && !match[0]?.startsWith("    ")) {
        exports.add(match[1]);
      }
    }
  }

  return [...exports].sort((left, right) => left.localeCompare(right));
}

function extractLocalFunctions(content: string, ext: ImportableExtension): string[] {
  const functions = new Set<string>();

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    for (const match of content.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
      if (match[1]) functions.add(match[1]);
    }
    for (const match of content.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g)) {
      if (match[1]) functions.add(match[1]);
    }
  }

  if (ext === ".py") {
    for (const match of content.matchAll(/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
      if (match[1]) functions.add(match[1]);
    }
  }

  return [...functions].sort((left, right) => left.localeCompare(right));
}

function extractCalledSymbols(content: string, ext: ImportableExtension): string[] {
  const called = new Set<string>();
  const ignore = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "return",
    "typeof",
    "new",
    "function",
    "import",
    "require",
    "console",
    "setTimeout",
    "setInterval"
  ]);

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    for (const match of content.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const symbol = match[1];
      if (symbol && !ignore.has(symbol)) {
        called.add(symbol);
      }
    }
    for (const match of content.matchAll(/\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      const symbol = match[1];
      if (symbol) {
        called.add(symbol);
      }
    }
  }

  if (ext === ".py") {
    for (const match of content.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const symbol = match[1];
      if (symbol && !ignore.has(symbol)) {
        called.add(symbol);
      }
    }
  }

  return [...called].sort((left, right) => left.localeCompare(right));
}

function extractImportedSymbols(
  content: string,
  ext: ImportableExtension
): Array<{ localName: string; sourceFile: string }> {
  const imported: Array<{ localName: string; sourceFile: string }> = [];

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    for (const match of content.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
      const names = match[1];
      const source = match[2];
      if (!names || !source || !isRelativeImport(source)) continue;
      for (const item of names.split(",")) {
        const alias = item.trim().split(/\s+as\s+/i).pop()?.trim();
        if (alias) {
          imported.push({ localName: alias, sourceFile: source });
        }
      }
    }
    for (const match of content.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g)) {
      const localName = match[1];
      const source = match[2];
      if (localName && source && isRelativeImport(source)) {
        imported.push({ localName, sourceFile: source });
      }
    }
    for (const match of content.matchAll(/(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g)) {
      const names = match[1];
      const source = match[2];
      if (!names || !source || !isRelativeImport(source)) continue;
      for (const item of names.split(",")) {
        const localName = item.trim().split(":").pop()?.trim();
        if (localName) {
          imported.push({ localName, sourceFile: source });
        }
      }
    }
  }

  if (ext === ".py") {
    for (const match of content.matchAll(/from\s+(\.\S+)\s+import\s+([A-Za-z0-9_,\s]+)/g)) {
      const source = match[1];
      const names = match[2];
      if (!source || !names) continue;
      for (const item of names.split(",")) {
        const localName = item.trim();
        if (localName) {
          imported.push({ localName, sourceFile: source });
        }
      }
    }
  }

  return imported;
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
