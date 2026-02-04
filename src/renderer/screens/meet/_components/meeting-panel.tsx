import { useState } from "react";
import type { MeetSession } from "../index";

interface MeetingPanelProps {
  session: MeetSession;
  onEndSession: () => void;
  onToggleRecording: () => void;
  isConnecting?: boolean;
}

export default function MeetingPanel({
  session,
  onEndSession,
  onToggleRecording,
  isConnecting = false,
}: MeetingPanelProps) {
  const [notes, setNotes] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  // Mock AI suggestions for demonstration
  const mockSuggestions = [
    {
      id: "1",
      type: "action",
      text: "Action item: Follow up on budget discussion",
      timestamp: Date.now() - 300000,
    },
    {
      id: "2",
      type: "summary",
      text: "Summary: Team agreed on Q4 priorities",
      timestamp: Date.now() - 120000,
    },
    {
      id: "3",
      type: "question",
      text: "Question: What's the deadline for the project?",
      timestamp: Date.now() - 60000,
    },
  ];

  return (
    <>
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main transcription area */}
        <div className="flex-1 flex flex-col p-4">
          {/* Session header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-text-main">
                {session.title}
              </h2>
              <p className="text-sm text-text-muted">
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                    Connecting to audio service...
                  </span>
                ) : session.isRecording ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Recording • {session.duration}
                  </span>
                ) : (
                  "Paused"
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAISuggestions(!showAISuggestions)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showAISuggestions
                    ? "bg-primary text-white"
                    : "border border-border hover:bg-surface"
                }`}
              >
                AI Suggestions
              </button>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showNotes
                    ? "bg-primary text-white"
                    : "border border-border hover:bg-surface"
                }`}
              >
                Notes
              </button>
            </div>
          </div>

          {/* Transcription area */}
          <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-medium text-text-main">Live Transcription</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {session.transcription?.length || 0} lines
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!session.transcription || session.transcription.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted">
                  <svg
                    className="w-12 h-12 mb-3 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  <p>Start speaking to see transcription...</p>
                  <p className="text-sm">
                    The AI will transcribe and analyze your meeting
                  </p>
                </div>
              ) : (
                session.transcription.map((line, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-xs text-text-muted shrink-0 w-12">
                      {line.timestamp}
                    </span>
                    <div className="flex-1">
                      <span className="font-medium text-primary text-sm">
                        {line.speaker}:
                      </span>
                      <p className="text-text-main mt-0.5">{line.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleRecording}
                disabled={isConnecting}
                className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  session.isRecording
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-primary text-white hover:bg-primary/90"
                }`}
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Connecting...
                  </>
                ) : session.isRecording ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Resume
                  </>
                )}
              </button>

              <button
                onClick={onEndSession}
                className="px-6 py-2.5 rounded-full border border-border hover:bg-surface text-text-main font-medium text-sm transition-all duration-200"
              >
                End Session
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-muted">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              AI Active
            </div>
          </div>
        </div>

        {/* Side panels */}
        <div className="w-80 border-l border-border flex flex-col">
          {/* AI Suggestions Panel */}
          {showAISuggestions && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-medium text-text-main flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  AI Insights
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {mockSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-3 rounded-lg bg-primary/5 border border-primary/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          suggestion.type === "action"
                            ? "bg-orange-100 text-orange-700"
                            : suggestion.type === "question"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {suggestion.type}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(suggestion.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-text-main">{suggestion.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Panel */}
          {showNotes && (
            <div
              className={`flex flex-col ${showAISuggestions ? "h-1/2 border-t border-border" : "flex-1"}`}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-medium text-text-main">Notes</h3>
                <button
                  onClick={() => setNotes("")}
                  className="text-xs text-text-muted hover:text-text-main"
                >
                  Clear
                </button>
              </div>

              <div className="flex-1 p-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Take notes here..."
                  className="w-full h-full resize-none bg-surface border border-border rounded-lg p-3 text-text-main placeholder-text-muted focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
