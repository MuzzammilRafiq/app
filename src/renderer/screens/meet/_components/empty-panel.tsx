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
  const isLoading = modelStatus === "loading";

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-border/50 bg-surface/50 p-8 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-8 text-center mt-8">
          <div>
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {getStatusLabel(modelStatus)}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-text-main">
              Live transcription
            </h2>
            <p className="mt-2 text-text-muted max-w-sm mx-auto">
              Start recording to see live transcription text generated locally
              on your device.
            </p>
          </div>

          <div className="w-full max-w-md">
            {isLoading ? (
              <ModelLoadingIndicator message={modelMessage} />
            ) : (
              <div className="flex justify-center p-4">
                <AudioLevelMeter
                  level={audioLevel}
                  isActive={false}
                  className="min-h-[80px] justify-center"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
            {modelStatus !== "ready" ? (
              <button
                onClick={() => void onLoadModel()}
                disabled={isLoading}
                className="w-full rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--btn-accent-bg)",
                  color: "var(--btn-accent-text)",
                  boxShadow: "0 8px 20px -10px rgba(62,39,35,0.8)",
                }}
              >
                {isLoading ? "Loading..." : "Load Model"}
              </button>
            ) : (
              <button
                onClick={() => void onStartRecording()}
                className="w-full rounded-full px-6 py-3 text-sm font-medium transition-all shadow-sm hover:opacity-90"
                style={{
                  backgroundColor: "var(--btn-accent-bg)",
                  color: "var(--btn-accent-text)",
                  boxShadow: "0 8px 20px -10px rgba(62,39,35,0.8)",
                }}
              >
                Start Recording
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
