import AudioLevelMeter from "./audio-level-meter";
import ModelLoadingIndicator from "./model-loading-indicator";

interface EmptyPanelProps {
  modelStatus: "not_loaded" | "loading" | "ready" | "error";
  modelMessage: string;
  audioLevel: number;
  onLoadModel: () => Promise<void>;
  onStartRecording: () => Promise<void>;
}

function getStatusLabel(status: EmptyPanelProps["modelStatus"]): string {
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

export default function EmptyPanel({
  modelStatus,
  modelMessage,
  audioLevel,
  onLoadModel,
  onStartRecording,
}: EmptyPanelProps) {
  const canStart = modelStatus === "ready";
  const isLoading = modelStatus === "loading";

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface p-6 shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-subtle">
              Meet
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-main">
              Live transcript
            </h2>
          </div>
          <span className="rounded-lg border border-border/70 bg-bg-app px-3 py-1 text-xs font-medium text-text-muted">
            {getStatusLabel(modelStatus)}
          </span>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <ModelLoadingIndicator message={modelMessage} />
          ) : (
            <AudioLevelMeter
              level={audioLevel}
              isActive={false}
              className="min-h-[120px] justify-center"
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => {
              void onLoadModel();
            }}
            disabled={isLoading || canStart}
            className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--btn-accent-bg)",
              color: "var(--btn-accent-text)",
              boxShadow: "0 18px 35px -24px rgba(62,39,35,0.9)",
            }}
          >
            {canStart ? "Model Ready" : isLoading ? "Loading..." : "Load Model"}
          </button>

          <button
            onClick={() => {
              void onStartRecording();
            }}
            disabled={!canStart}
            className="rounded-xl border border-border bg-bg-app px-4 py-3 text-sm font-medium text-text-main transition-colors duration-200 hover:bg-primary-light/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
