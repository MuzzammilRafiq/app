import { useState, useRef, useEffect } from "react";
import { LoadingSVG, SendSVG } from "../icons";
import { useVisionLogStore } from "./VisionLogStore";
import { loadSettings } from "../../services/settingsStorage";

type ActionMode = "click" | "double-click" | "right-click" | "type" | "press";

const DEBUG_MODE = true;

// Common keys for the press key action
const KEYBOARD_KEYS = [
  { value: "enter", label: "Enter ↵" },
  { value: "tab", label: "Tab ⇥" },
  { value: "space", label: "Space" },
  { value: "escape", label: "Escape" },
  { value: "backspace", label: "Backspace" },
  { value: "up", label: "↑" },
  { value: "down", label: "↓" },
  { value: "left", label: "←" },
  { value: "right", label: "→" },
];

export default function VisionInput() {
  const [content, setContent] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode>("click");
  const [typeText, setTypeText] = useState("");
  const [pressKey, setPressKey] = useState("enter");
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

    if (actionMode === "type" && !typeText.trim()) {
      addLog({ type: "error", title: "Missing Input", content: "Enter text to type" });
      return;
    }

    const settings = loadSettings();
    if (!settings.openrouterApiKey) {
      addLog({ type: "error", title: "Error", content: "API key not configured" });
      return;
    }

    clearLogs();
    setExecuting(true);

    // Map actionMode to clickType and actionType
    const clickType = actionMode === "double-click" ? "double" : actionMode === "right-click" ? "right" : "left";
    const actionType = actionMode === "type" ? "type" : actionMode === "press" ? "press" : "click";
    const actionData = actionMode === "type" ? typeText : actionMode === "press" ? pressKey : undefined;

    addLog({
      type: "status",
      title: "Started",
      content: `Target: "${trimmedContent}" | Action: ${actionMode}`,
    });

    try {
      const result = await window.electronAPI.automationExecuteVisionClick(
        settings.openrouterApiKey,
        trimmedContent,
        clickType,
        settings.imageModel || undefined,
        DEBUG_MODE,
        actionType,
        actionData
      );

      if (!result.success) {
        addLog({ type: "error", title: "Failed", content: result.error || "Unknown error" });
      } else {
        addLog({
          type: "status",
          title: "Complete",
          content: `Action performed at (${result.data?.coordinates?.x}, ${result.data?.coordinates?.y})`,
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

  const actionModes: { value: ActionMode; label: string }[] = [
    { value: "click", label: "Click" },
    { value: "double-click", label: "Double" },
    { value: "right-click", label: "Right" },
    { value: "type", label: "Type" },
    { value: "press", label: "Key" },
  ];

  return (
    <div className="shrink-0 px-6 pb-6 pt-2">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-float">
        {/* Target Description */}
        <div className="px-4 pt-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to interact with..."
            disabled={isExecuting}
            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-slate-700 placeholder-slate-400 text-[15px] resize-none focus:ring-2 focus:ring-primary/20 focus:outline-none max-h-24 min-h-[52px] leading-relaxed border border-slate-200"
            rows={1}
          />
        </div>

        {/* Action Mode + Additional Input (if needed) + Send */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Action Mode Pills */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {actionModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setActionMode(mode.value)}
                disabled={isExecuting}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  actionMode === mode.value
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } disabled:opacity-50`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Type input */}
          {actionMode === "type" && (
            <input
              type="text"
              value={typeText}
              onChange={(e) => setTypeText(e.target.value)}
              placeholder="Text to type..."
              disabled={isExecuting}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          )}

          {/* Key selector */}
          {actionMode === "press" && (
            <select
              value={pressKey}
              onChange={(e) => setPressKey(e.target.value)}
              disabled={isExecuting}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {KEYBOARD_KEYS.map((key) => (
                <option key={key.value} value={key.value}>{key.label}</option>
              ))}
            </select>
          )}

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
