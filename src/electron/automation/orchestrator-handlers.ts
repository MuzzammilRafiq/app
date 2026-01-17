/**
 * Orchestrator handlers
 * Handles multi-step automated workflows with dynamic execution and verification
 */

import { ipcMain, BrowserWindow } from "electron";
import crypto from "node:crypto";
import {
  AUTOMATION_SERVER_URL,
  DEFAULT_ORCHESTRATOR_CONFIG,
  type ExecutionContext,
  type ActionHistoryEntry,
  type SendLogFn,
} from "./types.js";
import {
  askLLMForContextualPlan,
  askLLMForNextAction,
  askLLMForVerification,
} from "./llm-helpers.js";
import { executeVisionAction } from "./vision-handlers.js";
import { LOG } from "../utils/logging.js";

const TAG = "orchestrator";

/**
 * Takes a screenshot and returns the base64 image data
 */
async function takeScreenshot(debug: boolean): Promise<{
  original_image_base64: string;
  grid_image_base64: string;
  scale_factor: number;
}> {
  const response = await fetch(
    `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?grid_size=6&save_image=${debug}`,
  );
  if (!response.ok) {
    throw new Error("Failed to capture screenshot");
  }
  return response.json();
}

/**
 * Execute a wait action
 */
async function executeWait(ms: number, sendLog: SendLogFn): Promise<void> {
  sendLog("server", "Wait", `Waiting ${ms}ms...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a press key action
 */
async function executePress(key: string, sendLog: SendLogFn): Promise<boolean> {
  sendLog("server", "Press Key", `Pressing: ${key}`);
  const response = await fetch(`${AUTOMATION_SERVER_URL}/keyboard/press`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, delay_ms: 0 }),
  });
  return response.ok;
}

/**
 * Execute a scroll action
 * @param direction - "up" or "down"
 * @param pixels - optional pixel amount (default 300)
 */
async function executeScroll(
  direction: "up" | "down",
  pixels: number,
  sendLog: SendLogFn,
): Promise<boolean> {
  sendLog("server", "Scroll", `Scrolling ${direction} by ${pixels}px...`);

  // Use mouse scroll endpoint if available, fallback to keyboard
  try {
    // Try to use mouse scroll (more natural)
    const scrollAmount = direction === "up" ? -pixels : pixels;
    const response = await fetch(`${AUTOMATION_SERVER_URL}/mouse/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delta_x: 0,
        delta_y: scrollAmount,
        duration_ms: 100,
      }),
    });

    if (response.ok) {
      return true;
    }
  } catch {
    // Fallback to keyboard if mouse scroll not available
  }

  // Fallback: Use Page Up/Down keys
  const key = direction === "up" ? "pageup" : "pagedown";
  const response = await fetch(`${AUTOMATION_SERVER_URL}/keyboard/press`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, delay_ms: 0 }),
  });
  return response.ok;
}

const activeVisionRuns = new Map<string, AbortController>();

export function setupOrchestratorHandlers() {
  // ====================================================================
  // Robust Orchestrated Workflow Handler (Dynamic Multi-step Agent)
  // ====================================================================
  ipcMain.handle(
    "automation:execute-orchestrated-workflow",
    async (
      event,
      apiKey: string,
      userPrompt: string,
      imageModelOverride?: string,
      debug: boolean = false,
      runId?: string,
    ) => {
      const config = { ...DEFAULT_ORCHESTRATOR_CONFIG, debug };
      const activeRunId = runId ?? crypto.randomUUID();
      const controller = new AbortController();
      activeVisionRuns.set(activeRunId, controller);

      const sendProgress = (step: string, message: string) => {
        event.sender.send("automation:status", {
          step,
          message,
          runId: activeRunId,
        });
      };

      const sendLog: SendLogFn = (
        type:
          | "server"
          | "llm-request"
          | "llm-response"
          | "thinking"
          | "error"
          | "vision-status",
        title: string,
        content: string,
      ) => {
        event.sender.send("automation:log", {
          type,
          title,
          content,
          runId: activeRunId,
        });
      };

      const sendImagePreview = (title: string, imageBase64: string) => {
        event.sender.send("automation:image-preview", {
          title,
          imageBase64,
          runId: activeRunId,
        });
      };

      try {
        LOG(TAG).INFO(`Starting robust workflow: "${userPrompt}"`);
        sendProgress("starting", `Analyzing request: "${userPrompt}"`);

        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // ============================================
        // Phase 1: Take initial screenshot and create contextual plan
        // ============================================
        const initialScreenshot = await takeScreenshot(config.debug);
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        LOG(TAG).INFO(`Initial screenshot captured`);

        if (config.debug) {
          sendImagePreview(
            "Initial Screenshot",
            initialScreenshot.grid_image_base64,
          );
        }

        sendProgress("planning", "Creating contextual plan...");

        const planResult = await askLLMForContextualPlan(
          apiKey,
          initialScreenshot.original_image_base64,
          userPrompt,
          imageModelOverride,
          sendLog,
          controller.signal,
        );

        if (!planResult.valid) {
          LOG(TAG).ERROR(`Context invalid: ${planResult.reason}`);
          return {
            success: false,
            error:
              planResult.reason || "Cannot achieve goal from current screen",
            stepsCompleted: 0,
            totalSteps: 0,
          };
        }

        // ============================================
        // Phase 2: Initialize execution context
        // ============================================
        const context: ExecutionContext = {
          goal: userPrompt,
          plan: planResult.plan || "",
          actionHistory: [],
          retryCount: 0,
          maxRetries: config.maxRetries,
          currentStep: 0,
          maxSteps: config.maxSteps,
          consecutiveFailures: 0,
          maxConsecutiveFailures: config.maxConsecutiveFailures,
        };

        LOG(TAG).INFO(`Plan created: ${context.plan}`);
        LOG(TAG).INFO(`Estimated steps: ${planResult.estimatedSteps}`);

        // ============================================
        // Phase 3: Dynamic execution loop
        // ============================================
        while (
          context.currentStep < context.maxSteps &&
          context.consecutiveFailures < context.maxConsecutiveFailures
        ) {
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          context.currentStep++;
          LOG(TAG).INFO(`=== Step ${context.currentStep} ===`);
          sendProgress(
            `step-${context.currentStep}`,
            `Executing step ${context.currentStep}...`,
          );

          // Take fresh screenshot for decision
          const currentScreenshot = await takeScreenshot(config.debug);
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          if (config.debug) {
            sendImagePreview(
              `Step ${context.currentStep} Screenshot`,
              currentScreenshot.grid_image_base64,
            );
          }

          // Ask LLM what action to take next
          const decision = await askLLMForNextAction(
            apiKey,
            currentScreenshot.original_image_base64,
            context.goal,
            context.plan,
            context.actionHistory,
            imageModelOverride,
            sendLog,
            controller.signal,
          );

          // Check if goal is complete
          if (decision.goalComplete || decision.action === "done") {
            LOG(TAG).INFO("Goal complete!");
            sendProgress(
              "done",
              `Goal achieved in ${context.currentStep} steps`,
            );
            return {
              success: true,
              stepsCompleted: context.currentStep,
              totalSteps: context.currentStep,
              results: context.actionHistory,
            };
          }

          // Execute the action
          let actionSuccess = false;
          let observation = "";

          try {
            if (decision.action === "wait") {
              const waitMs = parseInt(decision.data || "1500", 10);
              await executeWait(waitMs, sendLog);
              actionSuccess = true;
              observation = `Waited ${waitMs}ms`;
            } else if (decision.action === "press") {
              const key = decision.data || "enter";
              actionSuccess = await executePress(key, sendLog);
              observation = actionSuccess
                ? `Pressed ${key}`
                : `Failed to press ${key}`;
            } else if (decision.action === "scroll") {
              // Parse direction and optional pixels from data (e.g., "down", "down 300", "up 500")
              const dataParts = (decision.data || "down")
                .toLowerCase()
                .split(/\s+/);
              const direction = dataParts[0] === "up" ? "up" : "down";
              const pixels = dataParts[1] ? parseInt(dataParts[1], 10) : 300;
              actionSuccess = await executeScroll(
                direction,
                isNaN(pixels) ? 300 : pixels,
                sendLog,
              );
              observation = actionSuccess
                ? `Scrolled ${direction} by ${pixels}px`
                : `Failed to scroll ${direction}`;
            } else if (
              decision.action === "click" ||
              decision.action === "type"
            ) {
              // Use vision-based action (two-pass: grid -> sub-grid)
              // Pass the existing screenshot to avoid redundant capture
              const result = await executeVisionAction(
                event,
                apiKey,
                decision.target || "",
                "double",
                imageModelOverride,
                config.debug,
                decision.action,
                decision.data,
                sendProgress,
                sendLog,
                sendImagePreview,
                true, // keepHidden
                currentScreenshot, // Pass existing screenshot
                controller.signal,
              );

              actionSuccess = result.success;
              observation = actionSuccess
                ? `${decision.action} on "${decision.target}" succeeded`
                : `${decision.action} failed: ${result.error}`;
            }
          } catch (error) {
            actionSuccess = false;
            observation =
              error instanceof Error ? error.message : "Unknown error";
          }

          // Wait a moment for UI to update
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify the action (for non-wait actions)
          if (decision.action !== "wait" && actionSuccess) {
            const verifyScreenshot = await takeScreenshot(config.debug);
            if (controller.signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }

            const expectedResult =
              decision.action === "click"
                ? `The element "${decision.target}" should now be selected or activated`
                : decision.action === "type"
                  ? `The text "${decision.data}" should now be visible in the input field`
                  : `The ${decision.data} key press should have taken effect`;

            const verification = await askLLMForVerification(
              apiKey,
              verifyScreenshot.original_image_base64,
              decision.action,
              decision.target,
              decision.data,
              expectedResult,
              imageModelOverride,
              sendLog,
              controller.signal,
            );

            actionSuccess = verification.success;
            observation = verification.observation;

            if (!actionSuccess && verification.suggestion) {
              LOG(TAG).WARN(`Verification failed: ${verification.suggestion}`);
            }
          }

          // Record action in history
          const historyEntry: ActionHistoryEntry = {
            action: decision.action,
            target: decision.target,
            data: decision.data,
            success: actionSuccess,
            observation,
            timestamp: Date.now(),
          };
          context.actionHistory.push(historyEntry);

          // Update consecutive failures counter
          if (actionSuccess) {
            context.consecutiveFailures = 0;
            LOG(TAG).INFO(
              `Step ${context.currentStep} succeeded: ${observation}`,
            );
          } else {
            context.consecutiveFailures++;
            LOG(TAG).WARN(
              `Step ${context.currentStep} failed (${context.consecutiveFailures}/${context.maxConsecutiveFailures}): ${observation}`,
            );

            // Check if we should abort
            if (context.consecutiveFailures >= context.maxConsecutiveFailures) {
              LOG(TAG).ERROR("Aborting: too many consecutive failures");
              sendLog(
                "error",
                "Workflow Aborted",
                `${context.consecutiveFailures} consecutive steps failed. The target application may have been closed or changed.`,
              );
              return {
                success: false,
                error: "Too many consecutive failures - workflow aborted",
                stepsCompleted: context.currentStep,
                totalSteps: context.currentStep,
                results: context.actionHistory,
              };
            }
          }

          // Small delay between steps
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // If we've exhausted max steps without completing
        if (context.currentStep >= context.maxSteps) {
          LOG(TAG).WARN("Max steps reached without completing goal");
          sendLog(
            "error",
            "Max Steps Reached",
            `Completed ${context.currentStep} steps but goal not achieved. Consider simplifying the request.`,
          );
          return {
            success: false,
            error: `Reached maximum ${context.maxSteps} steps without completing the goal`,
            stepsCompleted: context.currentStep,
            totalSteps: context.maxSteps,
            results: context.actionHistory,
          };
        }

        return {
          success: true,
          stepsCompleted: context.currentStep,
          totalSteps: context.currentStep,
          results: context.actionHistory,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          LOG(TAG).INFO("Orchestration cancelled by user");
          return {
            success: false,
            error: "Cancelled by user",
          };
        }

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        LOG(TAG).ERROR(`Orchestration failed: ${errorMessage}`);
        sendLog("error", "Orchestration Failed", errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        activeVisionRuns.delete(activeRunId);
      }
    },
  );

  ipcMain.handle(
    "automation:cancel-orchestrated-workflow",
    (_event, runId: string) => {
      if (!runId) return false;
      const controller = activeVisionRuns.get(runId);
      if (controller) {
        controller.abort();
        activeVisionRuns.delete(runId);
        return true;
      }
      return false;
    },
  );
}
