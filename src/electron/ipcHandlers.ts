import { ipcMain, BrowserWindow, clipboard } from "electron";
import { GoogleGenAI } from "@google/genai";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

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
  console.warn(chalk.red("GEMINI_API_KEY not found in environment variables"));
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

      // macOS - use built-in screencapture with interactive selection and clipboard output
      const command = `screencapture -i -c`;

      // Execute screenshot command
      await execAsync(command);

      // Wait a moment for the clipboard to be updated
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Restore the main window
      if (mainWindow) mainWindow.show();

      // Check if clipboard contains an image
      const clipboardImage = clipboard.readImage();
      if (!clipboardImage.isEmpty()) {
        return {
          success: true,
          message: "Screenshot captured and saved to clipboard",
          hasImage: true,
        };
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
