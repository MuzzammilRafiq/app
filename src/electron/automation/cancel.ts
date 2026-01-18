type ActiveVisionRun = {
  runId: string;
  controller: AbortController;
} | null;

export const cancel = (runId: string, activeVisionRun: ActiveVisionRun) => {
  if (!runId || !activeVisionRun) return false;
  if (activeVisionRun.runId !== runId) return false;
  activeVisionRun.controller.abort();
  return true;
};
