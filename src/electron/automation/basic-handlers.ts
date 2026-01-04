/**
 * Basic automation API handlers
 * Handlers for screenshot, mouse, and keyboard operations
 */

import { ipcMain } from "electron";
import { AUTOMATION_SERVER_URL } from "./types.js";

export function setupBasicAutomationHandlers() {
  // Get screenshot with numbered grid overlay
  ipcMain.handle(
    "automation:screenshot-grid",
    async (_event, gridSize: number = 6, debug: boolean = false) => {
      try {
        const response = await fetch(
          `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?grid_size=${gridSize}&save_image=${debug}`
        );
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to get screenshot: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Crop a specific cell from an image
  ipcMain.handle(
    "automation:crop-cell",
    async (
      _event,
      imageBase64: string,
      cellNumber: number,
      gridSize: number = 6,
      createSubGrid: boolean = true,
      subGridSize: number = 6,
      debug: boolean = false
    ) => {
      try {
        // Convert base64 to blob
        const buffer = Buffer.from(imageBase64, "base64");
        const blob = new Blob([buffer], { type: "image/png" });

        const formData = new FormData();
        formData.append("image", blob, "screenshot.png");

        const params = new URLSearchParams({
          cell_number: cellNumber.toString(),
          grid_size: gridSize.toString(),
          create_sub_grid: createSubGrid.toString(),
          sub_grid_size: subGridSize.toString(),
          save_image: debug.toString(),
        });

        const response = await fetch(
          `${AUTOMATION_SERVER_URL}/image/crop-cell?${params}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to crop cell: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Get center coordinates of a grid cell
  ipcMain.handle(
    "automation:cell-center",
    async (
      _event,
      width: number,
      height: number,
      gridSize: number,
      cellNumber: number,
      offsetX: number = 0,
      offsetY: number = 0
    ) => {
      try {
        const params = new URLSearchParams({
          width: width.toString(),
          height: height.toString(),
          grid_size: gridSize.toString(),
          cell_number: cellNumber.toString(),
          offset_x: offsetX.toString(),
          offset_y: offsetY.toString(),
        });

        const response = await fetch(
          `${AUTOMATION_SERVER_URL}/grid/cell-center?${params}`
        );

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to get cell center: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Move mouse to position
  ipcMain.handle(
    "automation:mouse-move",
    async (_event, x: number, y: number, durationMs: number = 100) => {
      try {
        const response = await fetch(`${AUTOMATION_SERVER_URL}/mouse/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x, y, duration_ms: durationMs }),
        });

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to move mouse: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Click mouse
  ipcMain.handle(
    "automation:mouse-click",
    async (
      _event,
      button: "left" | "right" | "middle" = "left",
      clicks: number = 1,
      delayMs: number = 0
    ) => {
      try {
        const response = await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ button, clicks, delay_ms: delayMs }),
        });

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to click mouse: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Type text
  ipcMain.handle(
    "automation:keyboard-type",
    async (_event, text: string, intervalMs: number = 0, delayMs: number = 0) => {
      try {
        const response = await fetch(`${AUTOMATION_SERVER_URL}/keyboard/type`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, interval_ms: intervalMs, delay_ms: delayMs }),
        });

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to type text: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Press key
  ipcMain.handle(
    "automation:keyboard-press",
    async (_event, key: string, delayMs: number = 0) => {
      try {
        const response = await fetch(`${AUTOMATION_SERVER_URL}/keyboard/press`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, delay_ms: delayMs }),
        });

        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Failed to press key: ${error}` };
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );
}
