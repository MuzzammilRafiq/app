/**
 * Vision automation handlers
 * Handles vision-based click, type, and press operations (used by orchestrator)
 */

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
  keepHidden: boolean = false,
  existingScreenshot?: {
    original_image_base64: string;
    grid_image_base64: string;
    scale_factor: number;
  },
  signal?: AbortSignal,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    // Use existing screenshot if provided (from orchestrator), otherwise take a new one
    let screenshot: {
      original_image_base64: string;
      grid_image_base64: string;
      scale_factor: number;
    };

    if (existingScreenshot) {
      screenshot = existingScreenshot;
    } else {
      // Take screenshot only when called standalone (not from orchestrator)
      const params = new URLSearchParams({
        grid_size: "6",
        save_image: debug.toString(),
      });

      const screenshotResponse = await fetch(
        `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?${params}`,
      );

      if (!screenshotResponse.ok) {
        throw new Error("Failed to capture screenshot");
      }

      screenshot = await screenshotResponse.json();

      if (debug) {
        sendImagePreview(
          `Screenshot for: ${targetDescription}`,
          screenshot.grid_image_base64,
        );
      }
    }

    // NOTE: Do NOT show window here - keep it hidden to maintain focus on the target app
    // Window will be shown only after ALL actions complete to prevent focus shift issues

    // First LLM analysis - pass BOTH clean and grid images
    const firstPrompt = createCellIdentificationPrompt(
      targetDescription,
      false,
    );
    const firstResult = await askLLMForCellWithLogging(
      apiKey,
      screenshot.original_image_base64, // Clean image
      screenshot.grid_image_base64, // Grid image
      firstPrompt,
      targetDescription,
      imageModelOverride,
      sendLog,
      signal,
    );

    // Handle not_found/ambiguous status - return early and let planner decide
    if (
      firstResult.status === "not_found" ||
      firstResult.status === "ambiguous"
    ) {
      return {
        success: false,
        error: firstResult.reason,
        data: {
          status: firstResult.status,
          suggestion: firstResult.suggested_retry,
          firstPass: firstResult,
        },
      };
    }

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
      { method: "POST", body: formData },
    );

    if (!cropResponse.ok) {
      throw new Error("Failed to crop cell");
    }

    const cropped = await cropResponse.json();

    if (debug) {
      sendImagePreview("Cropped Cell", cropped.cropped_image_base64);
    }

    // Second LLM analysis - pass BOTH clean and grid cropped images
    const secondPrompt = createCellIdentificationPrompt(
      targetDescription,
      true,
    );
    const secondResult = await askLLMForCellWithLogging(
      apiKey,
      cropped.clean_cropped_image_base64, // Clean cropped image
      cropped.cropped_image_base64, // Grid cropped image
      secondPrompt,
      targetDescription,
      imageModelOverride,
      sendLog,
      signal,
    );

    // Handle not_found/ambiguous in second pass (sub-grid refinement)
    if (
      secondResult.status === "not_found" ||
      secondResult.status === "ambiguous"
    ) {
      return {
        success: false,
        error: `Refinement failed: ${secondResult.reason}`,
        data: {
          status: secondResult.status,
          suggestion: secondResult.suggested_retry,
          firstPass: firstResult,
          secondPass: secondResult,
        },
      };
    }

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
      `${AUTOMATION_SERVER_URL}/grid/cell-center?${centerParams}`,
    );

    if (!centerResponse.ok) {
      throw new Error("Failed to calculate center");
    }

    const cellCenter = await centerResponse.json();

    // Adjust for DPI
    const scaleFactor = screenshot.scale_factor || 1;
    const screenX = Math.round(cellCenter.x / scaleFactor);
    const screenY = Math.round(cellCenter.y / scaleFactor);

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

    return {
      success: true,
      data: {
        coordinates: { x: screenX, y: screenY },
        firstCell: firstResult,
        secondCell: secondResult,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
