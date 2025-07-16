// Type definitions for File Tools

// Context management interface
export interface ToolContext {
  operations: Array<{
    operation: string;
    input: any;
    output?: string;
    success: boolean;
    error?: string;
  }>;
  taskDescription?: string;
}

// Tool selection result
export interface ToolSelectionResult {
  toolName: string;
  parameters: any;
  reasoning: string;
}

// Workflow coordination result
export interface WorkflowDecision {
  shouldContinue: boolean;
  nextPrompt?: string;
  reasoning: string;
}

// Master router parameters
export interface MasterRouterParams {
  prompt: string;
  context?: ToolContext;
  taskDescription?: string;
  maxOperations?: number;
}

// Master router result
export interface MasterRouterResult {
  result: string;
  context: ToolContext;
  operationsPerformed: number;
}

// Summary parameters
export interface SummaryParams {
  context: ToolContext;
}
