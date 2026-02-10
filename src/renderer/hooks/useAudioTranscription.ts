import { useState, useEffect, useRef, useCallback } from "react";

export interface TranscriptionMessage {
  text: string;
  timestamp: string;
  is_final: boolean;
}

export interface AudioSession {
  sessionId: string;
  isRecording: boolean;
  isConnecting: boolean;
  error: string | null;
  transcriptions: TranscriptionMessage[];
  lastTranscription: TranscriptionMessage | null;
}

export type AudioSessionStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "error"
  | "disconnecting";

export function useAudioTranscription() {
  const [status, setStatus] = useState<AudioSessionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (status !== "idle") {
      console.warn("[Audio] Cannot start - not in idle state");
      return false;
    }

    setStatus("connecting");
    setError(null);
    setTranscriptions([]);

    try {
      if (!window.electronAPI?.transcriptionStartListening) {
        throw new Error("Electron transcription bridge is not available");
      }

      const response = await window.electronAPI.transcriptionStartListening();
      if (!response.success || !response.data) {
        throw new Error(response.error ?? "Failed to start recording");
      }

      const data = response.data;
      if (data.status === "recording" && data.session_id) {
        setSessionId(data.session_id);
        setStatus("recording");

        return true;
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Audio] Start recording failed:", message);
      setError(message);
      setStatus("error");
      return false;
    }
  }, [status]);

  const stopRecording = useCallback(async (): Promise<
    TranscriptionMessage[]
  > => {
    if (status !== "recording" && status !== "error") {
      console.warn("[Audio] Cannot stop - not recording");
      return transcriptions;
    }

    setStatus("disconnecting");

    try {
      if (!window.electronAPI?.transcriptionStopListening) {
        throw new Error("Electron transcription bridge is not available");
      }
      const response = await window.electronAPI.transcriptionStopListening();
      if (!response.success || !response.data) {
        console.warn("[Audio] Stop request failed:", response.error);
      } else {
        const data = response.data;
        if (data.transcriptions) {
          // Merge any missed transcriptions
          setTranscriptions((prev) => {
            const existingIds = new Set(prev.map((t) => t.timestamp));
            const newTranscriptions = data.transcriptions.filter(
              (t: TranscriptionMessage) => !existingIds.has(t.timestamp),
            );
            return [...prev, ...newTranscriptions];
          });
        }
      }
    } catch (err) {
      console.error("[Audio] Stop recording error:", err);
    }

    setStatus("idle");
    setSessionId(null);

    return transcriptions;
  }, [status, transcriptions]);

  // Use a ref to track status for cleanup without causing effect to re-run
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Cleanup on unmount only - empty dependency array ensures this only runs once
  useEffect(() => {
    return () => {
      // Try to stop any active recording
      if (statusRef.current === "recording") {
        window.electronAPI?.transcriptionStopListening?.().catch(console.error);
      }
    };
  }, []);

  return {
    status,
    sessionId,
    transcriptions,
    error,
    isConnecting: status === "connecting",
    isRecording: status === "recording",
    startRecording,
    stopRecording,
  };
}

export default useAudioTranscription;
