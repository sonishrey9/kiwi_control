export {
  loadExecutionPlan,
  persistExecutionPlan,
  syncExecutionPlan,
  recordPlanStepResult,
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
  ExecutionExpectedOutcome,
  ExecutionPlanState,
  ExecutionPlanHierarchy,
  ExecutionPlanStep,
  ExecutionPlanStepId,
  ExecutionPlanStepStatus,
  ExecutionImpactPreview,
  RetryStrategy,
  FinalValidationResult
} from "./execution-engine.js";
