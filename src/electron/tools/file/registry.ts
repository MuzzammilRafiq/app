import { FunctionDeclaration } from "@google/genai";
import {
  readFile,
  readFileFD,
  writeFile,
  writeFileFD,
  listDirectory,
  listDirectoryFD,
  createDirectory,
  createDirectoryFD,
  deleteFileOrDirectory,
  deleteFileOrDirectoryFD,
  getFileInfo,
  getFileInfoFD,
  checkExists,
  checkExistsFD,
  searchFiles,
  searchFilesFD,
} from "./tools.js";

export interface ToolRegistry {
  [key: string]: {
    function: (params: any) => Promise<string>;
    declaration: FunctionDeclaration;
  };
}

export const getAvailableTools = (): Record<string, FunctionDeclaration> => {
  return {
    readFile: readFileFD,
    writeFile: writeFileFD,
    listDirectory: listDirectoryFD,
    createDirectory: createDirectoryFD,
    deleteFileOrDirectory: deleteFileOrDirectoryFD,
    getFileInfo: getFileInfoFD,
    checkExists: checkExistsFD,
    searchFiles: searchFilesFD,
  };
};

export const getToolRegistry = (): ToolRegistry => {
  return {
    readFile: {
      function: readFile,
      declaration: readFileFD,
    },
    writeFile: {
      function: writeFile,
      declaration: writeFileFD,
    },
    listDirectory: {
      function: listDirectory,
      declaration: listDirectoryFD,
    },
    createDirectory: {
      function: createDirectory,
      declaration: createDirectoryFD,
    },
    deleteFileOrDirectory: {
      function: deleteFileOrDirectory,
      declaration: deleteFileOrDirectoryFD,
    },
    getFileInfo: {
      function: getFileInfo,
      declaration: getFileInfoFD,
    },
    checkExists: {
      function: checkExists,
      declaration: checkExistsFD,
    },
    searchFiles: {
      function: searchFiles,
      declaration: searchFilesFD,
    },
  };
};

export const executeTool = async (
  toolName: string,
  parameters: unknown = {},
): Promise<string> => {
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
        Object.entries(tool.parameters?.properties ?? {}).map(
          ([key, val]: [string, any]) => [
            key,
            {
              type: convertType(val.type),
              description: val.description,
            },
          ],
        ),
      ),
      required: tool.parameters?.required ?? [],
    },
  },
}));
