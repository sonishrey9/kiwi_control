import path from "node:path";
import { auditEnvironment, renderDiscoveryMarkdown } from "@shrey-junior/sj-core/core/discovery.js";
import { writeText } from "@shrey-junior/sj-core/utils/fs.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface AuditOptions {
  repoRoot: string;
  targetRoot: string;
  reportPath?: string;
  logger: Logger;
}

export async function runAudit(options: AuditOptions): Promise<number> {
  const report = await auditEnvironment(options.targetRoot);
  const reportPath = options.reportPath ?? path.join(options.targetRoot, "docs", "shrey-junior-discovery-report.md");
  await writeText(reportPath, renderDiscoveryMarkdown(report));
  options.logger.info(`wrote sanitized discovery report to ${reportPath}`);
  return 0;
}
