import { useState, useRef, useEffect } from "react";
import { LoadingSVG, SendSVG } from "../icons";
import { useVisionLogStore } from "./VisionLogStore";
import { loadSettings } from "../../services/settingsStorage";

const DEBUG_MODE = true;

export default function VisionInput() {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isExecuting = useVisionLogStore((s) => s.isExecuting);
  const addLog = useVisionLogStore((s) => s.addLog);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);
  const setExecuting = useVisionLogStore((s) => s.setExecuting);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  useEffect(() => {
    const handleStatus = (data: { step: string; message: string }) => {
      addLog({ type: "status", title: `Step: ${data.step}`, content: data.message });
    };

    const handleLog = (data: {
      type: "server" | "llm-request" | "llm-response" | "thinking" | "error";
      title: string;
      content: string;
    }) => {
      addLog({ type: data.type, title: data.title, content: data.content });
    };

    const handleImagePreview = (data: { title: string; imageBase64: string }) => {
      addLog({ type: "image-preview", title: data.title, content: "", imageBase64: data.imageBase64 });
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
      addLog({ type: "error", title: "Error", content: "API key not configured" });
      return;
    }

    clearLogs();
    setExecuting(true);

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
        addLog({ type: "error", title: "Failed", content: result.error || "Unknown error" });
      } else {
        addLog({
          type: "status",
          title: "Complete",
          content: `Completed ${result.stepsCompleted}/${result.totalSteps} steps`,
        });
      }
    } catch (err) {
      addLog({ type: "error", title: "Error", content: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = () => {
    setExecuting(false);
    addLog({ type: "status", title: "Cancelled", content: "Action cancelled" });
  };

  return (
    <div className="shrink-0 px-6 pb-6 pt-2">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-float">
        {/* Goal Description */}
        <div className="px-4 pt-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to do?"
            disabled={isExecuting}
            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-slate-700 placeholder-slate-400 text-[15px] resize-none focus:ring-2 focus:ring-primary/20 focus:outline-none max-h-24 min-h-[52px] leading-relaxed border border-slate-200"
            rows={1}
          />
        </div>

        {/* Agent Label + Send Button */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Spacer */}
          <div className="flex-1" />

          {/* Cancel + Send */}
          {isExecuting && (
            <button
              onClick={handleCancel}
              className="px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleExecute}
            disabled={!content.trim() || isExecuting}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
              content.trim() && !isExecuting
                ? "bg-primary text-white hover:bg-primary-hover shadow-md hover:scale-105"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isExecuting ? <span className="animate-spin">{LoadingSVG}</span> : SendSVG}
          </button>
        </div>
      </div>
    </div>
  );
}
