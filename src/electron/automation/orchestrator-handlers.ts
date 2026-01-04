/**
 * Orchestrator handlers
 * Handles multi-step automated workflows
 */

import { ipcMain, BrowserWindow } from "electron";
import { AUTOMATION_SERVER_URL, MAX_ORCHESTRATOR_STEPS } from "./types.js";
import {
  askLLMForPlanWithLogging,
} from "./llm-helpers.js";
import { executeVisionAction } from "./vision-handlers.js";
import { LOG } from "../utils/logging.js";
import type { OrchestratorStep, SendLogFn } from "./types.js";

const TAG = "automation";

export function setupOrchestratorHandlers() {
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

      const sendLog: SendLogFn = (
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

        // Take full-screen screenshot for planning
        const screenshotResponse = await fetch(
          `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?grid_size=6&save_image=${debug}`
        );

        if (!screenshotResponse.ok) {
          throw new Error("Failed to capture initial screenshot");
        }

        const screenshot = await screenshotResponse.json();
        LOG(TAG).INFO(
          `Screenshot captured: ${screenshot.image_size?.width}x${screenshot.image_size?.height}`
        );

        if (debug) {
          sendImagePreview("Initial Screenshot", screenshot.grid_image_base64);
        }

        // Step 2: Ask LLM to validate context and generate plan
        LOG(TAG).INFO(`Generating execution plan...`);
        sendProgress("planning", "Generating execution plan...");

        const planResult = await askLLMForPlanWithLogging(
          apiKey,
          screenshot.original_image_base64,
          userPrompt,
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
          steps
            .map(
              (s: OrchestratorStep, i: number) =>
                `${i + 1}. ${s.action}: ${s.target || s.data || ""} - ${s.reason}`
            )
            .join("\n")
        );

        LOG(TAG).INFO(`Plan generated with ${steps.length} steps:`);
        steps.forEach((s: OrchestratorStep, i: number) => {
          LOG(TAG).INFO(`  ${i + 1}. ${s.action}: ${s.target || s.data || ""} - ${s.reason}`);
        });

        // NOTE: In vision mode, window stays visible in the right 1/4 of screen
        // No need to show/hide - we use region-based screenshots

        // Step 3: Execute each step
        const stepResults: Array<{ step: number; action: string; success: boolean; result?: any }> =
          [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i] as OrchestratorStep;
          LOG(TAG).INFO(
            `Executing step ${i + 1}/${steps.length}: ${step.action} ${step.target || step.data || ""}`
          );
          sendProgress(
            `step-${i + 1}`,
            `Step ${i + 1}/${steps.length}: ${step.action} ${step.target || step.data || ""}`
          );

          try {
            if (step.action === "wait") {
              // Wait step - just delay
              const delayMs = parseInt(step.data || "1000", 10);
              sendLog("server", `Wait Step ${i + 1}`, `Waiting ${delayMs}ms`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              LOG(TAG).INFO(`Wait complete`);
              stepResults.push({ step: i + 1, action: "wait", success: true });
            } else if (step.action === "click") {
              // Click step - use vision click
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
              LOG(TAG).INFO(
                `Click result: ${clickResult.success ? "success" : "failed"} at (${clickResult.data?.coordinates?.x}, ${clickResult.data?.coordinates?.y})`
              );
              stepResults.push({
                step: i + 1,
                action: "click",
                success: clickResult.success,
                result: clickResult,
              });
              if (!clickResult.success) {
                throw new Error(`Click failed: ${clickResult.error}`);
              }
            } else if (step.action === "type") {
              // Type step - find input and type
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
              LOG(TAG).INFO(
                `Type result: ${typeResult.success ? "success" : "failed"} - typed "${step.data}"`
              );
              stepResults.push({
                step: i + 1,
                action: "type",
                success: typeResult.success,
                result: typeResult,
              });
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
              LOG(TAG).INFO(
                `Press result: ${pressSuccess ? "success" : "failed"} - pressed "${keyToPress}"`
              );
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
            return {
              success: false,
              error: `Step ${i + 1} failed: ${errorMessage}`,
              stepsCompleted: i,
              totalSteps: steps.length,
              results: stepResults,
            };
          }
        }

        LOG(TAG).INFO(`Workflow completed successfully with ${steps.length} steps`);
        sendProgress("done", `Completed ${steps.length} steps successfully`);

        return {
          success: true,
          stepsCompleted: steps.length,
          totalSteps: steps.length,
          results: stepResults,
        };
      } catch (error) {
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
