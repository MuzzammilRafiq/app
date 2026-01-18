/**
 * IPC handlers for automation server communication
 * This file only contains IPC registration logic for the agent
 */

import { setupOrchestratorHandlers } from "../automation/entry.js";

export function setupAutomationHandlers() {
  setupOrchestratorHandlers();
}
