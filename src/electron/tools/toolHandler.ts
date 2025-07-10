import chalk from "chalk";
import tools from "./index.js";
import { GoogleGenAI } from "@google/genai";

interface ToolResult {
  toolName: string;
  result: string;
  error?: string;
}

interface ToolHandlerResponse {
  enhancedMessage: string;
  toolResults: ToolResult[];
  originalResponse?: string;
}

export class ToolHandler {
  private static instance: ToolHandler;
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  public static getInstance(): ToolHandler {
    if (!ToolHandler.instance) {
      ToolHandler.instance = new ToolHandler();
    }
    return ToolHandler.instance;
  }

  private getFunctionDeclarations(): any[] {
    const declarations: any[] = [];

    for (const [toolName, toolData] of Object.entries(tools)) {
      if (toolName === "default") continue;

      if (Array.isArray(toolData) && toolData.length >= 2) {
        const [, declaration] = toolData;
        if (declaration) {
          declarations.push(declaration);
        }
      }
    }

    return declarations;
  }

  /**
   * Executes a specific tool by name with given parameters
   */
  private async executeTool(toolName: string, parameters: any = {}): Promise<ToolResult> {
    try {
      const tool = (tools as any)[toolName];
      console.log(chalk.bgGreen(`[ToolHandler] Executing tool: ${toolName}`));
      console.log(chalk.bgYellow(`[ToolHandler] Tool: ${JSON.stringify(tool, null, 2)}`));
      console.log(chalk.bgRed(`[ToolHandler] Parameters: ${JSON.stringify(parameters, null, 2)}`));
      if (!tool || !Array.isArray(tool) || tool.length < 2) {
        return {
          toolName,
          result: "",
          error: `Tool '${toolName}' not found or not properly configured`,
        };
      }

      const [toolFunction] = tool;

      if (typeof toolFunction !== "function") {
        return {
          toolName,
          result: "",
          error: `Tool '${toolName}' function is not callable`,
        };
      }

      // Execute the tool function with parameters
      let result;

      // Handle different parameter patterns
      if (toolName === "calculate" && parameters.expression) {
        result = await toolFunction(parameters.expression);
      } else if (Object.keys(parameters).length === 0) {
        // No parameters needed
        result = await toolFunction();
      } else {
        // Pass parameters object
        result = await toolFunction(parameters);
      }

      return {
        toolName,
        result: typeof result === "string" ? result : JSON.stringify(result),
      };
    } catch (error) {
      return {
        toolName,
        result: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Processes a message using Gemini's function calling to determine which tools to run
   */
  public async processMessage(originalMessage: string): Promise<ToolHandlerResponse> {
    console.log(`[ToolHandler] Processing message: "${originalMessage}"`);

    // If AI is not available, return original message
    if (!process.env.GEMINI_API_KEY) {
      console.log("[ToolHandler] AI not available - returning original message");
      return {
        enhancedMessage: originalMessage,
        toolResults: [],
      };
    }

    try {
      // Get function declarations for all available tools
      const functionDeclarations = this.getFunctionDeclarations();

      if (functionDeclarations.length === 0) {
        console.log("[ToolHandler] No function declarations available");
        return {
          enhancedMessage: originalMessage,
          toolResults: [],
        };
      }

      console.log(
        chalk.green(`[ToolHandler] Available functions: ${functionDeclarations.map((f) => f.name).join(", ")}`)
      );

      // Send message to Gemini with function declarations
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `query: "${originalMessage}"`,
        config: {
          tools: [
            {
              functionDeclarations: functionDeclarations,
            },
          ],
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      const toolResults: ToolResult[] = [];

      // Check if Gemini wants to call any functions
      if (response.functionCalls && response.functionCalls.length > 0) {
        console.log(`[ToolHandler] Gemini requested ${response.functionCalls.length} function calls`);

        // Execute all requested function calls
        for (const functionCall of response.functionCalls) {
          if (functionCall.name) {
            console.log(
              chalk.green(`[ToolHandler] Executing function: ${functionCall.name} with args:`),
              functionCall.args
            );

            const result = await this.executeTool(functionCall.name, functionCall.args || {});
            toolResults.push(result);
          } else {
            console.warn(chalk.red("[ToolHandler] Function call without name detected"));
          }
        }
      } else {
        console.log(chalk.yellow("[ToolHandler] No function calls requested by Gemini"));
        return {
          enhancedMessage: originalMessage,
          toolResults: [],
          originalResponse: response.text,
        };
      }

      // Build enhanced message with tool results
      let enhancedMessage = originalMessage;

      if (toolResults.length > 0) {
        enhancedMessage += "\n\n[Tool Results]:\n";

        for (const result of toolResults) {
          if (result.error) {
            enhancedMessage += `❌ ${result.toolName}: Error - ${result.error}\n`;
          } else {
            enhancedMessage += `✅ ${result.toolName}: ${result.result}\n`;
          }
        }

        enhancedMessage += "\nPlease use the above tool results to provide a comprehensive response.";
      }

      console.log(`[ToolHandler] Enhanced message created with ${toolResults.length} tool results`);
      return {
        enhancedMessage,
        toolResults,
        originalResponse: response.text,
      };
    } catch (error) {
      console.error("[ToolHandler] Error processing message:", error);
      return {
        enhancedMessage: originalMessage,
        toolResults: [],
      };
    }
  }

  /**
   * Adds a new tool to the handler
   */
  public addTool(toolName: string, toolFunction: Function, declaration: any) {
    (tools as any)[toolName] = [toolFunction, declaration];
    console.log(`[ToolHandler] Added tool '${toolName}'`);
  }

  /**
   * Gets available tools
   */
  public getAvailableTools(): string[] {
    return Object.keys(tools).filter((key) => key !== "default");
  }
}
