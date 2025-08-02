import { Type, FunctionDeclaration } from "@google/genai";

export const masterToolRouterFunctionDeclaration: FunctionDeclaration = {
  name: "masterToolRouter",
  description:
    "AI-powered master function that intelligently routes file operations and coordinates multi-step workflows",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "Natural language prompt describing the desired file operation or complex task",
      },
      context: {
        type: Type.STRING,
        description: "JSON string of previous context to maintain operation history (optional)",
      },
      taskDescription: {
        type: Type.STRING,
        description: "Overall description of the task being performed (optional)",
      },
      maxOperations: {
        type: Type.NUMBER,
        description: "Maximum number of operations to perform (default: 5, prevents infinite loops)",
      },
    },
    required: ["prompt"],
  },
};

export const generateSummaryFunctionDeclaration: FunctionDeclaration = {
  name: "generateSummary",
  description: "Generate a comprehensive summary of all file operations performed, including success/failure status",
  parameters: {
    type: Type.OBJECT,
    properties: {
      context: {
        type: Type.STRING,
        description: "JSON string of the tool context containing operation history",
      },
    },
    required: ["context"],
  },
};
