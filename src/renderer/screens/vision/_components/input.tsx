import { useState, useRef, useEffect } from "react";
import { Eye } from "lucide-react";
import {
  LoadingSVG,
  PauseSVG,
  SendSVG,
  iconClass,
} from "../../../components/icons";
import { useVisionLogStore } from "../../../utils/store";
import { loadSettings } from "../../../utils/localstore";
import type { VisionSessionStatus } from "../../../../common/types";

const DEBUG_MODE = true;

export default function VisionInput() {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isExecuting = useVisionLogStore((s) => s.isExecuting);
  const addLog = useVisionLogStore((s) => s.addLog);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);
  const setExecuting = useVisionLogStore((s) => s.setExecuting);
  const setCurrentSessionId = useVisionLogStore((s) => s.setCurrentSessionId);
  const setCurrentRunId = useVisionLogStore((s) => s.setCurrentRunId);
  const currentSessionId = useVisionLogStore((s) => s.currentSessionId);
  const currentRunId = useVisionLogStore((s) => s.currentRunId);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  useEffect(() => {
    const handleStatus = (data: {
      step: string;
      message: string;
      runId?: string;
    }) => {
      addLog(
        {
          type: "status",
          title: `Step: ${data.step}`,
          content: data.message,
        },
        data.runId
      );
    };

    const handleLog = (data: {
      type: "server" | "llm-request" | "llm-response" | "thinking" | "error";
      title: string;
      content: string;
      runId?: string;
    }) => {
      addLog(
        { type: data.type, title: data.title, content: data.content },
        data.runId
      );
    };

    const handleImagePreview = (data: {
      title: string;
      imageBase64: string;
      runId?: string;
    }) => {
      addLog(
        {
          type: "image-preview",
          title: data.title,
          content: "",
          imageBase64: data.imageBase64,
        },
        data.runId
      );
    };

    window.electronAPI.onAutomationStatus(handleStatus);
    window.electronAPI.onAutomationLog?.(handleLog);
    window.electronAPI.onAutomationImagePreview?.(handleImagePreview);

    return () => {
      window.electronAPI.removeAutomationStatusListener();
      window.electronAPI.removeAutomationLogListener?.();
      window.electronAPI.removeAutomationImagePreviewListener?.();
    };
  }, [addLog]);

  /**
   * Update the session status in the database
   */
  const updateSessionStatus = async (status: VisionSessionStatus) => {
    if (currentSessionId) {
      try {
        await window.electronAPI.dbUpdateVisionSessionStatus(
          currentSessionId,
          status
        );
      } catch (err) {
        console.error("Failed to update vision session status:", err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleExecute = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isExecuting) return;

    const settings = loadSettings();
    if (!settings.openrouterApiKey) {
      addLog({
        type: "error",
        title: "Error",
        content: "API key not configured",
      });
      return;
    }

    clearLogs();
    setExecuting(true);
    const runId = crypto.randomUUID();
    setCurrentRunId(runId);

    // Create a new vision session in the database
    try {
      const session =
        await window.electronAPI.dbCreateVisionSession(trimmedContent);
      setCurrentSessionId(session.id);
    } catch (err) {
      console.error("Failed to create vision session:", err);
      // Continue without persistence
      setCurrentSessionId(null);
    }

    addLog(
      {
        type: "status",
        title: "Started",
        content: `Goal: "${trimmedContent}"`,
      },
      runId
    );

    try {
      const result = await window.electronAPI.automationExecuteOrchestrated(
        settings.openrouterApiKey,
        trimmedContent,
        settings.imageModel || undefined,
        DEBUG_MODE,
        runId
      );

      if (!result.success) {
        addLog(
          {
            type: "error",
            title:
              result.error === "Cancelled by user" ? "Cancelled" : "Failed",
            content: result.error || "Unknown error",
          },
          runId
        );
        await updateSessionStatus(
          result.error === "Cancelled by user" ? "cancelled" : "failed"
        );
      } else {
        addLog(
          {
            type: "status",
            title: "Complete",
            content: `Completed ${result.stepsCompleted}/${result.totalSteps} steps`,
          },
          runId
        );
        await updateSessionStatus("completed");
      }
    } catch (err) {
      addLog(
        {
          type: "error",
          title: "Error",
          content: err instanceof Error ? err.message : "Unknown error",
        },
        runId
      );
      await updateSessionStatus("failed");
    } finally {
      setExecuting(false);
      setCurrentRunId(null);
      // Clear session ID after execution is done - logs are already persisted
      setCurrentSessionId(null);
    }
  };

  const handleCancel = async () => {
    if (!currentRunId) {
      return;
    }

    try {
      await window.electronAPI.automationCancelOrchestrated(currentRunId);
    } catch (err) {
      console.error("Failed to cancel vision run:", err);
    }

    setExecuting(false);
    addLog(
      { type: "status", title: "Cancelled", content: "Action cancelled" },
      currentRunId
    );
    await updateSessionStatus("cancelled");
    setCurrentSessionId(null);
    setCurrentRunId(null);
  };

  return (
    <div className="shrink-0 px-6 pb-6 pt-4">
      <div className="mx-auto max-w-3xl transition-all duration-300 relative bg-surface/80 rounded-2xl shadow-float border border-border-strong">
        <div className="flex items-end gap-2 p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter the Query :)"
            disabled={isExecuting}
            className="flex-1 bg-transparent border-none text-text-main placeholder-text-subtle text-[15px] resize-none focus:ring-0 focus:outline-none max-h-48 min-h-8 leading-relaxed"
            rows={1}
          />

          <button
            onClick={isExecuting ? handleCancel : handleExecute}
            disabled={!isExecuting && !content.trim()}
            className={`${iconClass} w-10 h-10`}
            type="button"
          >
            {isExecuting ? PauseSVG : SendSVG}
          </button>
        </div>
      </div>
    </div>
  );
}
