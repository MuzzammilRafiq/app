import { useState, useRef, useEffect } from "react";
import { CrosshairSVG, LoadingSVG, SendSVG } from "../icons";
import { useVisionLogStore } from "./VisionLogStore";
import { loadSettings } from "../../services/settingsStorage";

type ClickType = "left" | "right" | "double";

const DEBUG_MODE = true; // Toggle this to save intermediate images for debugging

export default function VisionInput() {
  const [content, setContent] = useState("");
  const [clickType, setClickType] = useState<ClickType>("left");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isExecuting = useVisionLogStore((s) => s.isExecuting);
  const addLog = useVisionLogStore((s) => s.addLog);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);
  const setExecuting = useVisionLogStore((s) => s.setExecuting);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  // Setup IPC listeners for automation events
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
      addLog({
        type: data.type,
        title: data.title,
        content: data.content,
      });
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
        title: "Configuration Error",
        content: "OpenRouter API key not found in settings",
      });
      return;
    }

    clearLogs();
    setExecuting(true);

    addLog({
      type: "status",
      title: "Vision Click Started",
      content: `Target: "${trimmedContent}" | Click type: ${clickType}`,
    });

    try {
      const result = await window.electronAPI.automationExecuteVisionClick(
        settings.openrouterApiKey,
        trimmedContent,
        clickType,
        settings.imageModel || undefined,
        DEBUG_MODE
      );

      if (!result.success) {
        addLog({
          type: "error",
          title: "Vision Click Failed",
          content: result.error || "Unknown error occurred",
        });
      } else {
        addLog({
          type: "status",
          title: "Vision Click Completed",
          content: `Successfully clicked at (${result.data?.coordinates?.x}, ${result.data?.coordinates?.y})`,
        });
      }
    } catch (err) {
      addLog({
        type: "error",
        title: "Execution Error",
        content: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = async () => {
    // For now, just mark as not executing
    // A more complete implementation would abort the IPC call
    setExecuting(false);
    addLog({
      type: "status",
      title: "Cancelled",
      content: "Vision click was cancelled by user",
    });
  };

  const actionBtnBase =
    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200";

  return (
    <div className="shrink-0 px-6 pb-6 pt-2">
      <div className="mx-auto max-w-3xl bg-white rounded-3xl shadow-float border border-transparent">
        {/* Header */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-primary-light/20 rounded-xl text-primary">
            {CrosshairSVG}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Vision Click
            </h2>
            <p className="text-xs text-slate-500">
              Describe what to click on screen
            </p>
          </div>
        </div>

        {/* Textarea */}
        <div className="relative px-5 py-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Click the blue 'Submit' button..."
            disabled={isExecuting}
            className="w-full bg-transparent border-none text-slate-700 placeholder-slate-400 text-[15px] resize-none focus:ring-0 focus:outline-none max-h-32 min-h-12 leading-relaxed"
            rows={1}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 pb-4 pt-1">
          {/* Click type selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">
              Click:
            </span>
            {(["left", "right", "double"] as ClickType[]).map((type) => (
              <button
                key={type}
                onClick={() => setClickType(type)}
                disabled={isExecuting}
                className={`${actionBtnBase} ${
                  clickType === type
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                } disabled:opacity-50`}
              >
                {type === "double" ? "Double" : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isExecuting && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
            <button
              onClick={isExecuting ? handleCancel : handleExecute}
              disabled={!content.trim() && !isExecuting}
              className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center shadow-md ${
                content.trim() || isExecuting
                  ? "bg-primary text-white hover:bg-primary-hover hover:scale-105"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isExecuting ? (
                <span className="animate-spin">{LoadingSVG}</span>
              ) : (
                SendSVG
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
