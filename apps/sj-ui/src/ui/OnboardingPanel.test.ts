/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import { buildOnboardingPanelModel } from "./OnboardingPanel.js";

test("onboarding shows choose-repo first and keeps install-cli for after a repo is selected", () => {
  const model = buildOnboardingPanelModel({
    runtimeInfo: {
      appVersion: "0.2.0-beta.1",
      buildSource: "installed-bundle",
      runtimeMode: "installed-user",
      cli: {
        bundledInstallerAvailable: true,
        bundledNodePath: "/Applications/Kiwi Control.app/Contents/Resources/desktop/node/node",
        installBinDir: "/Users/test/.local/bin",
        installed: false,
        installedCommandPath: null
      }
    },
    targetRoot: "",
    repoMode: "bridge-unavailable"
  });

  assert.ok(model);
  assert.equal(model?.actions.some((action) => action.id === "choose-repo"), true);
  assert.equal(model?.actions.some((action) => action.id === "install-cli"), false);
  assert.match(model?.intro ?? "", /kc is optional/i);
  assert.equal(model?.actions[0]?.id, "choose-repo");
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
        installed: true,
        installedCommandPath: "/Users/test/.local/bin/kc"
      }
    },
    targetRoot: "/tmp/repo",
    repoMode: "repo-not-initialized"
  });

  assert.ok(model);
  assert.equal(model?.actions.some((action) => action.id === "init-repo"), true);
  assert.match(model?.repoStatus ?? "", /needs repo-local initialization/);
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
        installed: true,
        installedCommandPath: "/Users/test/.local/bin/kc"
      }
    },
    targetRoot: "/tmp/repo",
    repoMode: "healthy"
  });

  assert.equal(model, null);
});
