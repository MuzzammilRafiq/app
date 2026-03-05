import { useEffect, useRef } from "react";
import AudioLevelMeter from "./audio-level-meter";
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
  onReset: () => Promise<void>;
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
  onReset,
}: MeetingPanelProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const hasText = fixedText.trim().length > 0 || activeText.trim().length > 0;
  const modelReady = modelStatus === "ready";
  const loadingModel = modelStatus === "loading";

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }
    contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [fixedText, activeText]);

  return (
    <div className="flex min-h-0 flex-1 p-4">
      <div className="grid min-h-0 flex-1 gap-4 rounded-2xl border border-border bg-surface p-4 shadow-premium lg:grid-cols-[minmax(0,1fr)_220px]">
        <section className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-text-main">
                Transcript
              </h2>
              <span className="rounded-lg border border-border/70 bg-bg-app px-2.5 py-1 text-xs font-medium text-text-muted">
                {getModelLabel(modelStatus)}
              </span>
              <span className="rounded-lg border border-border/70 bg-bg-app px-2.5 py-1 font-mono text-xs font-medium text-text-main">
                {formatTimestamp(timestampSeconds)}
              </span>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  isRecording
                    ? "bg-red-500/10 text-red-600"
                    : "border border-border/70 bg-bg-app text-text-muted"
                }`}
              >
                {isRecording ? "Recording" : "Stopped"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {modelStatus !== "ready" && (
                <button
                  onClick={() => {
                    void onLoadModel();
                  }}
                  disabled={loadingModel}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                  onClick={() => {
                    void onStartRecording();
                  }}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium"
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
                  onClick={() => {
                    void onStopRecording();
                  }}
                  className="rounded-xl border border-border bg-bg-app px-4 py-2.5 text-sm font-medium text-text-main transition-colors duration-200 hover:bg-primary-light/20"
                >
                  Stop Recording
                </button>
              )}

              {hasText && (
                <button
                  onClick={() => {
                    void onReset();
                  }}
                  className="rounded-xl border border-border bg-bg-app px-4 py-2.5 text-sm font-medium text-text-main transition-colors duration-200 hover:bg-primary-light/20"
                >
                  New Meeting
                </button>
              )}
            </div>
          </div>

          {loadingModel && <ModelLoadingIndicator message={modelMessage} />}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-[#fffdfb]">
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
              <span className="text-sm font-medium text-text-main">Live text</span>
              <span className="text-xs text-text-muted">
                {hasText ? "Streaming" : isRecording ? "Listening" : "Idle"}
              </span>
            </div>

            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto px-4 py-5 text-[1.08rem] leading-8 text-text-main"
            >
              {!hasText && !isRecording && (
                <p className="text-sm text-text-muted">Start recording to transcribe.</p>
              )}
              {!hasText && isRecording && (
                <p className="text-sm text-text-muted">Listening...</p>
              )}

              {fixedText && (
                <span className="font-medium text-[#7c4a19]">{fixedText}</span>
              )}
              {fixedText && activeText && " "}
              {activeText && (
                <span className="text-text-main underline decoration-primary/30 decoration-2 underline-offset-4">
                  {activeText}
                </span>
              )}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border/80 bg-bg-app/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-main">Audio</span>
              <span className="font-mono text-sm font-semibold text-text-main">
                {Math.round(audioLevel * 100)}%
              </span>
            </div>

            <AudioLevelMeter
              level={audioLevel}
              isActive={isRecording}
              className="mt-4 min-h-[120px] justify-center"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
