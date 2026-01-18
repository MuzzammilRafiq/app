import { useEffect, useRef, type ReactNode } from "react";
import { useVisionLogStore, type VisionLogEntry } from "../../../utils/store";
import { LoadingSVG } from "../../../components/icons";
import {
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Brain,
  Zap,
  Search,
  XCircle,
  ImageIcon,
  Activity,
} from "lucide-react";

type LogTypeStyle = {
  icon: ReactNode;
};

const LOG_TYPE_STYLES: Record<VisionLogEntry["type"], LogTypeStyle> = {
  server: {
    icon: <Globe size={16} />,
  },
  "llm-request": {
    icon: <ArrowUpRight size={16} />,
  },
  "llm-response": {
    icon: <ArrowDownLeft size={16} />,
  },
  thinking: {
    icon: <Brain size={16} />,
  },
  status: {
    icon: <Zap size={16} />,
  },
  "vision-status": {
    icon: <Search size={16} />,
  },
  error: {
    icon: <XCircle size={16} />,
  },
  "image-preview": {
    icon: <ImageIcon size={16} />,
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

  const isError = entry.type === "error";

  return (
    <div
      className={`py-3 ${isError ? "border-l-2 border-red-500 dark:border-red-400 pl-3 bg-red-50/30 dark:bg-red-950/20 rounded-r-md" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 text-primary">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-main">{entry.title}</p>
            <span className="text-xs text-text-subtle shrink-0 tabular-nums">
              {time}
            </span>
          </div>
          {entry.content && (
            <p className="text-base text-text-main mt-1 whitespace-pre-wrap wrap-break-word leading-relaxed">
              {entry.content}
            </p>
          )}
          {imageSrc && (
            <div className="mt-3">
              <img
                src={imageSrc}
                alt="Preview"
                className="w-full max-h-80 object-contain rounded-lg border border-border"
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
      <div className="flex-1 flex items-center justify-center px-6 bg-bg-app">
        <div className="text-center max-w-md">
          <div className="mx-auto w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mb-3">
            <Activity size={20} className="text-text-subtle" />
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
      className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-bg-app"
    >
      {logs.map((entry) => (
        <LogEntry key={entry.id} entry={entry} />
      ))}

      {isExecuting && (
        <div className="flex items-center gap-3 py-3">
          <span className="animate-spin text-primary">{LoadingSVG}</span>
          <span className="text-sm text-text-muted font-medium">
            Processing...
          </span>
        </div>
      )}
    </div>
  );
}
