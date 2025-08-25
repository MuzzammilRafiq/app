import { ipcMain } from "electron";
import { promises as fs } from "fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDirs } from "../get-folder.js";
import { heicConverter } from "../services/heicConverter.js";

export function setupFileOperationHandlers() {
  ipcMain.handle("read-file-as-buffer", async (event, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error("Error reading file:", error);
      throw error;
    }
  });

  ipcMain.handle("get-converted-heic-path", async (event, heicPath: string) => {
    try {
      return await heicConverter.getConvertedPath(heicPath);
    } catch (error) {
      console.error("Error converting HEIC:", error);
      return null;
    }
  });

  ipcMain.handle("get-heic-cache-stats", async () => {
    try {
      return await heicConverter.getCacheStats();
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return { fileCount: 0, totalSizeMB: 0 };
    }
  });

  ipcMain.handle("cleanup-heic-cache", async () => {
    try {
      await heicConverter.cleanupCache();
      return { success: true };
    } catch (error) {
      console.error("Error cleaning up cache:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Save a base64 image into the media directory and return its absolute path
  ipcMain.handle(
    "media:save-image",
    async (
      _event,
      image: {
        data: string; // base64 (no data URL prefix)
        mimeType: string; // e.g. image/png
        name?: string; // original filename
      }
    ) => {
      if (!image || !image.data || !image.mimeType) {
        throw new Error("Invalid image payload");
      }
      const { mediaDir } = getDirs();

      // Derive extension from mime type
      const extMap: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif",
      };
      const guessedExt = extMap[image.mimeType.toLowerCase()] || "bin";
      const baseNameRaw = (image.name || "image").replace(/\.[^.]+$/, "");
      const safeBase = baseNameRaw.replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `${Date.now()}-${randomUUID()}-${safeBase}.${guessedExt}`;
      const filePath = path.join(mediaDir, fileName);

      try {
        const buffer = Buffer.from(image.data, "base64");
        await fs.writeFile(filePath, buffer);
        return filePath;
      } catch (error) {
        console.error("Failed to save image:", error);
        throw error;
      }
    }
  );
}
