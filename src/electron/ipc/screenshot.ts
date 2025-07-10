import { ipcMain, BrowserWindow, clipboard } from "electron";
import { exec } from "child_process";
import { promisify } from "util";

// Convert exec to promise-based function for async/await usage
const execAsync = promisify(exec);

// Interface for screenshot data that includes image buffer and window references
interface ScreenshotData {
  buffer: Buffer; // The screenshot image data
  width: number; // Original image width
  height: number; // Original image height
  mainWindow: BrowserWindow; // Reference to main app window
  selectionWindow: BrowserWindow; // Reference to selection overlay window
}

// Extend global object to store screenshot data temporarily
declare global {
  var screenshotData: ScreenshotData | undefined;
}

export function setupScreenshotHandlers() {
  ipcMain.handle("screenshot:capture", async (event) => {
    try {
      // Get the currently focused window or the first available window
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

      if (mainWindow) {
        // Hide the main window to avoid it appearing in the screenshot
        mainWindow.hide();

        // Wait for window to hide completely
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Store the clipboard content before taking screenshot
      const clipboardBefore = clipboard.readImage();
      const clipboardBeforeBuffer = clipboardBefore.isEmpty() ? null : clipboardBefore.toPNG();

      // macOS - use built-in screencapture with interactive selection and clipboard output
      const command = `screencapture -i -c`;

      // Execute screenshot command
      await execAsync(command);

      // Wait a moment for the clipboard to be updated
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Restore the main window
      if (mainWindow) mainWindow.show();

      // Check if clipboard contains an image and if it's different from before
      const clipboardImage = clipboard.readImage();
      if (!clipboardImage.isEmpty()) {
        const clipboardAfterBuffer = clipboardImage.toPNG();

        // Check if the clipboard content actually changed (new screenshot was taken)
        const isNewScreenshot =
          !clipboardBeforeBuffer ||
          clipboardBeforeBuffer.length !== clipboardAfterBuffer.length ||
          !clipboardBeforeBuffer.equals(clipboardAfterBuffer);

        if (isNewScreenshot) {
          // Convert clipboard image to base64 for sending to renderer
          const base64Data = clipboardAfterBuffer.toString("base64");

          return {
            success: true,
            message: "Screenshot captured and saved to clipboard",
            hasImage: true,
            imageData: {
              data: base64Data,
              mimeType: "image/png",
            },
          };
        } else {
          // Clipboard content didn't change, user likely cancelled
          return {
            success: false,
            error: "Screenshot was cancelled",
            hasImage: false,
          };
        }
      } else {
        return {
          success: false,
          error: "Screenshot was cancelled or failed",
          hasImage: false,
        };
      }
    } catch (error) {
      console.error("Error taking screenshot:", error);

      // Ensure main window is restored even if error occurs
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.show();

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  // IPC handler for finishing screenshot process with optional cropping
  ipcMain.handle("screenshot:finish", async (event, selection) => {
    try {
      // Retrieve screenshot data from global storage
      const screenshotData = global.screenshotData;
      if (!screenshotData) {
        return { success: false, error: "No screenshot data found" };
      }

      const { buffer, width, height, mainWindow, selectionWindow } = screenshotData;

      // Clean up windows - close selection overlay and restore main window
      selectionWindow.close();
      if (mainWindow) mainWindow.show();

      // Start with original screenshot buffer
      let finalBuffer = buffer;

      // If user made a selection (crop area), crop the image
      if (selection.width > 0 && selection.height > 0) {
        const sharp = await import("sharp"); // Dynamic import for image processing

        // Calculate scaling factors between screen coordinates and image coordinates
        const scaleX = width / selection.screenWidth;
        const scaleY = height / selection.screenHeight;

        // Crop the image using Sharp library
        finalBuffer = await sharp
          .default(buffer)
          .extract({
            left: Math.round(selection.x * scaleX),
            top: Math.round(selection.y * scaleY),
            width: Math.round(selection.width * scaleX),
            height: Math.round(selection.height * scaleY),
          })
          .png()
          .toBuffer();
      }

      // Save the final image to clipboard
      const nativeImage = require("electron").nativeImage;
      const image = nativeImage.createFromBuffer(finalBuffer);
      clipboard.writeImage(image);

      // Clean up global screenshot data
      delete global.screenshotData;

      return {
        success: true,
        message: "Screenshot saved to clipboard successfully",
      };
    } catch (error) {
      console.error("Error finishing screenshot:", error);

      // Clean up on error - close windows and clear data
      const screenshotData = global.screenshotData;
      if (screenshotData) {
        if (screenshotData.selectionWindow) screenshotData.selectionWindow.close();
        if (screenshotData.mainWindow) screenshotData.mainWindow.show();
        delete global.screenshotData;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  // IPC handler for canceling screenshot process
  ipcMain.handle("screenshot:cancel", async (event) => {
    const screenshotData = global.screenshotData;
    if (screenshotData) {
      // Close selection window and restore main window
      if (screenshotData.selectionWindow) screenshotData.selectionWindow.close();
      if (screenshotData.mainWindow) screenshotData.mainWindow.show();
      // Clean up stored data
      delete global.screenshotData;
    }
    return { success: true, message: "Screenshot cancelled" };
  });
}
