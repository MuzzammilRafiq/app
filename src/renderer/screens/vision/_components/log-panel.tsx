import { useEffect, useRef } from "react";
import { useVisionLogStore, type VisionLogEntry } from "../../../utils/store";
import { LoadingSVG } from "../../../components/icons";

const LOG_TYPE_STYLES: Record<
  VisionLogEntry["type"],
  { bg: string; border: string; icon: string; titleColor: string }
> = {
  server: {
    bg: "bg-text-subtle/10",
    border: "border-border",
    icon: "🌐",
    titleColor: "text-text-main",
  },
  "llm-request": {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: "📤",
    titleColor: "text-blue-600 dark:text-blue-400",
  },
  "llm-response": {
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: "📥",
    titleColor: "text-green-600 dark:text-green-400",
  },
  thinking: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    icon: "🧠",
    titleColor: "text-purple-600 dark:text-purple-400",
  },
  status: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: "⚡",
    titleColor: "text-amber-600 dark:text-amber-400",
  },
  "vision-status": {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: "🔍",
    titleColor: "text-amber-600 dark:text-amber-400",
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: "❌",
    titleColor: "text-red-600 dark:text-red-400",
  },
  "image-preview": {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    icon: "🖼️",
    titleColor: "text-indigo-600 dark:text-indigo-400",
  },
};

function LogEntry({ entry }: { entry: VisionLogEntry }) {
  const style = LOG_TYPE_STYLES[entry.type];
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Determine image source - use base64 if available, otherwise use file path
  const imageSrc = entry.imageBase64
    ? `data:image/png;base64,${entry.imageBase64}`
    : entry.imagePath
      ? `file://${entry.imagePath}`
      : null;

  return (
    <div
      className={`p-3 rounded-xl border ${style.bg} ${style.border} animate-fade-in shadow-sm`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-semibold ${style.titleColor} truncate`}>
              {entry.title}
            </p>
            <span className="text-[10px] text-text-subtle shrink-0">
              {time}
            </span>
          </div>
          {entry.content && (
            <p className="text-[12px] text-text-muted mt-1 whitespace-pre-wrap break-all font-mono leading-relaxed">
              {entry.content}
            </p>
          )}
          {imageSrc && (
            <div className="mt-2">
              <img
                src={imageSrc}
                alt="Preview"
                className="w-full max-h-40 object-contain rounded-lg border border-border shadow-sm"
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
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary-light/40 border border-primary/20 flex items-center justify-center text-xl mb-3">
            🔍
          </div>
          <p className="text-text-main text-sm font-medium">
            Enter a target description to begin
          </p>
          <p className="text-text-subtle text-xs mt-1">
            Vision logs will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-bg-app"
    >
      {logs.map((entry) => (
        <LogEntry key={entry.id} entry={entry} />
      ))}

      {isExecuting && (
        <div className="flex items-center gap-2 p-3 bg-primary-light/20 rounded-xl border border-primary-light/40 animate-pulse">
          <span className="animate-spin text-primary">{LoadingSVG}</span>
          <span className="text-sm text-primary font-medium">
            Processing...
          </span>
        </div>
      )}
    </div>
  );
}
