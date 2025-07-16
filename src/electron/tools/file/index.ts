import { ToolContext, MasterRouterParams, MasterRouterResult, SummaryParams } from "./types.js";
import { AIService } from "./ai.js";
import { getAvailableTools, executeTool } from "./registry.js";
import { SUMMARY_GENERATION_PROMPT } from "./prompt.js";

const createContext = (taskDescription?: string): ToolContext => ({
  operations: [],
  taskDescription,
});

const aiService = AIService.getInstance();

export const masterToolRouter = async (params: MasterRouterParams): Promise<MasterRouterResult> => {
  let context = params.context || createContext(params.taskDescription);
  const maxOps = params.maxOperations || 5;
  let operationsPerformed = 0;
  let currentPrompt = params.prompt;
  // let taskDescription = params.taskDescription;
  let finalResult = "";

  try {
    while (operationsPerformed < maxOps) {
      try {
        const availableTools = getAvailableTools();
        const functionDeclarations = Object.values(availableTools);
        const toolSelection = await aiService.selectTool(currentPrompt, context, functionDeclarations);

        const result = await executeTool(toolSelection.toolName, toolSelection.parameters);

        context.operations.push({
          operation: toolSelection.toolName,
          input: {
            prompt: currentPrompt,
            params: toolSelection.parameters,
            reasoning: toolSelection.reasoning,
          },
          output: result,
          success: true,
        });

        operationsPerformed++;
        finalResult = result;

        if (operationsPerformed < maxOps) {
          const workflowDecision = await aiService.coordinateWorkflow(params.prompt, context.operations, result);

          if (workflowDecision.shouldContinue && workflowDecision.nextPrompt) {
            currentPrompt = workflowDecision.nextPrompt;
            continue;
          } else {
            // Task is complete
            break;
          }
        }
      } catch (error) {
        throw error;
        // Record failed operation
        // const errorMessage = error instanceof Error ? error.message : "Unknown error";
        // context.operations.push({
        //   operation: "unknown",
        //   input: { prompt: currentPrompt },
        //   success: false,
        //   error: errorMessage,
        // });

        // Stop on error
        // throw new Error(`Operation failed: ${errorMessage}`);
      }
    }

    if (operationsPerformed >= maxOps) {
      finalResult += "\n\nNote: Maximum operations limit reached. Task may be incomplete.";
    }

    return { result: finalResult, context, operationsPerformed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Master tool router failed: ${errorMessage}`);
  }
};

export const generateSummary = async (params: SummaryParams): Promise<string> => {
  const { context } = params;
  return SUMMARY_GENERATION_PROMPT(context);
};

export { masterToolRouterFunctionDeclaration, generateSummaryFunctionDeclaration } from "./declarations.js";
export type { ToolContext, MasterRouterParams, MasterRouterResult, SummaryParams } from "./types.js";

if (require.main === module) {
  const result = await masterToolRouter({
    prompt: `You are running on macOS and have full access to the file system. You can read files from any location including the user's home directory.
Task Overview
Convert a Python file located in /Documents/python-code/ folder to JavaScript and create a new JavaScript file.
Step-by-Step Plan
Phase 1: Discovery and Analysis

Locate the Python file

Use listDirectory to explore the /Documents/python-code/ folder
Identify the specific Python file(s) that need conversion
Use getFileInfo to get details about the file(s)

Analyze the Python code

Phase 2: Conversion Strategy

Plan the JavaScript equivalent

Map Python data types to JavaScript equivalents:
Convert Python syntax to JavaScript:

Phase 3: Implementation

Create the JavaScript file

Determine appropriate filename (e.g., if Python file is script.py, create script.js)
Use writeFile to create the new JavaScript file
Implement the conversion following JavaScript best practices:

Phase 4: Validation and Documentation

Verify the conversion

Use readFile to review the created JavaScript file
Check for syntax correctness
Ensure all functionality is preserved
Test any specific edge cases



Tools Required

listDirectory - to explore the Python code folder
readFile - to read the Python source code
writeFile - to create the JavaScript file
getFileInfo - to get file details
checkExists - to verify file locations

Expected Deliverables

Converted JavaScript file - A functional JavaScript version of the Python code
Conversion report - Documentation of changes made and any notes
Dependency list - Any JavaScript libraries needed to replace Python functionality
`,
    maxOperations: 10,
  });

  console.log("Translation Result:");
  console.log(result.result);
  console.log("\nOperations performed:", result.operationsPerformed);
}
