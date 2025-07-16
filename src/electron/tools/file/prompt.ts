export const TOOL_SELECTION_PROMPT = (
  contextSummary: string,
  prompt: string
) => `You are a file operation assistant. Analyze the user prompt and use the appropriate tool to complete their request.
${contextSummary}
User request: "${prompt}"
Select and call the most appropriate tool to fulfill this request. Extract parameters exactly as they appear in the prompt.`;

export const WORKFLOW_COORDINATION_PROMPT = (
  originalPrompt: string,
  operationsSummary: string,
  lastResult: string
) => `You are a workflow coordinator for file operations. Analyze if the original task is complete or if additional operations are needed.
Original user prompt: "${originalPrompt}"
Operations completed:
${operationsSummary}
Last operation result: "${lastResult.slice(0, 200)}..."
Determine if the original task is fully complete or if additional operations are needed to fulfill the user's request.
Consider:
- Has the original request been fully satisfied?
- Are there logical follow-up operations needed?
- Would additional operations add value to completing the task?
- Avoid infinite loops - don't continue unnecessarily`;

export const SUMMARY_GENERATION_PROMPT = (context: any) => {
  const totalOperations = context.operations.length;
  const successfulOperations = context.operations.filter((op: any) => op.success).length;
  const failedOperations = totalOperations - successfulOperations;

  let summary = "=== FILE OPERATIONS SUMMARY ===\n\n";

  if (context.taskDescription) {
    summary += `Task: ${context.taskDescription}\n`;
  }

  summary += `Total Operations: ${totalOperations}\n`;
  summary += `Successful: ${successfulOperations}\n`;
  summary += `Failed: ${failedOperations}\n\n`;

  // Overall status
  if (failedOperations === 0 && totalOperations > 0) {
    summary += "✅ STATUS: ALL OPERATIONS COMPLETED SUCCESSFULLY\n\n";
  } else if (failedOperations > 0 && successfulOperations > 0) {
    summary += "⚠️ STATUS: PARTIAL SUCCESS - SOME OPERATIONS FAILED\n\n";
  } else if (failedOperations > 0 && successfulOperations === 0) {
    summary += "❌ STATUS: ALL OPERATIONS FAILED\n\n";
  } else {
    summary += "ℹ️ STATUS: NO OPERATIONS PERFORMED\n\n";
  }

  // Detailed operation log
  summary += "=== OPERATION DETAILS ===\n";
  context.operations.forEach((op: any, index: number) => {
    const status = op.success ? "✅" : "❌";
    summary += `${index + 1}. ${status} ${op.operation.toUpperCase()}\n`;
    summary += `   Input: ${JSON.stringify(op.input.prompt || op.input, null, 2)}\n`;

    if (op.success && op.output) {
      const truncatedOutput = op.output.length > 200 ? op.output.substring(0, 200) + "..." : op.output;
      summary += `   Result: ${truncatedOutput}\n`;
    }

    if (!op.success && op.error) {
      summary += `   Error: ${op.error}\n`;
    }

    summary += "\n";
  });

  // Recommendations
  if (failedOperations > 0) {
    summary += "=== RECOMMENDATIONS ===\n";
    const errors = context.operations.filter((op: any) => !op.success);
    errors.forEach((op: any) => {
      summary += `- Review failed operation: ${op.operation} - ${op.error}\n`;
    });
    summary += "\n";
  }

  return summary;
};
