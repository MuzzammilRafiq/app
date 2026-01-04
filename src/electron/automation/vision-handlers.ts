/**
 * Vision automation handlers
 * Handles vision-based click, type, and press operations
 */

import { ipcMain, BrowserWindow } from "electron";
import { AUTOMATION_SERVER_URL } from "./types.js";
import {
  askLLMForCellWithLogging,
  createCellIdentificationPrompt,
} from "./llm-helpers.js";
import type { SendLogFn } from "./types.js";

/**
 * Execute a vision-based action (click, type, or press)
 * @param keepHidden - If true, don't show window after action (for orchestrated workflows)
 */
export async function executeVisionAction(
  event: Electron.IpcMainInvokeEvent,
  apiKey: string,
  targetDescription: string,
  clickType: "left" | "right" | "double",
  imageModelOverride: string | undefined,
  debug: boolean,
  actionType: "click" | "type" | "press",
  actionData: string | undefined,
  sendProgress: (step: string, message: string) => void,
  sendLog: SendLogFn,
  sendImagePreview: (title: string, imageBase64: string) => void,
  keepHidden: boolean = false
): Promise<{ success: boolean; error?: string; data?: any }> {
  const window = BrowserWindow.fromWebContents(event.sender);

  try {
    // Hide window and take screenshot
    window?.hide();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const params = new URLSearchParams({
      grid_size: "6",
      save_image: debug.toString(),
    });

    const screenshotResponse = await fetch(
      `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?${params}`
    );

    if (!screenshotResponse.ok) {
      throw new Error("Failed to capture screenshot");
    }

    const screenshot = await screenshotResponse.json();

    if (debug) {
      sendImagePreview(`Screenshot for: ${targetDescription}`, screenshot.grid_image_base64);
    }

    // NOTE: Do NOT show window here - keep it hidden to maintain focus on the target app
    // Window will be shown only after ALL actions complete to prevent focus shift issues

    // First LLM analysis
    const firstPrompt = createCellIdentificationPrompt(targetDescription, false);
    const firstResult = await askLLMForCellWithLogging(
      apiKey,
      screenshot.grid_image_base64,
      firstPrompt,
      targetDescription,
      imageModelOverride,
      sendLog
    );

    // Crop and create sub-grid
    const imgBuffer = Buffer.from(screenshot.original_image_base64, "base64");
    const formData = new FormData();
    const imgBlob = new Blob([imgBuffer], { type: "image/png" });
    formData.append("image", imgBlob, "screenshot.png");

    const cropParams = new URLSearchParams({
      cell_number: firstResult.cell.toString(),
      grid_size: "6",
      create_sub_grid: "true",
      sub_grid_size: "6",
      save_image: debug.toString(),
    });

    const cropResponse = await fetch(
      `${AUTOMATION_SERVER_URL}/image/crop-cell?${cropParams}`,
      { method: "POST", body: formData }
    );

    if (!cropResponse.ok) {
      throw new Error("Failed to crop cell");
    }

    const cropped = await cropResponse.json();

    if (debug) {
      sendImagePreview("Cropped Cell", cropped.cropped_image_base64);
    }

    // Second LLM analysis
    const secondPrompt = createCellIdentificationPrompt(targetDescription, true);
    const secondResult = await askLLMForCellWithLogging(
      apiKey,
      cropped.cropped_image_base64,
      secondPrompt,
      targetDescription,
      imageModelOverride,
      sendLog
    );

    // Calculate coordinates
    const centerParams = new URLSearchParams({
      width: cropped.cell_bounds.width.toString(),
      height: cropped.cell_bounds.height.toString(),
      grid_size: "6",
      cell_number: secondResult.cell.toString(),
      offset_x: cropped.cell_bounds.x1.toString(),
      offset_y: cropped.cell_bounds.y1.toString(),
    });

    const centerResponse = await fetch(
      `${AUTOMATION_SERVER_URL}/grid/cell-center?${centerParams}`
    );

    if (!centerResponse.ok) {
      throw new Error("Failed to calculate center");
    }

    const cellCenter = await centerResponse.json();

    // Adjust for DPI
    const scaleFactor = screenshot.scale_factor || 1;
    const screenX = Math.round(cellCenter.x / scaleFactor);
    const screenY = Math.round(cellCenter.y / scaleFactor);

    // Window is already hidden from screenshot phase - keep it hidden for action
    // This prevents focus from shifting away during type/press operations

    // Move mouse
    await fetch(`${AUTOMATION_SERVER_URL}/mouse/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: screenX, y: screenY, duration_ms: 100 }),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click
    const clickBody = {
      button: clickType === "right" ? "right" : "left",
      clicks: clickType === "double" ? 2 : 1,
      delay_ms: 0,
    };

    await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clickBody),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Perform post-click action
    if (actionType === "type" && actionData) {
      // Double-click for focus
      await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ button: "left", clicks: 2, delay_ms: 0 }),
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Type text
      await fetch(`${AUTOMATION_SERVER_URL}/keyboard/type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: actionData, interval_ms: 0, delay_ms: 0 }),
      });
      sendLog("server", "Typed Text", `"${actionData}"`);
    } else if (actionType === "press" && actionData) {
      // Double-click for focus
      await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ button: "left", clicks: 2, delay_ms: 0 }),
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Press key
      await fetch(`${AUTOMATION_SERVER_URL}/keyboard/press`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: actionData, delay_ms: 0 }),
      });
      sendLog("server", "Pressed Key", actionData);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
    // Only show window if not in keepHidden mode (used by orchestrator)
    if (!keepHidden) {
      window?.show();
    }

    return {
      success: true,
      data: {
        coordinates: { x: screenX, y: screenY },
        firstCell: firstResult,
        secondCell: secondResult,
      },
    };
  } catch (error) {
    // Only show window on error if not in keepHidden mode
    if (!keepHidden) {
      window?.show();
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function setupVisionAutomationHandlers() {
  // Vision Click Automation (supports click, type, and press actions)
  ipcMain.handle(
    "automation:execute-vision-click",
    async (
      event,
      apiKey: string,
      targetDescription: string,
      clickType: "left" | "right" | "double",
      imageModelOverride?: string,
      debug: boolean = false,
      actionType: "click" | "type" | "press" = "click",
      actionData?: string // text to type or key to press
    ) => {
      // Helper to send progress updates
      const sendProgress = (step: string, message: string) => {
        event.sender.send("automation:status", { step, message });
      };

      // Helper to send detailed logs
      const sendLog: SendLogFn = (
        type: "server" | "llm-request" | "llm-response" | "thinking" | "error",
        title: string,
        content: string
      ) => {
        event.sender.send("automation:log", { type, title, content });
      };

      // Helper to send image previews (optional)
      const sendImagePreview = (title: string, imageBase64: string) => {
        event.sender.send("automation:image-preview", { title, imageBase64 });
      };

      try {
        // Step 1: Capturing screenshot
        sendProgress("capturing", "Hiding window and capturing screen...");

        // Hide window
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.hide();
        await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for hide animation

        // Take screenshot with grid
        const params = new URLSearchParams({
          grid_size: "6",
          save_image: debug.toString(),
        });

        sendLog("server", "Screenshot Request", `GET /screenshot/numbered-grid?${params}`);

        const screenshotResponse = await fetch(
          `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?${params}`
        );

        if (!screenshotResponse.ok) {
          const errorText = await screenshotResponse.text();
          sendLog("error", "Screenshot Failed", errorText);
          throw new Error(`Failed to capture screenshot: ${errorText}`);
        }

        const screenshot = await screenshotResponse.json();
        sendLog(
          "server",
          "Screenshot Response",
          `Received ${screenshot.width}x${screenshot.height} image, scale factor: ${screenshot.scale_factor}`
        );

        // Optional: Send image preview
        if (debug) {
          sendImagePreview("Screenshot with Grid", screenshot.grid_image_base64);
        }

        // NOTE: Do NOT show window here - keep it hidden to maintain focus on the target app
        // Window will be shown only after ALL actions complete to prevent focus shift issues
        sendProgress("analyzing-1", "Analyzing screenshot...");

        // Step 2: First LLM analysis
        const firstPrompt = createCellIdentificationPrompt(targetDescription, false);

        const firstResult = await askLLMForCellWithLogging(
          apiKey,
          screenshot.grid_image_base64,
          firstPrompt,
          targetDescription,
          imageModelOverride,
          sendLog
        );

        sendProgress("refining", `Found in cell ${firstResult.cell}: ${firstResult.reason}`);

        // Step 3: Crop and create sub-grid
        // Convert base64 to blob/buffer for upload
        const imgBuffer = Buffer.from(screenshot.original_image_base64, "base64");
        const formData = new FormData();
        // Node's fetch with FormData requires a file-like object or Blob.
        // Since we are in Node environment (Electron Main), we can construct a Blob
        const imgBlob = new Blob([imgBuffer], { type: "image/png" });
        formData.append("image", imgBlob, "screenshot.png");

        const cropParams = new URLSearchParams({
          cell_number: firstResult.cell.toString(),
          grid_size: "6", // GRID_SIZE
          create_sub_grid: "true",
          sub_grid_size: "6", // GRID_SIZE
          save_image: debug.toString(),
        });

        sendLog("server", "Crop Cell Request", `POST /image/crop-cell?${cropParams}`);

        const cropResponse = await fetch(
          `${AUTOMATION_SERVER_URL}/image/crop-cell?${cropParams}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!cropResponse.ok) {
          const errorText = await cropResponse.text();
          sendLog("error", "Crop Failed", errorText);
          throw new Error(`Failed to crop cell: ${errorText}`);
        }

        const cropped = await cropResponse.json();
        sendLog(
          "server",
          "Crop Response",
          `Cropped cell ${firstResult.cell}, bounds: ${JSON.stringify(cropped.cell_bounds)}`
        );

        // Optional: Send cropped image preview
        if (debug) {
          sendImagePreview("Cropped Cell with Sub-grid", cropped.cropped_image_base64);
        }

        // Step 4: Second LLM analysis on cropped region
        sendProgress("analyzing-2", "Analyzing zoomed area...");

        const secondPrompt = createCellIdentificationPrompt(targetDescription, true);

        const secondResult = await askLLMForCellWithLogging(
          apiKey,
          cropped.cropped_image_base64,
          secondPrompt,
          targetDescription,
          imageModelOverride,
          sendLog
        );

        sendProgress("clicking", `Refined to sub-cell ${secondResult.cell}. Clicking...`);

        // Step 5: Calculate final coordinates and click
        const centerParams = new URLSearchParams({
          width: cropped.cell_bounds.width.toString(),
          height: cropped.cell_bounds.height.toString(),
          grid_size: "6",
          cell_number: secondResult.cell.toString(),
          offset_x: cropped.cell_bounds.x1.toString(),
          offset_y: cropped.cell_bounds.y1.toString(),
        });

        sendLog("server", "Cell Center Request", `GET /grid/cell-center?${centerParams}`);

        const centerResponse = await fetch(
          `${AUTOMATION_SERVER_URL}/grid/cell-center?${centerParams}`
        );

        if (!centerResponse.ok) {
          const errorText = await centerResponse.text();
          sendLog("error", "Cell Center Failed", errorText);
          throw new Error(`Failed to calculate center: ${errorText}`);
        }

        const cellCenter = await centerResponse.json();
        sendLog("server", "Cell Center Response", `Center at (${cellCenter.x}, ${cellCenter.y})`);

        // Adjust for DPI scaling
        const scaleFactor = screenshot.scale_factor || 1;
        const screenX = Math.round(cellCenter.x / scaleFactor);
        const screenY = Math.round(cellCenter.y / scaleFactor);

        sendLog(
          "server",
          "DPI Adjustment",
          `Scale factor: ${scaleFactor}, Final position: (${screenX}, ${screenY})`
        );

        // Window is already hidden from screenshot phase - keep it hidden for action
        // This prevents focus from shifting away during type/press operations

        // Move mouse
        sendLog("server", "Mouse Move", `Moving to (${screenX}, ${screenY})`);
        await fetch(`${AUTOMATION_SERVER_URL}/mouse/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: screenX, y: screenY, duration_ms: 100 }),
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Click mouse based on type
        const clickBody = {
          button: clickType === "right" ? "right" : "left",
          clicks: clickType === "double" ? 2 : 1,
          delay_ms: 0,
        };

        sendLog("server", "Mouse Click", `${clickType} click at (${screenX}, ${screenY})`);
        await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clickBody),
        });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Perform post-click action based on actionType
        let actionResult = "";
        if (actionType === "type" && actionData) {
          // For typing: do a double-click RIGHT BEFORE typing to ensure focus on macOS
          sendLog("server", "Focus Click", `Double-click to activate input field`);
          await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ button: "left", clicks: 2, delay_ms: 0 }),
          });
          await new Promise((resolve) => setTimeout(resolve, 150));

          // Now type immediately while still focused
          sendLog("server", "Keyboard Type", `Typing: "${actionData}"`);
          await fetch(`${AUTOMATION_SERVER_URL}/keyboard/type`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: actionData, interval_ms: 0, delay_ms: 0 }),
          });
          actionResult = `Typed: "${actionData}"`;
        } else if (actionType === "press" && actionData) {
          // For key press: do a double-click RIGHT BEFORE pressing to ensure focus
          sendLog("server", "Focus Click", `Double-click to activate input field`);
          await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ button: "left", clicks: 2, delay_ms: 0 }),
          });
          await new Promise((resolve) => setTimeout(resolve, 150));

          // Now press key immediately
          sendLog("server", "Keyboard Press", `Pressing key: ${actionData}`);
          await fetch(`${AUTOMATION_SERVER_URL}/keyboard/press`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: actionData, delay_ms: 0 }),
          });
          actionResult = `Pressed: ${actionData}`;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        window?.show();

        const doneMessage =
          actionType === "click"
            ? `Clicked at (${screenX}, ${screenY})`
            : `Clicked at (${screenX}, ${screenY}). ${actionResult}`;
        sendProgress("done", doneMessage);

        return {
          success: true,
          data: {
            firstCell: firstResult,
            secondCell: secondResult,
            coordinates: { x: screenX, y: screenY },
            actionType,
            actionData,
          },
        };
      } catch (error) {
        // Ensure window is shown on error
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.show();

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        sendLog("error", "Vision Click Failed", errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );
}
