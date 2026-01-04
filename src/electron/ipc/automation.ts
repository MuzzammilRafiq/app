/**
 * IPC handlers for automation server communication
 * This file only contains IPC registration logic for the agent
 */

import { setupOrchestratorHandlers } from "../automation/orchestrator-handlers.js";

export function setupAutomationHandlers() {
  setupOrchestratorHandlers();
}
