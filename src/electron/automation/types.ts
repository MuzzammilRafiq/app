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
