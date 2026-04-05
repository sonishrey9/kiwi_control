export {
  loadExecutionPlan,
  persistExecutionPlan,
  syncExecutionPlan,
  deriveCompatibilityNextActions,
  getCurrentExecutionStep,
  getFailedExecutionStep,
  evaluateFinalValidation
} from "./execution-engine.js";

export type {
  ExecutionEngineState,
  ExecutionErrorType,
  ExecutionPlanContextSnapshot,
  ExecutionPlanError,
  ExecutionPlanState,
  ExecutionPlanStep,
  ExecutionPlanStepId,
  ExecutionPlanStepStatus,
  FinalValidationResult
} from "./execution-engine.js";
