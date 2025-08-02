import { ipcMain } from "electron";

const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

export function setupImageEmbeddingHandlers() {
  ipcMain.handle("image-embeddings:add-folder", async (event, folder_path: string) => {
    try {
      if (!folder_path) {
        throw new Error("No folder path provided");
      }
      const response = await fetch(`${URL}/images/add-folder`, {
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
      return {
        success: true,
        error: null,
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in image-embeddings:add-folder:", errorMessage);

      return {
        success: false,
        error: errorMessage,
        results: null,
      };
    }
  });
  ipcMain.handle("image-embeddings:search-by-text", async (event, query: string, limit: number = 10) => {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error("Query cannot be empty");
      }

      const response = await fetch(`${URL}/images/query`, {
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

  ipcMain.handle("image-embeddings:delete-all", async (event) => {
    try {
      const response = await fetch(`${URL}/images/delete-all`, {
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
}
