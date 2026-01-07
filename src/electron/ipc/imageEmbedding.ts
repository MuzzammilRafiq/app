import { dialog, ipcMain } from "electron";
import { LOG } from "../utils/logging.js";

const TAG = "image-embedding";
const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

export function setupImageEmbeddingHandlers() {
  ipcMain.handle(
    "image-embeddings:select-folder",
    async (): Promise<string | null> => {
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
        LOG(TAG).ERROR(
          "Error selecting folder:",
          error instanceof Error ? error.message : String(error)
        );
        return null;
      }
    }
  );

  ipcMain.handle(
    "image-embeddings:select-files",
    async (): Promise<string[] | null> => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ["openFile", "multiSelections"],
          title: "Select Image Files to Index",
          filters: [
            {
              name: "Image Files",
              extensions: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths;
      } catch (error) {
        LOG(TAG).ERROR(
          "Error selecting files:",
          error instanceof Error ? error.message : String(error)
        );
        return null;
      }
    }
  );

  ipcMain.handle(
    "image-embeddings:scan-file",
    async (event, file_path: string) => {
      try {
        if (!file_path) {
          throw new Error("No file path provided");
        }
        const response = await fetch(`${URL}/image/scan-file`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_path }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Server error: ${response.status}`
          );
        }
        const results = await response.json();
        return {
          success: true,
          error: null,
          results,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        LOG(TAG).ERROR("scan-file failed:", errorMessage);

        return {
          success: false,
          error: errorMessage,
          results: null,
        };
      }
    }
  );
  ipcMain.handle(
    "image-embeddings:scan-folder",
    async (event, folder_path: string) => {
      try {
        if (!folder_path) {
          throw new Error("No folder path provided");
        }
        const response = await fetch(`${URL}/image/scan-folder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folder_path }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Server error: ${response.status}`
          );
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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        LOG(TAG).ERROR("scan-folder failed:", errorMessage);

        return {
          success: false,
          error: errorMessage,
          results: null,
        };
      }
    }
  );
  ipcMain.handle(
    "image-embeddings:search-by-text",
    async (event, query: string, limit: number = 10) => {
      try {
        if (!query || query.trim().length === 0) {
          throw new Error("Query cannot be empty");
        }

        const response = await fetch(`${URL}/image/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query_text: query.trim(), n_results: limit }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Server error: ${response.status}`
          );
        }

        const results = await response.json();

        return {
          success: true,
          error: null,
          results,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        LOG(TAG).ERROR("search-by-text failed:", errorMessage);
        return {
          success: false,
          error: errorMessage,
          results: [],
        };
      }
    }
  );
  ipcMain.handle("image-embeddings:delete-all", async (_event) => {
    try {
      const response = await fetch(`${URL}/image/delete-all`, {
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      LOG(TAG).ERROR("delete-all failed:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        message: null,
      };
    }
  });

  ipcMain.handle(
    "image-embeddings:delete-folder",
    async (event, folder_path: string) => {
      try {
        const response = await fetch(`${URL}/image/delete-folder`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folder_path }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Server error: ${response.status}`
          );
        }

        const result = await response.json();

        return {
          success: true,
          error: null,
          message: result.message,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        LOG(TAG).ERROR("delete-folder failed:", errorMessage);
        return {
          success: false,
          error: errorMessage,
          message: null,
        };
      }
    }
  );
}
