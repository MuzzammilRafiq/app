import { ipcMain } from "electron";
import { promises as fs } from "fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDirs } from "../get-folder.js";
import { heicConverter } from "../services/heicConverter.js";
import sharp from "sharp";

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
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
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
      },
    ) => {
      if (!image || !image.data || !image.mimeType) {
        throw new Error("Invalid image payload");
      }
      const { mediaDir } = getDirs();
      // Always save a compressed thumbnail (webp) to keep media small and durable
      const THUMB_MAX = 512; // px
      const baseNameRaw = (image.name || "image").replace(/\.[^.]+$/, "");
      const safeBase = baseNameRaw.replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `${Date.now()}-${randomUUID()}-${safeBase}.webp`;
      const filePath = path.join(mediaDir, fileName);

      try {
        const buffer = Buffer.from(image.data, "base64");
        const out = await sharp(buffer)
          .rotate() // auto-orient
          .resize({
            width: THUMB_MAX,
            height: THUMB_MAX,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 70 })
          .toBuffer();
        await fs.writeFile(filePath, out);
        return filePath;
      } catch (error) {
        console.error("Failed to save thumbnail:", error);
        throw error;
      }
    },
  );

  // Save a thumbnail from an existing file path into media and return the new media path
  ipcMain.handle(
    "media:save-image-from-path",
    async (_event, filePath: string) => {
      if (!filePath) throw new Error("Invalid file path");
      const { mediaDir } = getDirs();
      const THUMB_MAX = 512; // px
      try {
        let sourcePath = filePath;
        const lower = filePath.toLowerCase();
        if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
          // Convert HEIC/HEIF to a cached JPEG path first
          const converted = await heicConverter.getConvertedPath(filePath);
          if (converted) sourcePath = converted;
        }

        const baseNameRaw = path.basename(sourcePath).replace(/\.[^.]+$/, "");
        const safeBase = baseNameRaw.replace(/[^a-zA-Z0-9-_]/g, "_");
        const outName = `${Date.now()}-${randomUUID()}-${safeBase}.webp`;
        const outPath = path.join(mediaDir, outName);

        const inputBuffer = await fs.readFile(sourcePath);
        const outputBuffer = await sharp(inputBuffer)
          .rotate()
          .resize({
            width: THUMB_MAX,
            height: THUMB_MAX,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 70 })
          .toBuffer();
        await fs.writeFile(outPath, outputBuffer);
        return outPath;
      } catch (error) {
        console.error("Failed to save thumbnail from path:", error);
        throw error;
      }
    },
  );
}
