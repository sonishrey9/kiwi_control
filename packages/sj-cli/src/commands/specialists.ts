import { loadCanonicalConfig } from "@shrey-junior/sj-core/core/config.js";
import { resolveMcpPackCatalog } from "@shrey-junior/sj-core/core/mcp-pack-selection.js";
import { listSpecialists } from "@shrey-junior/sj-core/core/specialists.js";
import type { Logger } from "@shrey-junior/sj-core/core/logger.js";

export interface SpecialistsOptions {
  repoRoot: string;
  profileName?: string;
  json?: boolean;
  logger: Logger;
}

export async function runSpecialists(options: SpecialistsOptions): Promise<number> {
  const config = await loadCanonicalConfig(options.repoRoot);
  const specialists = listSpecialists({
    config,
    ...(options.profileName ? { profileName: options.profileName } : {})
  });
  const mcpPacks = resolveMcpPackCatalog({
    config,
    profileName: options.profileName ?? config.global.defaults.default_profile
  });

  if (options.json) {
    options.logger.info(
      JSON.stringify(
        {
          profileName: options.profileName ?? config.global.defaults.default_profile,
          specialists,
          mcpPacks
        },
        null,
        2
      )
    );
    return 0;
  }

  const lines = [
    `profile: ${options.profileName ?? config.global.defaults.default_profile}`,
    "specialists:",
    ...specialists.map(
      (specialist) =>
        `- ${specialist.specialistId}: ${specialist.purpose} | tools=${specialist.preferredTools.join(", ")}${
          specialist.aliases.length ? ` | aliases=${specialist.aliases.join(", ")}` : ""
        }`
    ),
    "mcp packs:",
    ...mcpPacks.map((pack) => `- ${pack.id}: ${pack.description}`)
  ];

  options.logger.info(lines.join("\n"));
  return 0;
}
