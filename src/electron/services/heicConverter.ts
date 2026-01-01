import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import crypto from "crypto";
import { LOG } from "../utils/logging.js";
const TAG = "heicConverter";
class HeicConverter {
  private cacheDir: string;

  constructor() {
    // Create cache directory in user's temp folder
    this.cacheDir = path.join(os.tmpdir(), "muzz-chat-heic-cache");
    this.ensureCacheDirectory();
  }

  private async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      LOG(TAG).ERROR("Failed to create HEIC cache directory:", error);
    }
  }

  /**
   * Generate a unique cache key for a HEIC file based on file path and modification time
   */
  private async getCacheKey(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      const content = `${filePath}-${stats.mtime.getTime()}-${stats.size}`;
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch (error) {
      LOG(TAG).ERROR("Failed to get cache key:", error);
      // Fallback to just file path hash if stats fail
      return crypto.createHash("sha256").update(filePath).digest("hex");
    }
  }

  /**
   * Convert HEIC to JPEG using native macOS sips command (much faster than heic2any)
   */
  private async convertWithSips(
    inputPath: string,
    outputPath: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const sips = spawn("sips", [
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        "80", // Quality 80%
        inputPath,
        "--out",
        outputPath,
      ]);

      sips.on("close", (code) => {
        resolve(code === 0);
      });

      sips.on("error", (error) => {
        LOG(TAG).ERROR("Error running sips command:", error);
        resolve(false);
      });
    });
  }

  /**
   * Get converted JPEG path for a HEIC file (converts if not cached)
   */
  async getConvertedPath(heicPath: string): Promise<string | null> {
    try {
      // Check if file exists and is HEIC
      if (!(await this.isHeicFile(heicPath))) {
        return null;
      }

      const cacheKey = await this.getCacheKey(heicPath);
      const cachedPath = path.join(this.cacheDir, `${cacheKey}.jpg`);

      // Check if already cached
      try {
        await fs.access(cachedPath);
        return cachedPath; // Return cached version
      } catch {
        // Not cached, convert now
      }

      // Convert using sips
      const success = await this.convertWithSips(heicPath, cachedPath);

      if (success) {
        return cachedPath;
      } else {
        LOG(TAG).ERROR(`Failed to convert HEIC file: ${heicPath}`);
        return null;
      }
    } catch (error) {
      LOG(TAG).ERROR("Error in getConvertedPath:", error);
      return null;
    }
  }

  /**
   * Check if a file is HEIC/HEIF
   */
  private async isHeicFile(filePath: string): Promise<boolean> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      return ext === ".heic" || ext === ".heif";
    } catch (error) {
      LOG(TAG).ERROR("Error in isHeicFile:", error);
      return false;
    }
  }

  /**
   * Pre-convert multiple HEIC files (useful during folder scanning)
   */
  async preConvertFiles(heicPaths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    const conversions = heicPaths.map(async (heicPath) => {
      const convertedPath = await this.getConvertedPath(heicPath);
      if (convertedPath) {
        results.set(heicPath, convertedPath);
      }
    });

    await Promise.allSettled(conversions);
    return results;
  }

  /**
   * Clean up old cache files (older than 7 days)
   */
  async cleanupCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
        }

      }

    } catch (error) {
      // Ignore errors for individual files
      LOG(TAG).ERROR("Error cleaning up cache:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ fileCount: number; totalSizeMB: number }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Ignore errors for individual files
        }
      }

      return {
        fileCount: files.length,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      };
    } catch {
      return { fileCount: 0, totalSizeMB: 0 };
    }
  }
}

// Singleton instance
export const heicConverter = new HeicConverter();
