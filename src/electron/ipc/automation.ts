/**
 * IPC handlers for automation server communication
 * Runs in main process to avoid CSP restrictions
 */

import { ipcMain, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { ASK_IMAGE } from "../services/model.js";

const AUTOMATION_SERVER_URL = "http://localhost:8000";

export function setupAutomationHandlers() {
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

  // Vision Click Automation
  ipcMain.handle(
    "automation:execute-vision-click",
    async (
      event,
      apiKey: string,
      targetDescription: string,
      clickType: "left" | "right" | "double",
      imageModelOverride?: string,
      debug: boolean = false
    ) => {
      // Helper to send progress updates
      const sendProgress = (step: string, message: string) => {
        event.sender.send("automation:status", { step, message });
      };

      // Helper to send detailed logs
      const sendLog = (
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
        sendLog("server", "Screenshot Response", `Received ${screenshot.width}x${screenshot.height} image, scale factor: ${screenshot.scale_factor}`);
        
        // Optional: Send image preview
        if (debug) {
          sendImagePreview("Screenshot with Grid", screenshot.grid_image_base64);
        }
        
        // Show window briefly? No, keep hidden for smooth experience, or show for feedback?
        // Original logic showed it. Let's show it for feedback.
        window?.show();
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
        sendLog("server", "Crop Response", `Cropped cell ${firstResult.cell}, bounds: ${JSON.stringify(cropped.cell_bounds)}`);
        
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
        
        sendLog("server", "DPI Adjustment", `Scale factor: ${scaleFactor}, Final position: (${screenX}, ${screenY})`);

        // Hide window, move and click
        window?.hide();
        await new Promise((resolve) => setTimeout(resolve, 200));

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
          delay_ms: 0
        };

        sendLog("server", "Mouse Click", `${clickType} click at (${screenX}, ${screenY})`);
        await fetch(`${AUTOMATION_SERVER_URL}/mouse/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clickBody),
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
        window?.show();
        
        sendProgress("done", `Clicked at (${screenX}, ${screenY})`);
        
        return { 
          success: true, 
          data: { 
            firstCell: firstResult, 
            secondCell: secondResult, 
            coordinates: { x: screenX, y: screenY } 
          } 
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

// Helper functions (Not exported)

const GRID_SIZE = 6;

async function askLLMForCell(
  apiKey: string,
  imageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride?: string
): Promise<{ cell: number; confidence: string; reason: string }> {
  
  // Save base64 to temp file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `vision-click-${Date.now()}.png`);
  
  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    let responseContent = "";
    // Use ASK_IMAGE which is already imported from model.js (should be added to imports if not present)
    // Note: We need to ensure ASK_IMAGE is imported. The previous tool verified ASK_IMAGE is in ../services/model.js
    // I will add the import at the top if missing, but for this replacement, I assume it's available or I'll add it in a separate edit if I can't access top of file easily.
    // Wait, the file view showed imports at top, I need to make sure I add ASK_IMAGE to imports.
    // Since this is a replacement chunk, I'll need to update imports in a separate call or check if I can include it here.
    // I can't edit imports with this chunk target. I will do imports update in next step.

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    // Parse JSON
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse LLM response: ${responseContent}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Check if element was not found (cell: 0)
    if (parsed.cell === 0) {
      throw new Error(`Element not found: ${parsed.reason || `No element matching "${targetDescription}" was found on the screen`}`);
    }
    
    if (
      typeof parsed.cell !== "number" ||
      parsed.cell < 1 ||
      parsed.cell > GRID_SIZE * GRID_SIZE
    ) {
      throw new Error(`Invalid cell number: ${parsed.cell}`);
    }

    return parsed;

  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

// Type for the sendLog callback
type SendLogFn = (
  type: "server" | "llm-request" | "llm-response" | "thinking" | "error",
  title: string,
  content: string
) => void;

/**
 * askLLMForCell variant that logs streaming responses in real-time
 */
async function askLLMForCellWithLogging(
  apiKey: string,
  imageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<{ cell: number; confidence: string; reason: string }> {
  
  // Save base64 to temp file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `vision-click-${Date.now()}.png`);
  
  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    let responseContent = "";
    let thinkingContent = "";

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
      // Check for reasoning/thinking content (some models return this)
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
        // Only log thinking once at the end, not during streaming
      }
      
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    // Log thinking content if present (only once, after completion)
    if (thinkingContent) {
      sendLog("thinking", "Model Thinking", thinkingContent);
    }

    // Parse JSON
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog("error", "Parse Error", `Could not parse LLM response: ${responseContent}`);
      throw new Error(`Could not parse LLM response: ${responseContent}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Log the parsed response in a pretty format
    const prettyResponse = `Cell: ${parsed.cell}\nConfidence: ${parsed.confidence}\nReason: ${parsed.reason}`;
    sendLog("llm-response", "LLM Response", prettyResponse);
    
    // Check if element was not found (cell: 0)
    if (parsed.cell === 0) {
      const errMsg = `Element not found: ${parsed.reason || `No element matching "${targetDescription}" was found on the screen`}`;
      sendLog("error", "Element Not Found", errMsg);
      throw new Error(errMsg);
    }
    
    if (
      typeof parsed.cell !== "number" ||
      parsed.cell < 1 ||
      parsed.cell > GRID_SIZE * GRID_SIZE
    ) {
      const errMsg = `Invalid cell number: ${parsed.cell}`;
      sendLog("error", "Invalid Response", errMsg);
      throw new Error(errMsg);
    }

    return parsed;

  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

const createCellIdentificationPrompt = (
  targetDescription: string,
  isRefinement: boolean = false
) => `You are a vision assistant that identifies UI elements in screenshots with numbered grid overlays.

The image shows a ${isRefinement ? "zoomed-in section of the screen" : "full screen"} divided into a ${GRID_SIZE}x${GRID_SIZE} grid with numbered cells (1-${GRID_SIZE * GRID_SIZE}).

The user wants to click on: "${targetDescription}"

Analyze the image and identify which numbered cell contains the target element. Consider:
1. Look for text labels, icons, or UI elements matching the description
2. If the element spans multiple cells, you can pick ANY cell that contains part of the element - any choice is valid
3. If you cannot find anything matching the description on the screen, respond with cell: 0

IMPORTANT: Only respond with cell: 0 if you are certain the requested element does NOT exist on the screen. Do not guess or pick a random cell if you're unsure.

Respond with ONLY a JSON object in this exact format:
{"cell": <number>, "confidence": "<high|medium|low|none>", "reason": "<brief explanation>"}

Example responses:
{"cell": 15, "confidence": "high", "reason": "Found 'Settings' button in cell 15"}
{"cell": 7, "confidence": "medium", "reason": "Blue button visible in cell 7, likely the target"}
{"cell": 0, "confidence": "none", "reason": "No element matching '${targetDescription}' found on the screen"}`;

