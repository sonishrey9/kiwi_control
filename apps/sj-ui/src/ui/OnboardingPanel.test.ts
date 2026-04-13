/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import { buildOnboardingPanelModel } from "./OnboardingPanel.js";

test("onboarding shows choose-repo first and does not offer manual cli setup before the default attempt runs", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/Users/test/.local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: false,
        installedCommandPath: null,
        verificationStatus: "not-run",
        verificationDetail: "Kiwi auto-attempts terminal command setup by default on installed desktop builds and records whether fresh-shell verification succeeds.",
        verificationCommandPath: null,
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "",
    repoMode: "bridge-unavailable"
  });

  assert.ok(model);
  assert.equal(model?.actions.some((action) => action.id === "choose-repo"), true);
  assert.equal(model?.actions.some((action) => action.id === "install-cli"), false);
  assert.match(model?.intro ?? "", /default CLI path is already proven/i);
  assert.equal(model?.actions[0]?.id, "choose-repo");
});

test("onboarding describes successful cli setup without implying trust or optional-later setup", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/usr/local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: true,
        installedCommandPath: "/usr/local/bin/kc",
        verificationStatus: "passed",
        verificationDetail: "Terminal commands are enabled system-wide.",
        verificationCommandPath: "/usr/local/bin/kc",
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "/tmp/repo",
    repoMode: "repo-not-initialized"
  });

  assert.ok(model);
  assert.match(model?.cliStatus ?? "", /Enabled after desktop setup · verified/i);
  assert.doesNotMatch(model?.cliStatus ?? "", /trust/i);
  assert.doesNotMatch(model?.cliStatus ?? "", /optional later/i);
});

test("windows onboarding expects installer-time cli setup and exposes one-click repair when missing", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Program Files/Kiwi Control/resources/desktop/node/node.exe",
        installBinDir: "C:\\ProgramData\\Kiwi Control\\bin",
        installRoot: "C:\\ProgramData\\Kiwi Control",
        installScope: "machine",
        installed: false,
        installedCommandPath: null,
        verificationStatus: "not-run",
        verificationDetail: "Installer-time verification is still pending.",
        verificationCommandPath: null,
        requiresNewTerminal: false
      }
    },
    platform: "windows",
    targetRoot: "/tmp/repo",
    repoMode: "healthy"
  });

  assert.ok(model);
  assert.match(model?.intro ?? "", /real Windows-host proof is still pending/i);
  assert.equal(model?.actions.some((action) => action.id === "install-cli"), true);
  assert.match(model?.actions.find((action) => action.id === "install-cli")?.label ?? "", /Enable terminal commands now/i);
});

test("onboarding shows init action for an uninitialized repo", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/Users/test/.local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: true,
        installedCommandPath: "/Users/test/.local/bin/kc",
        verificationStatus: "passed",
        verificationDetail: "Terminal commands are enabled system-wide.",
        verificationCommandPath: "/Users/test/.local/bin/kc",
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "/tmp/repo",
    repoMode: "repo-not-initialized"
  });

  assert.ok(model);
  assert.equal(model?.actions.some((action) => action.id === "init-repo"), true);
  assert.match(model?.repoStatus ?? "", /needs repo-local initialization/);
});

test("onboarding shows one guided setup action when machine setup needs attention", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/Users/test/.local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: true,
        installedCommandPath: "/Users/test/.local/bin/kc",
        verificationStatus: "passed",
        verificationDetail: "Terminal commands are enabled system-wide.",
        verificationCommandPath: "/Users/test/.local/bin/kc",
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "/tmp/repo",
    repoMode: "healthy",
    machineSetup: {
      needsAttention: true,
      recommendedProfile: "desktop-only",
      detail: "Apply Kiwi-managed machine setup and repo wiring with one guided flow."
    }
  });

  assert.ok(model);
  assert.deepEqual(model?.actions.map((action) => action.id), ["setup-machine"]);
  assert.deepEqual(model?.actions[0]?.commandArgs, ["--profile", "desktop-only"]);
});

test("onboarding stays hidden when CLI, repo, and machine setup are ready", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/Users/test/.local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: true,
        installedCommandPath: "/Users/test/.local/bin/kc",
        verificationStatus: "passed",
        verificationDetail: "Terminal commands are enabled system-wide.",
        verificationCommandPath: "/Users/test/.local/bin/kc",
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "/tmp/repo",
    repoMode: "healthy",
    machineSetup: {
      needsAttention: false,
      recommendedProfile: "desktop-only",
      detail: "Machine setup is aligned."
    }
  });

  assert.equal(model, null);
});

test("onboarding stays hidden when CLI is installed and the repo is ready", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/Users/test/.local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: true,
        installedCommandPath: "/Users/test/.local/bin/kc",
        verificationStatus: "passed",
        verificationDetail: "Terminal commands are enabled system-wide.",
        verificationCommandPath: "/Users/test/.local/bin/kc",
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "/tmp/repo",
    repoMode: "healthy"
  });

  assert.equal(model, null);
});

test("onboarding offers a retry action when default terminal command setup failed", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/usr/local/bin",
        installRoot: "/Library/Application Support/Kiwi Control",
        installScope: "machine",
        installed: false,
        installedCommandPath: null,
        verificationStatus: "blocked",
        verificationDetail: "Administrator approval was denied before Kiwi could finish system-wide kc setup.",
        verificationCommandPath: null,
        requiresNewTerminal: false
      }
    },
    platform: "macos",
    targetRoot: "/tmp/repo",
    repoMode: "healthy"
  });

  assert.ok(model);
  assert.equal(model?.actions.some((action) => action.id === "install-cli"), true);
  assert.match(model?.actions.find((action) => action.id === "install-cli")?.label ?? "", /Retry terminal command setup/);
  assert.match(model?.cliStatus ?? "", /Default terminal command setup did not complete/i);
});
