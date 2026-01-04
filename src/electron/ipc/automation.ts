/**
 * IPC handlers for automation server communication
 * Runs in main process to avoid CSP restrictions
 */

import { ipcMain, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { ASK_IMAGE } from "../services/model.js";
import { LOG } from "../utils/logging.js";

const TAG = "automation";
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
          delay_ms: 0
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
        
        const doneMessage = actionType === "click" 
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
            actionData
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

  // ====================================================================
  // Orchestrated Workflow Handler (Multi-step Agent)
  // ====================================================================
  ipcMain.handle(
    "automation:execute-orchestrated-workflow",
    async (
      event,
      apiKey: string,
      userPrompt: string,
      imageModelOverride?: string,
      debug: boolean = false
    ) => {
      const sendProgress = (step: string, message: string) => {
        event.sender.send("automation:status", { step, message });
      };

      const sendLog = (
        type: "server" | "llm-request" | "llm-response" | "thinking" | "error",
        title: string,
        content: string
      ) => {
        event.sender.send("automation:log", { type, title, content });
      };

      const sendImagePreview = (title: string, imageBase64: string) => {
        event.sender.send("automation:image-preview", { title, imageBase64 });
      };

      const window = BrowserWindow.fromWebContents(event.sender);

      try {
        LOG(TAG).INFO(`Starting workflow: "${userPrompt}"`);
        sendProgress("starting", `Analyzing request: "${userPrompt}"`);

        // Step 1: Take initial screenshot for context validation and planning
        window?.hide();
        await new Promise((resolve) => setTimeout(resolve, 300));

        const screenshotResponse = await fetch(
          `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?grid_size=6&save_image=${debug}`
        );

        if (!screenshotResponse.ok) {
          throw new Error("Failed to capture initial screenshot");
        }

        const screenshot = await screenshotResponse.json();
        LOG(TAG).INFO(`Screenshot captured: ${screenshot.image_size?.width}x${screenshot.image_size?.height}`);
        // NOTE: Do NOT show window here - keep it hidden during planning
        // Window will be shown only after plan is complete, before executing steps

        if (debug) {
          sendImagePreview("Initial Screenshot", screenshot.grid_image_base64);
        }

        // Step 2: Ask LLM to validate context and generate plan
        LOG(TAG).INFO(`Generating execution plan...`);
        sendProgress("planning", "Generating execution plan...");

        const planPrompt = createPlanGenerationPrompt(userPrompt);
        const planResult = await askLLMForPlanWithLogging(
          apiKey,
          screenshot.original_image_base64,
          planPrompt,
          imageModelOverride,
          sendLog
        );

        // Check for context validation error
        if (planResult.error) {
          LOG(TAG).ERROR(`Context Error: ${planResult.error}`);
          sendLog("error", "Context Error", planResult.error);
          return {
            success: false,
            error: planResult.error,
            reason: planResult.reason,
          };
        }

        const steps = planResult.steps || [];
        
        // Validate step count
        if (steps.length === 0) {
          throw new Error("No steps generated for the request");
        }
        
        if (steps.length > MAX_ORCHESTRATOR_STEPS) {
          sendLog(
            "error",
            "Too Many Steps",
            `Plan requires ${steps.length} steps, max allowed is ${MAX_ORCHESTRATOR_STEPS}`
          );
          return {
            success: false,
            error: `Request requires ${steps.length} steps, but maximum is ${MAX_ORCHESTRATOR_STEPS}. Please simplify your request.`,
          };
        }

        sendLog(
          "llm-response",
          "Execution Plan",
          steps.map((s: OrchestratorStep, i: number) => `${i + 1}. ${s.action}: ${s.target || s.data || ""} - ${s.reason}`).join("\n")
        );

        LOG(TAG).INFO(`Plan generated with ${steps.length} steps:`);
        steps.forEach((s: OrchestratorStep, i: number) => {
          LOG(TAG).INFO(`  ${i + 1}. ${s.action}: ${s.target || s.data || ""} - ${s.reason}`);
        });

        // NOTE: Window stays hidden throughout the entire workflow
        // Only shown at the very end after all steps complete

        // Step 3: Execute each step
        const stepResults: Array<{ step: number; action: string; success: boolean; result?: any }> = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i] as OrchestratorStep;
          LOG(TAG).INFO(`Executing step ${i + 1}/${steps.length}: ${step.action} ${step.target || step.data || ""}`);
          sendProgress(`step-${i + 1}`, `Step ${i + 1}/${steps.length}: ${step.action} ${step.target || step.data || ""}`);

          try {
            if (step.action === "wait") {
              // Wait step - just delay
              const delayMs = parseInt(step.data || "1000", 10);
              sendLog("server", `Wait Step ${i + 1}`, `Waiting ${delayMs}ms`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              LOG(TAG).INFO(`Wait complete`);
              stepResults.push({ step: i + 1, action: "wait", success: true });
            } else if (step.action === "click") {
              // Click step - use vision click (window stays hidden)
              const clickResult = await executeVisionAction(
                event,
                apiKey,
                step.target || "",
                "double", // Use double-click for focus
                imageModelOverride,
                debug,
                "click",
                undefined,
                sendProgress,
                sendLog,
                sendImagePreview,
                true // keepHidden - don't show window after action
              );
              LOG(TAG).INFO(`Click result: ${clickResult.success ? 'success' : 'failed'} at (${clickResult.data?.coordinates?.x}, ${clickResult.data?.coordinates?.y})`);
              stepResults.push({ step: i + 1, action: "click", success: clickResult.success, result: clickResult });
              if (!clickResult.success) {
                throw new Error(`Click failed: ${clickResult.error}`);
              }
            } else if (step.action === "type") {
              // Type step - find input and type (window stays hidden)
              const typeResult = await executeVisionAction(
                event,
                apiKey,
                step.target || "text input field",
                "double",
                imageModelOverride,
                debug,
                "type",
                step.data || "",
                sendProgress,
                sendLog,
                sendImagePreview,
                true // keepHidden - don't show window after action
              );
              LOG(TAG).INFO(`Type result: ${typeResult.success ? 'success' : 'failed'} - typed "${step.data}"`);
              stepResults.push({ step: i + 1, action: "type", success: typeResult.success, result: typeResult });
              if (!typeResult.success) {
                throw new Error(`Type failed: ${typeResult.error}`);
              }
            } else if (step.action === "press") {
              // Press step - press key directly (window is already hidden)
              const keyToPress = step.data || "enter";
              sendLog("server", `Press Key Step ${i + 1}`, `Pressing: ${keyToPress}`);
              
              const pressResponse = await fetch(`${AUTOMATION_SERVER_URL}/keyboard/press`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: keyToPress, delay_ms: 0 }),
              });
              
              const pressSuccess = pressResponse.ok;
              LOG(TAG).INFO(`Press result: ${pressSuccess ? 'success' : 'failed'} - pressed "${keyToPress}"`);
              stepResults.push({ step: i + 1, action: "press", success: pressSuccess });
              
              if (!pressSuccess) {
                throw new Error(`Press failed: ${await pressResponse.text()}`);
              }
            }

            // Add delay between steps (except after wait steps)
            if (step.action !== "wait" && i < steps.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
          } catch (stepError) {
            const errorMessage = stepError instanceof Error ? stepError.message : "Unknown error";
            LOG(TAG).ERROR(`Step ${i + 1} failed: ${errorMessage}`);
            sendLog("error", `Step ${i + 1} Failed`, errorMessage);
            window?.show();
            return {
              success: false,
              error: `Step ${i + 1} failed: ${errorMessage}`,
              stepsCompleted: i,
              totalSteps: steps.length,
              results: stepResults,
            };
          }
        }

        window?.show();
        LOG(TAG).INFO(`Workflow completed successfully with ${steps.length} steps`);
        sendProgress("done", `Completed ${steps.length} steps successfully`);

        return {
          success: true,
          stepsCompleted: steps.length,
          totalSteps: steps.length,
          results: stepResults,
        };
      } catch (error) {
        window?.show();
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        sendLog("error", "Orchestration Failed", errorMessage);
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
const MAX_ORCHESTRATOR_STEPS = 6;

// Orchestrator step types
interface OrchestratorStep {
  action: "click" | "type" | "press" | "wait";
  target?: string;  // Element description for click
  data?: string;    // Text to type, key to press, or delay in ms
  reason: string;   // LLM's explanation
}

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


/**
 * Prompt for orchestrator plan generation
 */
const createPlanGenerationPrompt = (userPrompt: string) => `You are a browser automation assistant. Given the user's request and a screenshot of their screen, generate a step-by-step plan to achieve the goal.

User request: "${userPrompt}"

FIRST, check if the required app/website is visible on screen. For example:
- If user wants to search on YouTube, is a browser with YouTube visible?
- If user wants to write an email, is an email app/website visible?

If the required context is NOT visible, respond with:
{"error": "Target not visible", "reason": "explanation of what's missing"}

If the context IS correct, return a JSON object with a "steps" array:
{
  "steps": [
    {"action": "click", "target": "element description", "reason": "why this step"},
    {"action": "type", "target": "input field description", "data": "text to type", "reason": "why"},
    {"action": "press", "data": "enter", "reason": "submit the form"},
    {"action": "wait", "data": "2000", "reason": "wait for page to load"}
  ]
}

Rules:
- Use "click" to click on elements - describe the element clearly
- Use "type" to enter text - specify target input and data to type
- Use "press" for keyboard keys (enter, tab, escape, backspace, up, down, left, right, space)
- Use "wait" for delays (specify ms, typically 1500-2000 for page loads)
- Add wait steps after actions that trigger page loads
- Keep plans simple - maximum ${MAX_ORCHESTRATOR_STEPS} steps
- For typing in search boxes: click the input, then use a separate type step
- IMPORTANT: After typing in a search box or input field, ALWAYS use "press" with "enter" to submit - do NOT click a search button. Pressing Enter is faster and more reliable.

Respond with ONLY the JSON object, no other text.`;

/**
 * Ask LLM to generate execution plan with logging
 */
async function askLLMForPlanWithLogging(
  apiKey: string,
  imageBase64: string,
  prompt: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<{ steps?: OrchestratorStep[]; error?: string; reason?: string }> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `orchestrator-plan-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    let responseContent = "";
    let thinkingContent = "";

    sendLog("llm-request", "Plan Generation", "Asking LLM to analyze screenshot and create plan...");

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
      }
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    if (thinkingContent) {
      sendLog("thinking", "Model Thinking", thinkingContent);
    }

    // Parse JSON from response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog("error", "Parse Error", `Could not parse LLM response: ${responseContent}`);
      throw new Error(`Could not parse plan response: ${responseContent}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

/**
 * Execute a vision-based action (click, type, or press)
 * @param keepHidden - If true, don't show window after action (for orchestrated workflows)
 */
async function executeVisionAction(
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
