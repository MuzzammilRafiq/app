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

// Tool registry interface
export interface ToolRegistry {
  [key: string]: {
    function: Function;
    declaration: FunctionDeclaration;
  };
}

// Get all available file tool declarations
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

// Get tool registry with both functions and declarations
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

// Execute a tool by name
export const executeTool = async (toolName: string, parameters: any = {}): Promise<string> => {
  const registry = getToolRegistry();
  const tool = registry[toolName];

  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }

  return await tool.function(parameters);
};
