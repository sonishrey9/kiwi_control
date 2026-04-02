import test from "node:test";
import assert from "node:assert/strict";
import { buildTemplateContext, resolveRoutingDecision } from "../core/router.js";
import type { LoadedConfig } from "../core/config.js";
import type { ProfileSelection } from "../core/profiles.js";

test("template context derives project name and portable directories", () => {
  const config = {
    global: {
      defaults: {
        task_directory: ".agent/tasks",
        context_directory: ".agent/context",
        managed_prefix: "SHREY-JUNIOR"
      }
    }
  } as LoadedConfig;

  const context = buildTemplateContext("/tmp/sample-project", config, {
    profileName: "product-build",
    executionMode: "assisted"
  });
  assert.equal(context.projectName, "sample-project");
  assert.equal(context.taskDirectory, ".agent/tasks");
  assert.equal(context.contextDirectory, ".agent/context");
  assert.equal(context.profileName, "product-build");
  assert.equal(context.executionMode, "assisted");
});

test("routing prefers explicit profile task mapping and escalates large risky changes", () => {
  const config = {
    global: {
      defaults: {
        default_task_type: "implementation"
      }
    },
    routing: {
      defaults: {
        fallback_tool: "codex",
        review_tool: "codex"
      },
      profiles: {
        "strict-production": {
          review_tool: "codex",
          packet: {
            medium_risk_required_roles: ["reviewer"],
            high_risk_required_roles: ["planner", "reviewer", "tester"]
          },
          routing: {
            task_types: {
              planning: "claude",
              implementation: "codex",
              review: "codex",
              docs: "claude",
              inline: "copilot"
            },
            risk_overrides: {
              high: {
                review_tool: "claude",
                required_roles: ["planner", "reviewer"]
              }
            },
            file_area_overrides: {
              docs: "claude"
            }
          }
        }
      }
    }
  } as unknown as LoadedConfig;
  const selection = {
    profileName: "strict-production",
    profile: config.routing.profiles["strict-production"]
  } as ProfileSelection;

  const decision = resolveRoutingDecision(config, {
    goal: "plan a broad docs rewrite for release readiness",
    profile: selection,
    executionMode: "guarded",
    riskLevel: "high"
  });

  assert.equal(decision.primaryTool, "claude");
  assert.equal(decision.reviewTool, "claude");
  assert.equal(decision.taskType, "planning");
  assert.equal(decision.requiredRoles.includes("planner"), true);
  assert.equal(decision.requiredRoles.includes("reviewer"), true);
});
