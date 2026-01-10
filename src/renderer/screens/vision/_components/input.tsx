import { useState, useRef, useEffect } from "react";
import { LoadingSVG, SendSVG } from "../../../components/icons";
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
  const currentSessionId = useVisionLogStore((s) => s.currentSessionId);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  useEffect(() => {
    const handleStatus = (data: { step: string; message: string }) => {
      addLog({
        type: "status",
        title: `Step: ${data.step}`,
        content: data.message,
      });
    };

    const handleLog = (data: {
      type: "server" | "llm-request" | "llm-response" | "thinking" | "error";
      title: string;
      content: string;
    }) => {
      addLog({ type: data.type, title: data.title, content: data.content });
    };

    const handleImagePreview = (data: {
      title: string;
      imageBase64: string;
    }) => {
      addLog({
        type: "image-preview",
        title: data.title,
        content: "",
        imageBase64: data.imageBase64,
      });
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

    addLog({
      type: "status",
      title: "Started",
      content: `Goal: "${trimmedContent}"`,
    });

    try {
      const result = await window.electronAPI.automationExecuteOrchestrated(
        settings.openrouterApiKey,
        trimmedContent,
        settings.imageModel || undefined,
        DEBUG_MODE
      );

      if (!result.success) {
        addLog({
          type: "error",
          title: "Failed",
          content: result.error || "Unknown error",
        });
        await updateSessionStatus("failed");
      } else {
        addLog({
          type: "status",
          title: "Complete",
          content: `Completed ${result.stepsCompleted}/${result.totalSteps} steps`,
        });
        await updateSessionStatus("completed");
      }
    } catch (err) {
      addLog({
        type: "error",
        title: "Error",
        content: err instanceof Error ? err.message : "Unknown error",
      });
      await updateSessionStatus("failed");
    } finally {
      setExecuting(false);
      // Clear session ID after execution is done - logs are already persisted
      setCurrentSessionId(null);
    }
  };

  const handleCancel = async () => {
    setExecuting(false);
    addLog({ type: "status", title: "Cancelled", content: "Action cancelled" });
    await updateSessionStatus("cancelled");
    setCurrentSessionId(null);
  };

  return (
    <div className="shrink-0 px-6 pb-6 pt-2">
      <div className="mx-auto max-w-3xl transition-all duration-300 relative bg-white rounded-2xl shadow-float border border-slate-200/60">
        {/* Textarea with inline controls */}
        <div className="flex items-end gap-2 p-3">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to automate..."
            disabled={isExecuting}
            className="flex-1 bg-transparent border-none text-slate-700 placeholder-slate-400 text-[15px] resize-none focus:ring-0 focus:outline-none max-h-48 min-h-6 leading-relaxed py-2"
            rows={1}
          />

          {/* Action buttons */}
          {isExecuting && (
            <button
              onClick={handleCancel}
              className="px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all self-center"
              type="button"
            >
              Stop
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleExecute}
            disabled={!content.trim() || isExecuting}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
              content.trim() && !isExecuting
                ? "bg-primary text-white hover:bg-primary-hover"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            type="button"
          >
            {isExecuting ? (
              <span className="animate-spin">{LoadingSVG}</span>
            ) : (
              SendSVG
            )}
          </button>
        </div>
      </div>
      <div className="text-center mt-3">
        <p className="text-[10px] text-slate-400">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
