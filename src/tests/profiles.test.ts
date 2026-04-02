import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { resolveExecutionMode, resolveProfileSelection } from "../core/profiles.js";
import type { LoadedConfig } from "../core/config.js";

test("profile selection prefers repo overlay when no CLI override exists", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sj-profile-"));
  await fs.mkdir(path.join(tempDir, ".agent"), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, ".agent", "project.yaml"),
    "version: 2\nprofile: strict-production\nrouting:\n  preferred_execution_mode: guarded\n",
    "utf8"
  );

  const config = {
    global: {
      defaults: {
        default_profile: "product-build",
        default_execution_mode: "assisted"
      }
    },
    routing: {
      profiles: {
        "product-build": {
          default_execution_mode: "assisted"
        },
        "strict-production": {
          default_execution_mode: "guarded"
        }
      }
    }
  } as unknown as LoadedConfig;

  const selection = await resolveProfileSelection(tempDir, config);
  assert.equal(selection.profileName, "strict-production");

  const executionMode = resolveExecutionMode(config, selection, {
    routing: {
      preferred_execution_mode: "guarded"
    }
  });
  assert.equal(executionMode, "guarded");
});
