import { useState, useEffect, useCallback } from "react";
import EmptyPanel from "./_components/empty-panel";
import MeetingPanel from "./_components/meeting-panel";
import { useAudioTranscription } from "../../hooks/useAudioTranscription";

export interface TranscriptionLine {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface MeetSession {
  id: string;
  title: string;
  isRecording: boolean;
  duration: string;
  transcription: TranscriptionLine[];
  createdAt: number;
}

export default function MeetScreen() {
  const [activeSession, setActiveSession] = useState<MeetSession | null>(null);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const {
    sessionId,
    transcriptions: audioTranscriptions,
    error: audioError,
    isConnecting,
    isRecording,
    startRecording,
    stopRecording,
  } = useAudioTranscription();

  // Handle new session callback from sidebar/App
  useEffect(() => {
    (window as any).__meetNewSession = () => {
      handleEndSession();
    };

    return () => {
      (window as any).__meetNewSession = undefined;
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // Update session state when audio status changes
  useEffect(() => {
    if (activeSession) {
      setActiveSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          isRecording: isRecording,
        };
      });
    }
  }, [isRecording]);

  // Sync audio transcriptions to session
  useEffect(() => {
    if (activeSession && audioTranscriptions.length > 0) {
      // Convert audio transcriptions to session format
      const newTranscriptionLines: TranscriptionLine[] =
        audioTranscriptions.map((t) => ({
          timestamp: new Date(t.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          speaker: "Speaker", // Could be enhanced with speaker detection
          text: t.text,
        }));

      setActiveSession((prev) => {
        if (!prev) return null;

        // Merge with existing, avoiding duplicates by timestamp
        const existingTimestamps = new Set(
          prev.transcription.map((t) => t.timestamp),
        );
        const uniqueNewLines = newTranscriptionLines.filter(
          (t) => !existingTimestamps.has(t.timestamp),
        );

        if (uniqueNewLines.length === 0) return prev;

        return {
          ...prev,
          transcription: [...prev.transcription, ...uniqueNewLines],
        };
      });
    }
  }, [audioTranscriptions, activeSession]);

  // Handle audio errors
  useEffect(() => {
    if (audioError) {
      setConnectionError(audioError);
    }
  }, [audioError]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartListening = async (title: string) => {
    setConnectionError(null);

    const newSession: MeetSession = {
      id: crypto.randomUUID(),
      title: title || "Untitled Meeting",
      isRecording: false,
      duration: "00:00",
      transcription: [],
      createdAt: Date.now(),
    };

    setActiveSession(newSession);

    // Start the audio recording
    const success = await startRecording();

    if (!success) {
      setConnectionError(
        "Failed to start recording. Please check your microphone permissions.",
      );
      setActiveSession(null);
      return;
    }

    // Start duration timer
    let seconds = 0;
    const interval = setInterval(() => {
      seconds++;
      setActiveSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          duration: formatDuration(seconds),
        };
      });
    }, 1000);
    setTimerInterval(interval);
  };

  const handleEndSession = useCallback(async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    // Stop audio recording
    await stopRecording();

    setActiveSession(null);
    setConnectionError(null);
  }, [timerInterval, stopRecording]);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-bg-app w-full max-w-6xl mx-auto">
      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 px-4 py-2 text-sm flex items-center justify-between">
          <span>Error: {connectionError}</span>
          <button
            onClick={() => setConnectionError(null)}
            className="text-red-600 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Status Indicator */}
      {activeSession && (
        <div className="px-4 py-1 bg-surface border-b border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnecting
                  ? "bg-yellow-500 animate-pulse"
                  : isRecording
                    ? "bg-red-500 animate-pulse"
                    : "bg-gray-400"
              }`}
            />
            <span className="text-text-muted">
              {isConnecting
                ? "Connecting to audio service..."
                : isRecording
                  ? "Recording in progress"
                  : "Initializing..."}
            </span>
            {sessionId && (
              <span className="text-text-muted/50">
                • Session: {sessionId.slice(-6)}
              </span>
            )}
          </div>
          <span className="text-text-muted">
            {activeSession.transcription.length} lines transcribed
          </span>
        </div>
      )}

      {activeSession ? (
        <MeetingPanel
          session={activeSession}
          onEndSession={handleEndSession}
          isConnecting={isConnecting}
        />
      ) : (
        <EmptyPanel
          onStartListening={handleStartListening}
          isConnecting={isConnecting}
        />
      )}
    </div>
  );
}
