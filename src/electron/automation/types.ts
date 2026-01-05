/**
 * Type definitions and constants for automation
 */

export const AUTOMATION_SERVER_URL = "http://localhost:8000";
export const GRID_SIZE = 6;
export const MAX_ORCHESTRATOR_STEPS = 6;

export interface OrchestratorStep {
  action: "click" | "type" | "press" | "wait";
  target?: string; // Element description for click
  data?: string; // Text to type, key to press, or delay in ms
  reason: string; // LLM's explanation
}

export type SendLogFn = (
  type: "server" | "llm-request" | "llm-response" | "thinking" | "error",
  title: string,
  content: string
) => void;

export interface CellIdentificationResult {
  cell: number;
  confidence: string;
  reason: string;
}

export interface VisionActionParams {
  apiKey: string;
  targetDescription: string;
  clickType: "left" | "right" | "double";
  imageModelOverride?: string;
  debug: boolean;
  actionType: "click" | "type" | "press";
  actionData?: string;
}

// ============================================
// Robust Orchestrator Types
// ============================================

/** Contextual execution state for the robust orchestrator */
export interface ExecutionContext {
  goal: string;
  plan: string; // Natural language plan (not rigid JSON)
  actionHistory: ActionHistoryEntry[];
  retryCount: number;
  maxRetries: number;
  currentStep: number;
  maxSteps: number;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
}

/** Record of an executed action */
export interface ActionHistoryEntry {
  action: string;
  target?: string;
  data?: string;
  success: boolean;
  observation: string;
  timestamp: number;
}

/** Sub-agent's decision for the next action */
export interface NextActionDecision {
  action: "click" | "type" | "press" | "wait" | "done";
  target?: string;
  data?: string;
  reason: string;
  goalComplete: boolean;
}

/** Result of verifying an action */
export interface VerificationResult {
  success: boolean;
  observation: string;
  suggestion?: string; // Hint for retry attempts
}

/** Configuration for the robust orchestrator */
export interface RobustOrchestratorConfig {
  maxSteps: number;
  maxRetries: number;
  maxConsecutiveFailures: number;
  debug: boolean;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: RobustOrchestratorConfig = {
  maxSteps: 10,
  maxRetries: 2,
  maxConsecutiveFailures: 3,
  debug: false,
};
