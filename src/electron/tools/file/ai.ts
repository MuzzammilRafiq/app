import { Type, FunctionDeclaration } from "@google/genai";
import { GoogleGenAI } from "@google/genai";
import { ToolContext, ToolSelectionResult, WorkflowDecision } from "./types.js";
import { TOOL_SELECTION_PROMPT, WORKFLOW_COORDINATION_PROMPT } from "./prompt.js";

// Initialize Gemini AI
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({ apiKey });
};

// AI Service class for managing all AI operations
export class AIService {
  private static instance: AIService;
  private ai: GoogleGenAI;

  private constructor() {
    this.ai = getAI();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async selectTool(
    prompt: string,
    context: ToolContext,
    functionDeclarations: FunctionDeclaration[]
  ): Promise<ToolSelectionResult> {
    const contextSummary =
      context.operations.length > 0
        ? `\nPrevious operations:\n${context.operations
            .map((op) => `- ${op.operation}: ${op.success ? "SUCCESS" : "FAILED"} - ${op.input.prompt}`)
            .join("\n")}`
        : "";

    const systemPrompt = TOOL_SELECTION_PROMPT(contextSummary, prompt);

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
        config: {
          tools: [
            {
              functionDeclarations: functionDeclarations,
            },
          ],
        },
      });

      // Check if Gemini made a function call
      if (result.functionCalls && result.functionCalls.length > 0) {
        const functionCall = result.functionCalls[0];
        return {
          toolName: functionCall.name || "unknown",
          parameters: functionCall.args || {},
          reasoning: result.text || "Tool selected by Gemini's native function calling",
        };
      } else {
        // Fallback: try to extract from text response
        const response = result.text || "";
        if (response.toLowerCase().includes("read") && response.toLowerCase().includes("file")) {
          return {
            toolName: "readFile",
            parameters: { filePath: prompt.split(" ").find((word) => word.includes(".")) || "file.txt" },
            reasoning: "Detected file read request",
          };
        }
        throw new Error("No function call made by Gemini");
      }
    } catch (error) {
      throw new Error(`Tool selection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Workflow coordination using structured output
  async coordinateWorkflow(
    originalPrompt: string,
    completedOperations: ToolContext["operations"],
    lastResult: string
  ): Promise<WorkflowDecision> {
    const operationsSummary = completedOperations
      .map(
        (op) =>
          `${op.operation}: ${op.success ? "SUCCESS" : "FAILED"} - Input: "${op.input.prompt}" - ${op.success ? "Result: " + (op.output?.slice(0, 100) + "...") : "Error: " + op.error}`
      )
      .join("\n");

    const systemPrompt = WORKFLOW_COORDINATION_PROMPT(originalPrompt, operationsSummary, lastResult);

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shouldContinue: {
                type: Type.BOOLEAN,
                description: "Whether additional operations are needed",
              },
              nextPrompt: {
                type: Type.STRING,
                description: "Specific prompt for next operation if needed (empty string if complete)",
              },
              reasoning: {
                type: Type.STRING,
                description: "Explanation of the decision",
              },
            },
            required: ["shouldContinue", "reasoning"],
          },
        },
      });

      const response = JSON.parse(result.text || "{}");

      return {
        shouldContinue: response.shouldContinue || false,
        nextPrompt: response.nextPrompt || undefined,
        reasoning: response.reasoning || "No reasoning provided",
      };
    } catch (error) {
      // Default to stopping on error
      return {
        shouldContinue: false,
        reasoning: `Workflow coordination failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
