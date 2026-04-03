export interface ProductMetadata {
  displayName: string;
  repoCompatibilityName: string;
  cli: {
    primaryCommand: string;
    shortCommand: string;
    compatibilityCommands: string[];
    sourceLauncher: string;
    sourceDesktopLauncher: string;
  };
  desktop: {
    appName: string;
    windowTitle: string;
    bundleIdentifier: string;
  };
  release: {
    artifactPrefix: string;
    homebrewFormula: string;
    wingetIdentifier: string;
    updaterManifestPath: string;
  };
  compatibility: {
    schemaPrefix: string;
    globalHomeEnvVars: string[];
    pathBinEnvVars: string[];
    cliEnvVars: string[];
    desktopEnvVars: string[];
    productRootEnvVars: string[];
    globalHomeDefault: string;
    pathBinDefault: string;
    legacyDesktopBridgeEnv: string;
  };
}

export const PRODUCT_METADATA: ProductMetadata = {
  displayName: "Kiwi Control",
  repoCompatibilityName: "Shrey Junior",
  cli: {
    primaryCommand: "kiwi-control",
    shortCommand: "kc",
    compatibilityCommands: ["shrey-junior", "sj"],
    sourceLauncher: "npm run cli --",
    sourceDesktopLauncher: "npm run ui:dev"
  },
  desktop: {
    appName: "Kiwi Control",
    windowTitle: "Kiwi Control",
    bundleIdentifier: "com.kiwicontrol.desktop"
  },
  release: {
    artifactPrefix: "kiwi-control",
    homebrewFormula: "KiwiControl",
    wingetIdentifier: "KiwiControl.KiwiControl",
    updaterManifestPath: "apps/sj-ui/src-tauri/updater.json"
  },
  compatibility: {
    schemaPrefix: "shrey-junior",
    globalHomeEnvVars: ["KIWI_CONTROL_HOME", "SHREY_JUNIOR_HOME"],
    pathBinEnvVars: ["KIWI_CONTROL_PATH_BIN", "SHREY_JUNIOR_PATH_BIN"],
    cliEnvVars: ["KIWI_CONTROL_BIN", "SHREY_JUNIOR_BIN", "KIWI_CONTROL_CLI", "SHREY_JUNIOR_CLI"],
    desktopEnvVars: ["KIWI_CONTROL_DESKTOP", "SHREY_JUNIOR_DESKTOP"],
    productRootEnvVars: ["KIWI_CONTROL_PRODUCT_ROOT", "SHREY_JUNIOR_PRODUCT_ROOT"],
    globalHomeDefault: "~/.kiwi-control",
    pathBinDefault: "~/.local/bin",
    legacyDesktopBridgeEnv: "SHREY_JUNIOR_CLI"
  }
};

export function listCliCommandAliases(): string[] {
  return [
    PRODUCT_METADATA.cli.primaryCommand,
    PRODUCT_METADATA.cli.shortCommand,
    ...PRODUCT_METADATA.cli.compatibilityCommands
  ];
}

export function renderCliAliasSummary(): string {
  return listCliCommandAliases().join(" | ");
}
