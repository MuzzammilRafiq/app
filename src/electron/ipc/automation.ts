/**
 * IPC handlers for automation server communication
 * This file only contains IPC registration logic
 */

import { setupBasicAutomationHandlers } from "../automation/basic-handlers.js";
import { setupVisionAutomationHandlers } from "../automation/vision-handlers.js";
import { setupOrchestratorHandlers } from "../automation/orchestrator-handlers.js";

export function setupAutomationHandlers() {
  setupBasicAutomationHandlers();
  setupVisionAutomationHandlers();
  setupOrchestratorHandlers();
}
