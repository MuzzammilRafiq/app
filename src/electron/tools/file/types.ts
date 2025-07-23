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

export interface ToolSelectionResult {
  toolName: string;
  parameters: any;
  reasoning: string;
}

export interface WorkflowDecision {
  shouldContinue: boolean;
  nextPrompt?: string;
  reasoning: string;
}

export interface MasterRouterParams {
  prompt: string;
  context?: ToolContext;
  taskDescription?: string;
  maxOperations?: number;
}

export interface MasterRouterResult {
  result: string;
  context: ToolContext;
  operationsPerformed: number;
}

export interface SummaryParams {
  context: ToolContext;
}
