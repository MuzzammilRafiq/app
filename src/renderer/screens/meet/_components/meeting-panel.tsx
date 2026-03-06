import { useEffect, useRef } from "react";
import ModelLoadingIndicator from "./model-loading-indicator";

interface MeetingPanelProps {
  modelStatus: "not_loaded" | "loading" | "ready" | "error";
  modelMessage: string;
  fixedText: string;
  activeText: string;
  isRecording: boolean;
  timestampSeconds: number;
  audioLevel: number;
  onLoadModel: () => Promise<void>;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getModelLabel(status: MeetingPanelProps["modelStatus"]): string {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "loading") {
    return "Loading";
  }
  if (status === "error") {
    return "Error";
  }
  return "Idle";
}

export default function MeetingPanel({
  modelStatus,
  modelMessage,
  fixedText,
  activeText,
  isRecording,
  timestampSeconds,
  audioLevel,
  onLoadModel,
  onStartRecording,
  onStopRecording,
}: MeetingPanelProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const hasFixedText = fixedText.trim().length > 0;
  const hasActiveText = activeText.trim().length > 0;
  const hasText = hasFixedText || hasActiveText;
  const modelReady = modelStatus === "ready";
  const loadingModel = modelStatus === "loading";

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }
    contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [fixedText]);

  return (
    <div className="flex h-full flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-text-main">
              Meet
            </h2>
            {isRecording && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className="font-medium">{getModelLabel(modelStatus)}</span>
            <span>•</span>
            <span className="font-mono">
              {formatTimestamp(timestampSeconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {modelStatus !== "ready" && (
            <button
              onClick={() => void onLoadModel()}
              disabled={loadingModel}
              className="rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                backgroundColor: "var(--btn-accent-bg)",
                color: "var(--btn-accent-text)",
              }}
            >
              {loadingModel ? "Loading..." : "Load Model"}
            </button>
          )}

          {modelReady && !isRecording && (
            <button
              onClick={() => void onStartRecording()}
              className="rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-all hover:opacity-90"
              style={{
                backgroundColor: "var(--btn-accent-bg)",
                color: "var(--btn-accent-text)",
              }}
            >
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={() => void onStopRecording()}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-main shadow-sm transition-all hover:bg-border/30"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {loadingModel && (
        <div className="mb-6">
          <ModelLoadingIndicator message={modelMessage} />
        </div>
      )}

      <div className="relative flex-1 min-h-0 rounded-2xl border border-border/50 bg-surface/50 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col">
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-6 md:p-8 text-[1.1rem] leading-relaxed text-text-main"
        >
          {!hasText && !isRecording && (
            <div className="flex h-full items-center justify-center text-text-muted">
              Ready to start transcription
            </div>
          )}
          {!hasFixedText && isRecording && (
            <div className="flex h-full items-center justify-center text-text-muted animate-pulse">
              Listening...
            </div>
          )}

          <div className="max-w-prose mx-auto w-full">
            {hasFixedText && (
              <span className="text-text-main/90">{fixedText}</span>
            )}
          </div>
        </div>

        {(isRecording || hasActiveText) && (
          <div className="border-t border-border/60 bg-bg-app/70 px-6 py-4 backdrop-blur-sm md:px-8">
            <div className="mx-auto flex w-full max-w-prose flex-col gap-2">
              <div className="text-sm font-medium text-text-muted">
                Live transcription
              </div>
              <div className="min-h-24 rounded-2xl border border-border bg-surface px-4 py-3 text-[1rem] leading-relaxed text-text-main shadow-sm">
                {hasActiveText ? (
                  <span className="relative inline-block font-medium text-text-main">
                    {activeText}
                    <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-primary/20 animate-pulse" />
                  </span>
                ) : (
                  <span className="text-text-muted">
                    {isRecording
                      ? "Current speech will appear here until it is finalized."
                      : "Waiting for the next live segment."}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-primary/10">
            <div
              className="h-full bg-primary/40 transition-all duration-75"
              style={{ width: `${Math.min(100, audioLevel * 200)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
