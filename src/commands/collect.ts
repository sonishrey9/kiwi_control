import { loadLatestDispatchCollection, loadLatestDispatchManifest, collectDispatchOutputs, writeDispatchCollection } from "../core/dispatch.js";
import type { Logger } from "../core/logger.js";
import { renderDisplayPath } from "../utils/fs.js";

export interface CollectOptions {
  targetRoot: string;
  logger: Logger;
}

export async function runCollect(options: CollectOptions): Promise<number> {
  const manifest = await loadLatestDispatchManifest(options.targetRoot);
  if (!manifest) {
    throw new Error("no dispatch manifest found in target repo");
  }

  const previousCollection = await loadLatestDispatchCollection(options.targetRoot, manifest.dispatchId);
  const collection = await collectDispatchOutputs(options.targetRoot, manifest);
  const paths = await writeDispatchCollection(options.targetRoot, manifest, collection);

  const lines = [
    `dispatch: ${manifest.dispatchId}`,
    `overall status: ${collection.overallStatus}`,
    `analysis basis: ${collection.parsingBasis}`,
    `completed roles: ${collection.completedRoles.join(", ") || "none"}`,
    `missing roles: ${collection.missingRoles.join(", ") || "none"}`,
    `heuristic fallback roles: ${collection.fallbackRoles.join(", ") || "none"}`,
    `malformed roles: ${collection.malformedRoles.join(", ") || "none"}`,
    `partial structured roles: ${collection.partialRoles.length > 0 ? collection.partialRoles.map((item) => `${item.role}(${item.missingFields.join(",")})`).join("; ") : "none"}`,
    ...collection.roleResults
      .filter((result) => result.parsingWarnings.length > 0)
      .map((result) => `- ${result.role} parse notes: ${result.parsingWarnings.join("; ")}`),
    `collection latest: ${renderDisplayPath(options.targetRoot, paths.latestPath)}`,
    `collection history: ${renderDisplayPath(options.targetRoot, paths.historyPath)}`,
    previousCollection ? "previous collection state replaced with latest snapshot" : "first collection snapshot recorded"
  ];
  options.logger.info(lines.join("\n"));
  return collection.overallStatus === "blocked" ? 1 : 0;
}
