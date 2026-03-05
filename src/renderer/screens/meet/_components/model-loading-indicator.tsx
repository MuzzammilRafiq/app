interface ModelLoadingIndicatorProps {
  message: string;
  className?: string;
}

function getProgress(message: string): number | null {
  const match = message.match(/(\d+)%/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function getLabel(message: string, progress: number | null): string {
  if (progress !== null) {
    return "Downloading model";
  }
  if (message.toLowerCase().includes("webgpu unavailable")) {
    return "Switching backend";
  }
  return "Loading model";
}

export default function ModelLoadingIndicator({
  message,
  className = "",
}: ModelLoadingIndicatorProps) {
  const progress = getProgress(message);
  const label = getLabel(message, progress);
  const progressWidth = progress ?? 14;

  return (
    <div
      className={`rounded-xl border border-border/70 bg-bg-app/72 p-4 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12 shrink-0">
          <span className="absolute inset-0 rounded-full border border-primary/15" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/45 animate-spin" />
          <span className="absolute inset-[10px] rounded-full bg-primary/10 animate-pulse" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-primary shadow-[0_0_12px_rgba(62,39,35,0.35)]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-main">{label}</p>
            {progress !== null && (
              <span className="font-mono text-sm font-semibold text-text-main">
                {progress}%
              </span>
            )}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-primary/12">
            <div
              className="h-full rounded-sm bg-[linear-gradient(90deg,rgba(62,39,35,0.92),rgba(93,64,55,0.72),rgba(215,204,200,0.95))] transition-[width] duration-300 ease-out animate-pulse"
              style={{ width: `${Math.max(progressWidth, 10)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 rounded-sm bg-primary/60 animate-bounce"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
