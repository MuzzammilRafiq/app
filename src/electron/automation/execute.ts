import crypto from "node:crypto";
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  type ExecutionContext,
  type ActionHistoryEntry,
  type SendLogFn,
} from "./utils.js";
import {
  askLLMForContextualPlan,
  askLLMForNextAction,
  askLLMForVerification,
} from "./llm-helpers.js";
import { executeVisionAction } from "./vision-handlers.js";
import { LOG, truncate, truncateLines } from "../utils/logging.js";
import {
  executePress,
  executeScroll,
  executeWait,
  takeScreenshot,
} from "./route.js";
import { CHECK_ABORT } from "../utils/helper-functions.js";

const TAG = "automation:execute";

const AUTOMATION_LOG_MAX_LEN = 4000;

const formatAutomationLog = (content: string) =>
  truncateLines(content, AUTOMATION_LOG_MAX_LEN, 80);

type ActiveVisionRun = {
  runId: string;
  controller: AbortController;
} | null;

type ActiveVisionRunRef = {
  current: ActiveVisionRun;
};

export const execute = async (
  event: any,
  activeVisionRun: ActiveVisionRunRef,
  apiKey: string,
  userPrompt: string,
  imageModelOverride?: string,
  debug: boolean = false,
  runId?: string,
) => {
  if (activeVisionRun.current) {
    return {
      success: false,
      error: "Vision run already in progress",
    };
  }

  const config = { ...DEFAULT_ORCHESTRATOR_CONFIG, debug };
  const activeRunId = runId ?? crypto.randomUUID();
  const controller = new AbortController();
  activeVisionRun.current = { runId: activeRunId, controller };

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
      title: truncate(title, 120),
      content: formatAutomationLog(content),
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
    LOG(TAG).INFO("Starting vision workflow", {
      runId: activeRunId,
      debug,
      userPrompt: truncate(userPrompt, 400),
    });
    sendProgress("starting", `Analyzing request: "${userPrompt}"`);

    // Phase 1: Take initial screenshot and create contextual plan
    const initialScreenshot = await takeScreenshot();
    CHECK_ABORT(controller);

    LOG(TAG).INFO("Initial screenshot captured", {
      runId: activeRunId,
      originalImageBytes: initialScreenshot.original_image_base64.length,
      gridImageBytes: initialScreenshot.grid_image_base64.length,
    });

    sendImagePreview("Initial Screenshot", initialScreenshot.grid_image_base64);

    sendProgress("Planning", "Creating contextual plan...");

    const planResult = await askLLMForContextualPlan(
      apiKey,
      initialScreenshot.original_image_base64,
      userPrompt,
      imageModelOverride,
      sendLog,
      controller,
    );

    if (!planResult.valid || !planResult.plan) {
      LOG(TAG).ERROR("Context invalid", {
        runId: activeRunId,
        reason: planResult.reason,
      });
      return {
        success: false,
        error: planResult.reason || "Cannot achieve goal from current screen",
        stepsCompleted: 0,
        totalSteps: 0,
      };
    }

    // Phase 2: Initialize execution context
    const context: ExecutionContext = {
      goal: userPrompt,
      plan: planResult.plan,
      actionHistory: [],
      retryCount: 0,
      maxRetries: config.maxRetries,
      currentStep: 0,
      maxSteps: config.maxSteps,
      consecutiveFailures: 0,
      maxConsecutiveFailures: config.maxConsecutiveFailures,
    };

    LOG(TAG).INFO("Plan created", {
      runId: activeRunId,
      estimatedSteps: planResult.estimatedSteps,
      planPreview: truncateLines(context.plan, 1200, 20),
    });

    // Phase 3: Dynamic execution loop
    while (
      context.currentStep < context.maxSteps &&
      context.consecutiveFailures < context.maxConsecutiveFailures
    ) {
      CHECK_ABORT(controller);

      context.currentStep++;
      LOG(TAG).INFO("Starting automation step", {
        runId: activeRunId,
        step: context.currentStep,
        completedActions: context.actionHistory.length,
      });
      sendProgress(
        `step-${context.currentStep}`,
        `Executing step ${context.currentStep}...`,
      );

      // Take fresh screenshot for decision
      const currentScreenshot = await takeScreenshot();
      CHECK_ABORT(controller);

      sendImagePreview(
        `Step ${context.currentStep} Screenshot`,
        currentScreenshot.grid_image_base64,
      );

      // Ask LLM what action to take next
      const decision = await askLLMForNextAction(
        apiKey,
        currentScreenshot.original_image_base64,
        context.goal,
        context.plan,
        context.actionHistory,
        imageModelOverride,
        sendLog,
        controller,
      );

      if (decision.action === "error") {
        LOG(TAG).ERROR("LLM decision failed", {
          runId: activeRunId,
          step: context.currentStep,
          reason: truncate(decision.reason, 400),
        });
        return {
          success: false,
          error: decision.reason,
          stepsCompleted: context.currentStep,
          totalSteps: context.currentStep,
        };
      }

      // Check if goal is complete
      if (decision.goalComplete || decision.action === "done") {
        LOG(TAG).SUCCESS("Goal complete", {
          runId: activeRunId,
          step: context.currentStep,
        });
        sendProgress("done", `Goal achieved in ${context.currentStep} steps`);
        return {
          success: true,
          stepsCompleted: context.currentStep,
          totalSteps: context.currentStep,
          results: context.actionHistory,
        };
      }

      LOG(TAG).INFO("Decision ready", {
        runId: activeRunId,
        step: context.currentStep,
        action: decision.action,
        target: decision.target ? truncate(decision.target, 200) : undefined,
        data: decision.data ? truncate(decision.data, 200) : undefined,
        reason: truncateLines(decision.reason, 600, 8),
      });

      // Execute the action
      let actionSuccess = false;
      let observation = "";

      try {
        if (decision.action === "wait") {
          const waitMs = decision.data ? parseInt(decision.data, 10) : 3000;
          const actualWaitMs = isNaN(waitMs) ? 3000 : waitMs;
          await executeWait(actualWaitMs, sendLog);
          actionSuccess = true;
          observation = `Waited ${actualWaitMs}ms`;
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
          const parsedPixels = dataParts[1] ? parseInt(dataParts[1], 10) : 300;
          const actualPixels = isNaN(parsedPixels) ? 300 : parsedPixels;
          actionSuccess = await executeScroll(direction, actualPixels, sendLog);
          observation = actionSuccess
            ? `Scrolled ${direction} by ${actualPixels}px`
            : `Failed to scroll ${direction}`;
        } else if (decision.action === "click" || decision.action === "type") {
          // Use vision-based action (two-pass: grid -> sub-grid)
          // Pass the existing screenshot to avoid redundant capture
          const result = await executeVisionAction(
            apiKey,
            decision.target || "",
            "left",
            imageModelOverride,
            decision.action,
            decision.data,
            sendLog,
            sendImagePreview,
            controller,
          );

          actionSuccess = result.success;
          observation = actionSuccess
            ? `${decision.action} on "${decision.target}" succeeded`
            : `${decision.action} failed: ${result.error}`;
        }
      } catch (error) {
        actionSuccess = false;
        observation = error instanceof Error ? error.message : "Unknown error";
        LOG(TAG).ERROR("Action execution threw", {
          runId: activeRunId,
          step: context.currentStep,
          action: decision.action,
        }, error);
      }

      // Wait a moment for UI to update
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify the action (for non-wait actions)
      if (decision.action !== "wait" && actionSuccess) {
        const verifyScreenshot = await takeScreenshot();
        CHECK_ABORT(controller);

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
          controller,
        );

        actionSuccess = verification.success;
        observation = verification.observation;

        if (!actionSuccess && verification.suggestion) {
          LOG(TAG).WARN("Verification failed", {
            runId: activeRunId,
            step: context.currentStep,
            suggestion: truncateLines(verification.suggestion, 500, 8),
          });
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
        LOG(TAG).SUCCESS("Automation step succeeded", {
          runId: activeRunId,
          step: context.currentStep,
          observation: truncateLines(observation, 600, 10),
        });
      } else {
        context.consecutiveFailures++;
        LOG(TAG).WARN("Automation step failed", {
          runId: activeRunId,
          step: context.currentStep,
          consecutiveFailures: context.consecutiveFailures,
          maxConsecutiveFailures: context.maxConsecutiveFailures,
          observation: truncateLines(observation, 600, 10),
        });

        // Check if we should abort
        if (context.consecutiveFailures >= context.maxConsecutiveFailures) {
          LOG(TAG).ERROR("Aborting automation run after repeated failures", {
            runId: activeRunId,
            step: context.currentStep,
            consecutiveFailures: context.consecutiveFailures,
          });
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
      LOG(TAG).WARN("Max steps reached without completing goal", {
        runId: activeRunId,
        currentStep: context.currentStep,
        maxSteps: context.maxSteps,
      });
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
      LOG(TAG).WARN("Orchestration cancelled by user", {
        runId: activeRunId,
      });
      return {
        success: false,
        error: "Cancelled by user",
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    LOG(TAG).ERROR("Orchestration failed", { runId: activeRunId }, error);
    sendLog("error", "Orchestration Failed", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    if (activeVisionRun.current?.runId === activeRunId) {
      activeVisionRun.current = null;
    }
  }
};
