/**
 * LLM helper functions for automation
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { ASK_IMAGE } from "../services/model.js";
import { GRID_SIZE, MAX_ORCHESTRATOR_STEPS } from "./types.js";
import type { SendLogFn, CellIdentificationResult, OrchestratorStep } from "./types.js";

export async function askLLMForCell(
  apiKey: string,
  imageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride?: string
): Promise<CellIdentificationResult> {
  // Save base64 to temp file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `vision-click-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    let responseContent = "";

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
      throw new Error(
        `Element not found: ${parsed.reason || `No element matching "${targetDescription}" was found on the screen`}`
      );
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

export async function askLLMForCellWithLogging(
  apiKey: string,
  imageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<CellIdentificationResult> {
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

export const createCellIdentificationPrompt = (
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

export const createPlanGenerationPrompt = (userPrompt: string) => `You are a browser automation assistant. Given the user's request and a screenshot of their screen, generate a step-by-step plan to achieve the goal.

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

export async function askLLMForPlanWithLogging(
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
