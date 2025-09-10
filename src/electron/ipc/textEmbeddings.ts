import { dialog, ipcMain } from "electron";
import { EventChannels } from "../../common/constants.js";

const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

export function setupTextEmbeddingHandlers() {
  ipcMain.handle(EventChannels.TEXT_EMBEDDINGS_SELECT_FOLDER, async (): Promise<string | null> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select Folder to Scan",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    } catch (error) {
      console.error("Error selecting folder:", error);
      return null;
    }
  });

  ipcMain.handle(EventChannels.TEXT_EMBEDDINGS_SCAN_FOLDER, async (event, folder_path: string) => {
    try {
      if (!folder_path) {
        throw new Error("No folder path provided");
      }
      const response = await fetch(`${URL}/text/scan-folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_path }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }
      const results = await response.json();
      // result = {
      //   total_found: total_images,
      //   total_added: added_count,
      //   batches_processed: batches_processed,
      //   errors: errors,
      // };
      return {
        success: true,
        error: null,
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in image-embeddings:scan-folder:", errorMessage);

      return {
        success: false,
        error: errorMessage,
        results: null,
      };
    }
  });
  ipcMain.handle(EventChannels.TEXT_EMBEDDINGS_SEARCH_BY_TEXT, async (event, query: string, limit: number = 10) => {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error("Query cannot be empty");
      }

      const response = await fetch(`${URL}/text/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query_text: query.trim(), n_results: limit }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const results = await response.json();

      return {
        success: true,
        error: null,
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in image-embeddings:search-by-text:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        results: [],
      };
    }
  });
  ipcMain.handle(EventChannels.TEXT_EMBEDDINGS_DELETE_ALL, async (event) => {
    try {
      const response = await fetch(`${URL}/text/delete-all`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        error: null,
        message: result.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in image-embeddings:delete-all:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        message: null,
      };
    }
  });

  ipcMain.handle(EventChannels.TEXT_EMBEDDINGS_DELETE_FOLDER, async (event,folder_path:string) => {
    try {
      const response = await fetch(`${URL}/text/delete-folder`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_path }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        error: null,
        message: result.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in image-embeddings:delete-folder:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        message: null,
      };
    }
  });
}
