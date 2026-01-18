import { ipcMain } from "electron";
import { execute } from "./execute.js";
import { cancel } from "./cancel.js";

type ActiveVisionRun = {
  runId: string;
  controller: AbortController;
} | null;

const activeVisionRun: { current: ActiveVisionRun } = { current: null };

export function setupOrchestratorHandlers() {
  ipcMain.handle(
    "automation:execute-orchestrated-workflow",
    (_event, apiKey, userPrompt, imageModelOverride, debug, runId) =>
      execute(
        _event,
        activeVisionRun,
        apiKey,
        userPrompt,
        imageModelOverride,
        debug,
        runId,
      ),
  );
  ipcMain.handle("automation:cancel-orchestrated-workflow", (_event, runId) => {
    const cancelled = cancel(runId, activeVisionRun.current);
    if (cancelled && activeVisionRun.current?.runId === runId) {
      activeVisionRun.current = null;
    }
    return cancelled;
  });
}
