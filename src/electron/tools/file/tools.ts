import { Type, FunctionDeclaration } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const ensureSafePath = (filePath: string): string => {
  // Handle tilde expansion
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === "~") {
    return os.homedir();
  }
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(filePath);
};

export const readFile = async (params: { filePath: string; encoding?: string }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.filePath);
    const encoding = (params.encoding as BufferEncoding) || "utf-8";
    const content = await fs.promises.readFile(safePath, encoding);
    return `File content of ${params.filePath}:\n${content}`;
  } catch (error) {
    throw new Error(
      `Failed to read file ${params.filePath}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const readFileFD: FunctionDeclaration = {
  name: "readFile",
  description: "Read the contents of a file",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "Path to the file to read",
      },
      encoding: {
        type: Type.STRING,
        description: "File encoding (default: utf8)",
      },
    },
    required: ["filePath"],
  },
};

export const writeFile = async (params: { filePath: string; content: string; encoding?: string }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.filePath);
    const encoding = (params.encoding as BufferEncoding) || "utf8";
    await fs.promises.writeFile(safePath, params.content, encoding);
    return `Successfully wrote to file: ${params.filePath}`;
  } catch (error) {
    throw new Error(
      `Failed to write to file ${params.filePath}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const writeFileFD: FunctionDeclaration = {
  name: "writeFile",
  description: "Write content to a file",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "Path to the file to write",
      },
      content: {
        type: Type.STRING,
        description: "Content to write to the file",
      },
      encoding: {
        type: Type.STRING,
        description: "File encoding (default: utf8)",
      },
    },
    required: ["filePath", "content"],
  },
};

export const listDirectory = async (params: { directoryPath: string; showHidden?: boolean }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.directoryPath);

    // Build ls command with appropriate flags
    let command = `ls -la "${safePath}"`;

    if (!params.showHidden) {
      command = `ls -l "${safePath}"`;
    }

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      throw new Error(stderr);
    }

    if (!stdout.trim()) {
      return `Directory ${params.directoryPath} is empty`;
    }

    // Return raw output from ls command
    return stdout;
  } catch (error) {
    throw new Error(
      `Failed to list directory ${params.directoryPath}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const listDirectoryFD: FunctionDeclaration = {
  name: "listDirectory",
  description: "List the contents of a directory",
  parameters: {
    type: Type.OBJECT,
    properties: {
      directoryPath: {
        type: Type.STRING,
        description: "Path to the directory to list",
      },
      showHidden: {
        type: Type.BOOLEAN,
        description: "Whether to show hidden files (default: false)",
      },
    },
    required: ["directoryPath"],
  },
};

export const createDirectory = async (params: { directoryPath: string; recursive?: boolean }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.directoryPath);
    await fs.promises.mkdir(safePath, { recursive: params.recursive !== false });
    return `Successfully created directory: ${params.directoryPath}`;
  } catch (error) {
    throw new Error(
      `Failed to create directory ${params.directoryPath}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const createDirectoryFD: FunctionDeclaration = {
  name: "createDirectory",
  description: "Create a new directory",
  parameters: {
    type: Type.OBJECT,
    properties: {
      directoryPath: {
        type: Type.STRING,
        description: "Path to the directory to create",
      },
      recursive: {
        type: Type.BOOLEAN,
        description: "Whether to create parent directories if they don't exist (default: true)",
      },
    },
    required: ["directoryPath"],
  },
};

export const deleteFileOrDirectory = async (params: { path: string; recursive?: boolean }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.path);
    const stats = await fs.promises.stat(safePath);

    if (stats.isDirectory()) {
      await fs.promises.rmdir(safePath, { recursive: params.recursive !== false });
      return `Successfully deleted directory: ${params.path}`;
    } else {
      await fs.promises.unlink(safePath);
      return `Successfully deleted file: ${params.path}`;
    }
  } catch (error) {
    throw new Error(`Failed to delete ${params.path}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

export const deleteFileOrDirectoryFD: FunctionDeclaration = {
  name: "deleteFileOrDirectory",
  description: "Delete a file or directory",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path to the file or directory to delete",
      },
      recursive: {
        type: Type.BOOLEAN,
        description: "Whether to delete directories recursively (default: true)",
      },
    },
    required: ["path"],
  },
};

export const getFileInfo = async (params: { filePath: string }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.filePath);
    const stats = await fs.promises.stat(safePath);

    const info = {
      path: params.filePath,
      size: stats.size,
      type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
      created: stats.birthtime.toLocaleString(),
      modified: stats.mtime.toLocaleString(),
      accessed: stats.atime.toLocaleString(),
      permissions: stats.mode.toString(8),
    };

    return `File information for ${params.filePath}:\n${JSON.stringify(info, null, 2)}`;
  } catch (error) {
    throw new Error(
      `Failed to get file info for ${params.filePath}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const getFileInfoFD: FunctionDeclaration = {
  name: "getFileInfo",
  description: "Get detailed information about a file or directory",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "Path to the file or directory",
      },
    },
    required: ["filePath"],
  },
};

export const checkExists = async (params: { path: string }): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.path);
    const stats = await fs.promises.stat(safePath);
    const type = stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other";
    return `${params.path} exists as a ${type}`;
  } catch {
    return `${params.path} does not exist`;
  }
};

export const checkExistsFD: FunctionDeclaration = {
  name: "checkExists",
  description: "Check if a file or directory exists",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path to check",
      },
    },
    required: ["path"],
  },
};

export const searchFiles = async (params: {
  searchPath: string;
  pattern: string;
  fileType?: string;
}): Promise<string> => {
  try {
    const safePath = ensureSafePath(params.searchPath);
    let command = `find "${safePath}" -name "${params.pattern}"`;

    if (params.fileType) {
      if (params.fileType === "file") {
        command += " -type f";
      } else if (params.fileType === "directory") {
        command += " -type d";
      }
    }

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      throw new Error(stderr);
    }

    const results = stdout.trim();
    if (!results) {
      return `No files found matching pattern "${params.pattern}" in ${params.searchPath}`;
    }

    return `Files found matching pattern "${params.pattern}" in ${params.searchPath}:\n${results}`;
  } catch (error) {
    throw new Error(`Failed to search for files: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

export const searchFilesFD: FunctionDeclaration = {
  name: "searchFiles",
  description: "Search for files and directories by name pattern",
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchPath: {
        type: Type.STRING,
        description: "Path to search in",
      },
      pattern: {
        type: Type.STRING,
        description: "Name pattern to search for (supports wildcards like *.txt)",
      },
      fileType: {
        type: Type.STRING,
        description: "Type of items to search for: 'file' or 'directory' (default: both)",
      },
    },
    required: ["searchPath", "pattern"],
  },
};
