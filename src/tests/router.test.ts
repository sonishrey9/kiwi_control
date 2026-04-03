import test from "node:test";
import assert from "node:assert/strict";
import { buildTemplateContext, getPortableStateSpecs, resolveRoutingDecision, selectPortableContract } from "../core/router.js";
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

test("portable state specs include repo-first role, Copilot, and CI contract surfaces", () => {
  const config = {
    global: {
      defaults: {
        task_directory: ".agent/tasks",
        context_directory: ".agent/context",
        managed_prefix: "SHREY-JUNIOR"
      }
    },
    routing: {
      portable_state: {
        project: "templates/project/.agent/project.yaml",
        checks: "templates/project/.agent/checks.yaml",
        context: {
          architecture: "templates/project/.agent/context/architecture.md",
          commands: "templates/project/.agent/context/commands.md",
          conventions: "templates/project/.agent/context/conventions.md",
          tool_capabilities: "templates/project/.agent/context/tool-capabilities.md",
          mcp_capabilities: "templates/project/.agent/context/mcp-capabilities.md",
          runbooks: "templates/project/.agent/context/runbooks.md"
        },
        roles: {
          readme: "templates/project/.agent/roles/README.md",
          specialist_template: "templates/project/.agent/roles/specialist-role.md"
        },
        templates: {
          role_result: "templates/project/.agent/templates/role-result.md"
        },
        state: {
          current_phase: "templates/project/.agent/state/current-phase.json",
          active_role_hints: "templates/project/.agent/state/active-role-hints.json",
          checkpoint_latest_json: "templates/project/.agent/state/checkpoints/latest.json",
          checkpoint_latest_markdown: "templates/project/.agent/state/checkpoints/latest.md",
          handoff_readme: "templates/project/.agent/state/handoff/README.md",
          dispatch_readme: "templates/project/.agent/state/dispatch/README.md",
          reconcile_readme: "templates/project/.agent/state/reconcile/README.md"
        },
        scripts: {
          verify_contract: "templates/project/.agent/scripts/verify-contract.sh"
        },
        github: {
          instructions: {
            backend: "templates/project/.github/instructions/backend.instructions.md",
            frontend: "templates/project/.github/instructions/frontend.instructions.md",
            docs: "templates/project/.github/instructions/docs.instructions.md",
            data: "templates/project/.github/instructions/data.instructions.md"
          },
          agents: {
            shrey_junior: "templates/project/.github/agents/shrey-junior.md",
            specialist_template: "templates/project/.github/agents/specialist-agent.md"
          },
          workflows: {
            contract: "templates/project/.github/workflows/shrey-junior-contract.yml"
          }
        }
      }
    },
    specialists: {
      defaults: {
        specialist_by_role: {
          planner: "architecture-specialist",
          reviewer: "review-specialist",
          tester: "qa-specialist"
        },
        fallback_specialist: "architecture-specialist"
      },
      specialists: {
        "fullstack-specialist": {
          name: "Fullstack Specialist",
          purpose: "Own fullstack contracts",
          preferred_tools: ["codex"],
          allowed_profiles: ["product-build"],
          routing_bias: {
            roles: ["implementer"],
            task_types: ["implementation"],
            file_areas: ["application"]
          },
          validation_expectations: ["tests"],
          result_schema_expectations: ["summary"],
          mcp_eligibility: ["github"],
          risk_posture: "conservative",
          handoff_guidance: ["handoff clearly"]
        },
        "backend-specialist": {
          name: "Backend Specialist",
          purpose: "Own backend contracts",
          preferred_tools: ["codex"],
          allowed_profiles: ["product-build"],
          routing_bias: {
            roles: ["implementer"],
            task_types: ["implementation"],
            file_areas: ["application"]
          },
          validation_expectations: ["tests"],
          result_schema_expectations: ["summary"],
          mcp_eligibility: ["github"],
          risk_posture: "conservative",
          handoff_guidance: ["handoff clearly"]
        },
        "frontend-specialist": {
          name: "Frontend Specialist",
          purpose: "Own frontend contracts",
          preferred_tools: ["codex"],
          allowed_profiles: ["product-build"],
          routing_bias: {
            roles: ["implementer"],
            task_types: ["implementation"],
            file_areas: ["application"]
          },
          validation_expectations: ["tests"],
          result_schema_expectations: ["summary"],
          mcp_eligibility: ["github"],
          risk_posture: "conservative",
          handoff_guidance: ["handoff clearly"]
        },
        "qa-specialist": {
          name: "QA Specialist",
          purpose: "Validate changes",
          preferred_tools: ["claude"],
          allowed_profiles: ["product-build"],
          routing_bias: {
            roles: ["tester"],
            task_types: ["testing"],
            file_areas: ["tests"]
          },
          validation_expectations: ["tests"],
          result_schema_expectations: ["summary"],
          mcp_eligibility: ["github"],
          risk_posture: "conservative",
          handoff_guidance: ["handoff clearly"]
        },
        "review-specialist": {
          name: "Review Specialist",
          purpose: "Review changes",
          preferred_tools: ["claude"],
          allowed_profiles: ["product-build"],
          routing_bias: {
            roles: ["reviewer"],
            task_types: ["review"],
            file_areas: ["application"]
          },
          validation_expectations: ["tests"],
          result_schema_expectations: ["summary"],
          mcp_eligibility: ["github"],
          risk_posture: "conservative",
          handoff_guidance: ["handoff clearly"]
        },
        "architecture-specialist": {
          name: "Architecture Specialist",
          purpose: "Plan changes",
          preferred_tools: ["claude"],
          allowed_profiles: ["product-build"],
          routing_bias: {
            roles: ["planner"],
            task_types: ["planning"],
            file_areas: ["context"]
          },
          validation_expectations: ["tests"],
          result_schema_expectations: ["summary"],
          mcp_eligibility: ["github"],
          risk_posture: "conservative",
          handoff_guidance: ["handoff clearly"]
        }
      }
    }
  } as unknown as LoadedConfig;

  const context = buildTemplateContext("/tmp/node-app", config, {
    profileName: "product-build",
    executionMode: "assisted",
    projectType: "node",
    starterSpecialists: "fullstack-specialist, backend-specialist, frontend-specialist, qa-specialist"
  });
  const specs = getPortableStateSpecs(config, context);
  const outputPaths = specs.map((spec) => spec.outputPath);
  assert.equal(outputPaths.includes(".agent/context/commands.md"), true);
  assert.equal(outputPaths.includes(".agent/context/tool-capabilities.md"), true);
  assert.equal(outputPaths.includes(".agent/context/mcp-capabilities.md"), true);
  assert.equal(outputPaths.includes(".github/instructions/backend.instructions.md"), true);
  assert.equal(outputPaths.includes(".github/instructions/frontend.instructions.md"), true);
  assert.equal(outputPaths.includes(".github/instructions/docs.instructions.md"), false);
  assert.equal(outputPaths.includes(".github/agents/shrey-junior.md"), true);
  assert.equal(outputPaths.includes(".github/agents/backend-specialist.md"), true);
  assert.equal(outputPaths.includes(".github/agents/review-specialist.md"), true);
  assert.equal(outputPaths.includes(".agent/roles/backend-specialist.md"), true);
  assert.equal(outputPaths.includes(".agent/state/active-role-hints.json"), true);
  assert.equal(outputPaths.includes(".agent/state/checkpoints/latest.json"), true);
  assert.equal(outputPaths.includes(".agent/state/checkpoints/latest.md"), true);
  assert.equal(outputPaths.includes(".agent/scripts/verify-contract.sh"), true);
  assert.equal(outputPaths.includes(".github/workflows/shrey-junior-contract.yml"), true);
  const currentPhaseSpec = specs.find((spec) => spec.outputPath === ".agent/state/current-phase.json");
  assert.equal(currentPhaseSpec?.writeMode, "seed-only");
  assert.equal(currentPhaseSpec?.contentFormat, "raw");
});

test("portable contract selection stays minimal for docs-heavy repos", () => {
  const config = {
    global: {
      defaults: {
        task_directory: ".agent/tasks",
        context_directory: ".agent/context",
        managed_prefix: "SHREY-JUNIOR"
      }
    },
    specialists: {
      defaults: {
        specialist_by_role: {
          planner: "architecture-specialist",
          reviewer: "review-specialist",
          tester: "qa-specialist"
        },
        fallback_specialist: "architecture-specialist"
      },
      specialists: {
        "docs-specialist": { allowed_profiles: ["documentation-heavy"] },
        "qa-specialist": { allowed_profiles: ["documentation-heavy"] },
        "review-specialist": { allowed_profiles: ["documentation-heavy"] },
        "architecture-specialist": { allowed_profiles: ["documentation-heavy"] }
      }
    }
  } as unknown as LoadedConfig;

  const context = buildTemplateContext("/tmp/docs-repo", config, {
    profileName: "documentation-heavy",
    executionMode: "assisted",
    projectType: "docs",
    starterSpecialists: "docs-specialist, qa-specialist"
  });
  const contract = selectPortableContract(config, context);

  assert.deepEqual(contract.instructionKeys, ["docs"]);
  assert.equal(contract.specialistIds.includes("docs-specialist"), true);
  assert.equal(contract.specialistIds.includes("qa-specialist"), true);
  assert.equal(contract.specialistIds.includes("review-specialist"), true);
  assert.equal(contract.specialistIds.includes("architecture-specialist"), true);
  assert.equal(contract.specialistIds.includes("backend-specialist"), false);
  assert.equal(contract.skippedSurfaces.includes(".github/instructions/backend.instructions.md"), true);
});

test("portable contract selection stays quiet for generic repos", () => {
  const config = {
    global: {
      defaults: {
        task_directory: ".agent/tasks",
        context_directory: ".agent/context",
        managed_prefix: "SHREY-JUNIOR"
      }
    },
    specialists: {
      defaults: {
        specialist_by_role: {
          planner: "architecture-specialist",
          reviewer: "review-specialist",
          tester: "qa-specialist"
        },
        fallback_specialist: "architecture-specialist"
      },
      specialists: {
        "docs-specialist": { allowed_profiles: ["product-build"] },
        "qa-specialist": { allowed_profiles: ["product-build"] },
        "review-specialist": { allowed_profiles: ["product-build"] },
        "architecture-specialist": { allowed_profiles: ["product-build"] }
      }
    }
  } as unknown as LoadedConfig;

  const context = buildTemplateContext("/tmp/generic-repo", config, {
    profileName: "product-build",
    executionMode: "assisted",
    projectType: "generic",
    starterSpecialists: "architecture-specialist, review-specialist, qa-specialist, docs-specialist"
  });
  const contract = selectPortableContract(config, context);

  assert.deepEqual(contract.instructionKeys, ["docs"]);
  assert.equal(contract.specialistIds.includes("backend-specialist"), false);
  assert.equal(contract.specialistIds.includes("frontend-specialist"), false);
  assert.equal(contract.activeRole, "architecture-specialist");
});
