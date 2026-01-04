import { useEffect, useRef } from "react";
import { useVisionLogStore, type VisionLogEntry } from "./VisionLogStore";
import { LoadingSVG } from "../icons";

const LOG_TYPE_STYLES: Record<
  VisionLogEntry["type"],
  { bg: string; border: string; icon: string; titleColor: string }
> = {
  server: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: "🌐",
    titleColor: "text-slate-700",
  },
  "llm-request": {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "📤",
    titleColor: "text-blue-700",
  },
  "llm-response": {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "📥",
    titleColor: "text-green-700",
  },
  thinking: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: "🧠",
    titleColor: "text-purple-700",
  },
  status: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "⚡",
    titleColor: "text-amber-700",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "❌",
    titleColor: "text-red-700",
  },
  "image-preview": {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    icon: "🖼️",
    titleColor: "text-indigo-700",
  },
};

function LogEntry({ entry }: { entry: VisionLogEntry }) {
  const style = LOG_TYPE_STYLES[entry.type];
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <div
      className={`p-3 rounded-xl border ${style.bg} ${style.border} animate-fade-in`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-medium ${style.titleColor}`}>
              {entry.title}
            </p>
            <span className="text-[10px] text-slate-400 shrink-0">{time}</span>
          </div>
          {entry.content && (
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap wrap-break-word font-mono">
              {entry.content}
            </p>
          )}
          {entry.imageBase64 && (
            <div className="mt-2">
              <img
                src={`data:image/png;base64,${entry.imageBase64}`}
                alt="Preview"
                className="max-w-full max-h-48 rounded-lg border border-slate-200 shadow-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VisionLogPanel() {
  const logs = useVisionLogStore((s) => s.logs);
  const isExecuting = useVisionLogStore((s) => s.isExecuting);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0 && !isExecuting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-slate-500 text-sm">
            Enter a target description and click Send to start
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Vision logs will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
    >
      {logs.map((entry) => (
        <LogEntry key={entry.id} entry={entry} />
      ))}

      {isExecuting && (
        <div className="flex items-center gap-2 p-3 bg-primary-light/20 rounded-xl border border-primary-light/40 animate-pulse">
          <span className="animate-spin text-primary">{LoadingSVG}</span>
          <span className="text-sm text-primary font-medium">Processing...</span>
        </div>
      )}
    </div>
  );
}
