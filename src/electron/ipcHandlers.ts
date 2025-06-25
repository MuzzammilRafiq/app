import { ipcMain, BrowserWindow, dialog } from "electron";
import { GoogleGenAI } from "@google/genai";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

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

// Initialize Google Gemini AI service
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

// Check if API key exists and initialize AI service
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn("GEMINI_API_KEY not found in environment variables");
}

// IPC handler for sending single messages to Gemini AI
export function setupGeminiHandlers() {
  ipcMain.handle("gemini:send-message", async (event, message: string) => {
    // Check if AI service is properly initialized
    if (!ai || !apiKey) {
      return {
        text: "",
        error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
      };
    }

    try {
      // Send message to Gemini API with specific model and configuration
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Using flash model for faster responses
        contents: message,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking budget for faster response
          },
        },
      });

      return {
        text: response.text || "No response received",
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  // IPC handler for sending conversation history to Gemini AI
  ipcMain.handle("gemini:send-message-with-history", async (event, messages: any[]) => {
    // Check if AI service is properly initialized
    if (!ai || !apiKey) {
      return {
        text: "",
        error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
      };
    }

    try {
      // Transform message history to Gemini API format
      const contents = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model", // Map roles to Gemini format
        parts: [{ text: msg.content }], // Wrap content in parts array
      }));

      // Send conversation history to Gemini API
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      return {
        text: response.text || "No response received",
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });
}

// IPC handler for capturing screenshots using system tools
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

      // Prepare screenshot command based on operating system
      let command: string;
      const timestamp = Date.now();
      const filename = `screenshot-${timestamp}.png`;
      const desktopPath = path.join(process.env.HOME || process.env.USERPROFILE || "", "Desktop");
      const filePath = path.join(desktopPath, filename);

      if (process.platform === "darwin") {
        // macOS - use built-in screencapture with interactive selection (-i flag)
        command = `screencapture -i "${filePath}"`;
      } else if (process.platform === "win32") {
        // Windows - open Snipping Tool (user handles capture manually)
        command = `start snippingtool`;
      } else {
        // Linux - use GNOME screenshot tool with area selection (-a flag)
        command = `gnome-screenshot -a -f "${filePath}"`;
      }

      if (process.platform === "win32") {
        // Windows: Just open snipping tool, let user handle the rest
        await execAsync(command);
        if (mainWindow) mainWindow.show();
        return {
          success: true,
          message: "Snipping Tool opened. Please capture your screenshot manually.",
          platform: "windows",
        };
      } else {
        // macOS and Linux: Execute screenshot command
        await execAsync(command);

        // Wait for file to be written to disk
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Restore the main window
        if (mainWindow) mainWindow.show();

        // Verify that screenshot file was created
        const fs = await import("fs");
        if (fs.existsSync(filePath)) {
          return {
            success: true,
            filePath: filePath,
            message: "Screenshot saved successfully",
          };
        } else {
          return {
            success: false,
            error: "Screenshot was cancelled or failed",
          };
        }
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

      // Show save dialog to let user choose where to save screenshot
      const result = await dialog.showSaveDialog({
        title: "Save Screenshot",
        defaultPath: `screenshot-${Date.now()}.png`,
        filters: [
          { name: "PNG Files", extensions: ["png"] },
          { name: "JPEG Files", extensions: ["jpg", "jpeg"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      // If user cancels save dialog
      if (result.canceled) {
        return { success: false, error: "Screenshot cancelled" };
      }

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

      // Write the final image to disk
      const fs = await import("fs");
      fs.writeFileSync(result.filePath, finalBuffer);

      // Clean up global screenshot data
      delete global.screenshotData;

      return {
        success: true,
        filePath: result.filePath,
        message: "Screenshot saved successfully",
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
