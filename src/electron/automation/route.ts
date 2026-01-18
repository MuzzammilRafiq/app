import {
  AUTOMATION_SERVER_URL,
  type SendLogFn,
  GRID_SIZE,
  CellIdentificationResult,
} from "./utils.js";
import { LOG } from "../utils/logging.js";

const FETCH_TIMEOUT_MS = 30_000;

function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

export interface CroppedCellResult {
  cropped_image_base64: string;
  clean_cropped_image_base64: string;
  cell_bounds: {
    x1: number;
    y1: number;
    width: number;
    height: number;
  };
}

export async function takeScreenshot(): Promise<{
  original_image_base64: string;
  grid_image_base64: string;
  scale_factor: number;
}> {
  const response = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/screenshot/numbered-grid?grid_size=${GRID_SIZE}`,
  );
  if (!response.ok) {
    throw new Error("Failed to capture screenshot");
  }
  return response.json();
}
export async function executeWait(
  ms: number,
  sendLog: SendLogFn,
): Promise<void> {
  sendLog("server", "Wait", `Waiting ${ms}ms...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executePress(
  key: string,
  sendLog: SendLogFn,
): Promise<boolean> {
  sendLog("server", "Press Key", `Pressing: ${key}`);
  const response = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/keyboard/press`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, delay_ms: 0 }),
    },
  );
  return response.ok;
}

export async function executeScroll(
  direction: "up" | "down",
  pixels: number,
  sendLog: SendLogFn,
): Promise<boolean> {
  sendLog("server", "Scroll", `Scrolling ${direction} by ${pixels}px...`);

  // Use mouse scroll endpoint if available, fallback to keyboard
  try {
    // Try to use mouse scroll (more natural)
    const scrollAmount = direction === "up" ? -pixels : pixels;
    const response = await fetchWithTimeout(
      `${AUTOMATION_SERVER_URL}/mouse/scroll`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delta_x: 0,
          delta_y: scrollAmount,
          duration_ms: 100,
        }),
      },
    );

    if (response.ok) {
      return true;
    }
    LOG("route").WARN(
      `Mouse scroll failed with status ${response.status}, falling back to keyboard`,
    );
  } catch (error) {
    LOG("route").WARN(
      `Mouse scroll error: ${error instanceof Error ? error.message : "unknown"}, falling back to keyboard`,
    );
  }

  // Fallback: Use Page Up/Down keys
  const key = direction === "up" ? "pageup" : "pagedown";
  const response = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/keyboard/press`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, delay_ms: 0 }),
    },
  );
  return response.ok;
}

export async function cropCell(
  cellNumber: string,
  screenshot: string,
): Promise<CroppedCellResult> {
  const imgBuffer = Buffer.from(screenshot, "base64");
  const formData = new FormData();
  const imgBlob = new Blob([imgBuffer], { type: "image/png" });
  formData.append("image", imgBlob, "screenshot.png");

  const cropParams = new URLSearchParams({
    cell_number: cellNumber,
    grid_size: String(GRID_SIZE),
    create_sub_grid: "true",
    sub_grid_size: String(GRID_SIZE),
  });

  const cropResponse = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/image/crop-cell?${cropParams}`,
    { method: "POST", body: formData },
  );
  if (!cropResponse.ok) {
    throw new Error("Failed to crop cell");
  }
  const cropped: CroppedCellResult = await cropResponse.json();
  return cropped;
}

export async function getCenterCell(
  cropped: CroppedCellResult,
  secondResult: CellIdentificationResult,
): Promise<{ x: number; y: number }> {
  const centerParams = new URLSearchParams({
    width: cropped.cell_bounds.width.toString(),
    height: cropped.cell_bounds.height.toString(),
    grid_size: String(GRID_SIZE),
    cell_number: secondResult.cell.toString(),
    offset_x: cropped.cell_bounds.x1.toString(),
    offset_y: cropped.cell_bounds.y1.toString(),
  });

  const centerResponse = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/grid/cell-center?${centerParams}`,
  );

  if (!centerResponse.ok) {
    throw new Error("Failed to calculate center");
  }

  const cellCenter: { x: number; y: number } = await centerResponse.json();
  return cellCenter;
}

export async function moveMouseAndClick(
  clickType: "left" | "right" | "double",
  X: number,
  Y: number,
): Promise<boolean> {
  const moveResponse = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/mouse/move`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: X, y: Y, duration_ms: 200 }),
    },
  );
  if (!moveResponse.ok) {
    throw new Error(`Failed to move mouse to (${X}, ${Y})`);
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  const clickBody = {
    button: clickType === "right" ? "right" : "left",
    clicks: clickType === "double" ? 2 : 1,
    delay_ms: 0,
  };
  const clickResponse = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/mouse/click`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clickBody),
    },
  );
  if (!clickResponse.ok) {
    throw new Error(`Failed to click at (${X}, ${Y})`);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  return true;
}

export async function typeText(actionData: string): Promise<boolean> {
  const response = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/keyboard/type`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: actionData, interval_ms: 0, delay_ms: 0 }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to type text: "${actionData}"`);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return true;
}

export async function pressKey(actionData: string): Promise<boolean> {
  const response = await fetchWithTimeout(
    `${AUTOMATION_SERVER_URL}/keyboard/press`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: actionData, delay_ms: 0 }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to press key: ${actionData}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return true;
}
