import { useState } from "react";
import { VideoCameraSVG } from "../../../components/icons";

interface EmptyPanelProps {
  onStartListening: (meetingName: string) => void;
  isConnecting: boolean;
}

export default function EmptyPanel({
  onStartListening,
  isConnecting,
}: EmptyPanelProps) {
  const [meetingName, setMeetingName] = useState("");

  const handleStart = () => {
    onStartListening(meetingName.trim() || "Untitled Meeting");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleStart();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-light/50 flex items-center justify-center">
            <div className="text-primary">{VideoCameraSVG}</div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-text-main">
            AI Meeting Assistant
          </h2>
          <p className="text-text-muted">
            Transcribe meetings, take notes, and get AI insights
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <input
            type="text"
            value={meetingName}
            onChange={(e) => setMeetingName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Meeting name (optional)"
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-main placeholder-text-muted focus:outline-none focus:border-primary transition-colors text-sm"
          />

          <button
            onClick={handleStart}
            disabled={isConnecting}
            className="w-full py-3 px-6 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--btn-accent-bg)",
              color: "var(--btn-accent-text)",
            }}
            onMouseEnter={(e) =>
              !isConnecting &&
              (e.currentTarget.style.backgroundColor =
                "var(--btn-accent-bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--btn-accent-bg)")
            }
          >
            {isConnecting ? "Starting..." : "Start Recording"}
          </button>
        </div>

        <div className="text-xs text-text-muted pt-4">
          <p>System audio capture will begin automatically</p>
        </div>
      </div>
    </div>
  );
}
