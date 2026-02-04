import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE_URL = "http://localhost:8000";
const WS_BASE_URL = "ws://localhost:8000";

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
  | "paused"
  | "error"
  | "disconnecting";

export function useAudioTranscription() {
  const [status, setStatus] = useState<AudioSessionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const addTranscription = useCallback((msg: TranscriptionMessage) => {
    setTranscriptions((prev) => [...prev, msg]);
  }, []);

  const connectWebSocket = useCallback(
    (sid: string) => {
      clearReconnectTimeout();

      try {
        const ws = new WebSocket(`${WS_BASE_URL}/audio/stream`);

        ws.onopen = () => {
          console.log("[Audio] WebSocket connected");
          setStatus("recording");
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "status") {
              console.log("[Audio] Status:", data.status);
            } else if (data.type === "transcription" && data.data) {
              addTranscription(data.data);
            }
          } catch (err) {
            console.error("[Audio] Failed to parse message:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("[Audio] WebSocket error:", err);
          setError("Connection error occurred");
          setStatus("error");
        };

        ws.onclose = () => {
          console.log("[Audio] WebSocket closed");
          wsRef.current = null;

          if (status === "recording") {
            // Unexpected disconnect, try to reconnect
            setStatus("connecting");
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket(sid);
            }, 2000);
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.error("[Audio] Failed to create WebSocket:", err);
        setError("Failed to connect to audio service");
        setStatus("error");
      }
    },
    [addTranscription, status],
  );

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (status !== "idle") {
      console.warn("[Audio] Cannot start - not in idle state");
      return false;
    }

    setStatus("connecting");
    setError(null);
    setTranscriptions([]);

    abortControllerRef.current = new AbortController();

    try {
      // Start the recording session
      const response = await fetch(`${API_BASE_URL}/audio/start`, {
        method: "POST",
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to start recording: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === "recording" && data.session_id) {
        setSessionId(data.session_id);

        // Connect WebSocket for real-time transcription
        connectWebSocket(data.session_id);

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
  }, [status, connectWebSocket]);

  const stopRecording = useCallback(async (): Promise<
    TranscriptionMessage[]
  > => {
    if (status !== "recording" && status !== "error") {
      console.warn("[Audio] Cannot stop - not recording");
      return transcriptions;
    }

    setStatus("disconnecting");
    clearReconnectTimeout();

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.send("stop");
        wsRef.current.close();
      } catch (err) {
        console.error("[Audio] Error closing WebSocket:", err);
      }
      wsRef.current = null;
    }

    // Abort any pending HTTP requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    try {
      // Stop the recording session
      const response = await fetch(`${API_BASE_URL}/audio/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        console.warn("[Audio] Stop request failed:", response.statusText);
      } else {
        const data = await response.json();
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

  const pauseRecording = useCallback(async (): Promise<boolean> => {
    // For now, pause just stops the WebSocket but keeps the session
    // In a more advanced implementation, we could have a pause endpoint
    if (wsRef.current && status === "recording") {
      wsRef.current.send("stop");
      wsRef.current.close();
      wsRef.current = null;
      setStatus("paused");
      return true;
    }
    return false;
  }, [status]);

  const resumeRecording = useCallback(async (): Promise<boolean> => {
    if (status === "paused" && sessionId) {
      connectWebSocket(sessionId);
      return true;
    }
    return false;
  }, [status, sessionId, connectWebSocket]);

  const toggleRecording = useCallback(async (): Promise<boolean> => {
    if (status === "recording") {
      return await pauseRecording();
    } else if (status === "paused") {
      return await resumeRecording();
    }
    return false;
  }, [status, pauseRecording, resumeRecording]);

  // Use a ref to track status for cleanup without causing effect to re-run
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Cleanup on unmount only - empty dependency array ensures this only runs once
  useEffect(() => {
    return () => {
      clearReconnectTimeout();

      if (wsRef.current) {
        wsRef.current.close();
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Try to stop any active recording
      if (statusRef.current === "recording" || statusRef.current === "paused") {
        fetch(`${API_BASE_URL}/audio/stop`, { method: "POST" }).catch(
          console.error,
        );
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
    isPaused: status === "paused",
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleRecording,
  };
}

export default useAudioTranscription;
