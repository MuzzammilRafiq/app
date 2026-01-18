import { askLLMForCellWithLogging } from "./llm-helpers.js";
import type { SendLogFn } from "./utils.js";
import { createCellIdentificationPrompt } from "./prompts.js";
import { CHECK_ABORT } from "../utils/helper-functions.js";
import {
  cropCell,
  getCenterCell,
  moveMouseAndClick,
  takeScreenshot,
  typeText,
} from "./route.js";

export async function executeVisionAction(
  apiKey: string,
  targetDescription: string,
  clickType: "left" | "right" | "double",
  imageModelOverride: string | undefined,
  actionType: "click" | "type" | "press",
  actionData: string | undefined,
  sendLog: SendLogFn,
  sendImagePreview: (title: string, imageBase64: string) => void,
  controller: AbortController,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    CHECK_ABORT(controller);
    const screenshot = await takeScreenshot();

    const firstPrompt = createCellIdentificationPrompt(
      targetDescription,
      false,
    );
    const firstResult = await askLLMForCellWithLogging(
      apiKey,
      screenshot.original_image_base64,
      screenshot.grid_image_base64,
      firstPrompt,
      targetDescription,
      imageModelOverride,
      sendLog,
      controller,
    );

    CHECK_ABORT(controller);

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
    const cropped = await cropCell(
      firstResult.cell.toString(),
      screenshot.original_image_base64,
    );

    CHECK_ABORT(controller);

    sendImagePreview("Cropped Cell", cropped.cropped_image_base64);

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
      controller,
    );

    CHECK_ABORT(controller);

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

    const cellCenter = await getCenterCell(cropped, secondResult);

    // Adjust for DPI
    const scaleFactor = screenshot.scale_factor || 1;
    const screenX = Math.round(cellCenter.x / scaleFactor);
    const screenY = Math.round(cellCenter.y / scaleFactor);

    // Move mouse and click
    await moveMouseAndClick(clickType, screenX, screenY);

    if (actionType === "type" && actionData) {
      await typeText(actionData);
      sendLog("server", "Typed Text", `"${actionData}"`);
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
