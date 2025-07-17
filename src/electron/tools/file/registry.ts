import { FunctionDeclaration } from "@google/genai";
import {
  readFile,
  readFileFunctionDeclaration,
  writeFile,
  writeFileFunctionDeclaration,
  listContentsOfDirectory,
  listContentsOfDirectoryFunctionDeclaration,
  createDirectory,
  createDirectoryFunctionDeclaration,
  deleteFileOrDirectory,
  deleteFileOrDirectoryFunctionDeclaration,
  getFileInfo,
  getFileInfoFunctionDeclaration,
  checkExists,
  checkExistsFunctionDeclaration,
  searchFiles,
  searchFilesFunctionDeclaration,
} from "./tools.js";

export interface ToolRegistry {
  [key: string]: {
    function: Function;
    declaration: FunctionDeclaration;
  };
}

export const getAvailableTools = (): Record<string, FunctionDeclaration> => {
  return {
    readFile: readFileFunctionDeclaration,
    writeFile: writeFileFunctionDeclaration,
    listDirectory: listContentsOfDirectoryFunctionDeclaration,
    createDirectory: createDirectoryFunctionDeclaration,
    deleteFileOrDirectory: deleteFileOrDirectoryFunctionDeclaration,
    getFileInfo: getFileInfoFunctionDeclaration,
    checkExists: checkExistsFunctionDeclaration,
    searchFiles: searchFilesFunctionDeclaration,
  };
};

export const getToolRegistry = (): ToolRegistry => {
  return {
    readFile: {
      function: readFile,
      declaration: readFileFunctionDeclaration,
    },
    writeFile: {
      function: writeFile,
      declaration: writeFileFunctionDeclaration,
    },
    listDirectory: {
      function: listContentsOfDirectory,
      declaration: listContentsOfDirectoryFunctionDeclaration,
    },
    createDirectory: {
      function: createDirectory,
      declaration: createDirectoryFunctionDeclaration,
    },
    deleteFileOrDirectory: {
      function: deleteFileOrDirectory,
      declaration: deleteFileOrDirectoryFunctionDeclaration,
    },
    getFileInfo: {
      function: getFileInfo,
      declaration: getFileInfoFunctionDeclaration,
    },
    checkExists: {
      function: checkExists,
      declaration: checkExistsFunctionDeclaration,
    },
    searchFiles: {
      function: searchFiles,
      declaration: searchFilesFunctionDeclaration,
    },
  };
};

export const executeTool = async (toolName: string, parameters: any = {}): Promise<string> => {
  const registry = getToolRegistry();
  const tool = registry[toolName];

  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }

  return await tool.function(parameters);
};

const convertType = (type: string) => {
  const map: Record<string, string> = {
    STRING: "string",
    BOOLEAN: "boolean",
    OBJECT: "object",
  };
  return map[type.toUpperCase()] || type.toLowerCase();
};

export const tools = Object.values(getAvailableTools()).map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: convertType(tool.parameters?.type ?? "object"),
      properties: Object.fromEntries(
        Object.entries(tool.parameters?.properties ?? {}).map(([key, val]: any) => [
          key,
          {
            type: convertType(val.type),
            description: val.description,
          },
        ])
      ),
      required: tool.parameters?.required ?? [],
    },
  },
}));
