import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { isDev } from "./util.js";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn("GEMINI_API_KEY not found in environment variables");
}

ipcMain.handle("gemini:send-message", async (event, message: string) => {
  if (!ai || !apiKey) {
    return {
      text: "",
      error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
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

ipcMain.handle("gemini:send-message-with-history", async (event, messages: any[]) => {
  if (!ai || !apiKey) {
    return {
      text: "",
      error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
    };
  }

  try {
    const contents = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

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

app.whenReady().then(() => {
  const preloadPath = path.join(__dirname, "preload.cjs");

  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-renderer/index.html"));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
});
