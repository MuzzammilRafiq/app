import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioBufferStore,
  AudioRecorder,
  SAMPLE_RATE,
} from "../_lib/audio-recorder";
import {
  SmartProgressiveStreamingHandler,
  type ModelTranscriptionResult,
  type TranscriptionModel,
} from "../_lib/progressive-streaming";

type ModelStatus = "not_loaded" | "loading" | "ready" | "error";

type WorkerIncomingMessage =
  | { status: "loading"; message: string }
  | { status: "ready"; message: string }
  | { status: "progress"; file: string; progress: number }
  | { status: "transcription"; result: ModelTranscriptionResult }
  | { status: "error"; message: string };

const MODEL_VERSION = "parakeet-tdt-0.6b-v2";
const PROGRESSIVE_INTERVAL_MS = 250;
const MIN_TRANSCRIBE_SAMPLES = SAMPLE_RATE;
const VAD_THRESHOLD = 0.01;

interface PendingPromise<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface MeetTranscriptionState {
  modelStatus: ModelStatus;
  modelMessage: string;
  isRecording: boolean;
  fixedText: string;
  activeText: string;
  timestampSeconds: number;
  audioLevel: number;
  error: string | null;
  loadModel: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetSession: () => Promise<void>;
}

export function useMeetTranscription(): MeetTranscriptionState {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("not_loaded");
  const [modelMessage, setModelMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [fixedText, setFixedText] = useState("");
  const [activeText, setActiveText] = useState("");
  const [timestampSeconds, setTimestampSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioBufferRef = useRef<AudioBufferStore | null>(null);
  const streamingRef = useRef<SmartProgressiveStreamingHandler | null>(null);
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const pendingLoadRef = useRef<PendingPromise<void> | null>(null);
  const pendingTranscribeRef =
    useRef<PendingPromise<ModelTranscriptionResult> | null>(null);

  const clearPollingTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(
      new URL("../../../workers/parakeet.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
      const message = event.data;
      if (message.status === "loading") {
        setModelStatus("loading");
        setModelMessage(message.message);
        return;
      }
      if (message.status === "progress") {
        setModelStatus("loading");
        setModelMessage(
          `Downloading model: ${message.progress}% (${message.file})`,
        );
        return;
      }
      if (message.status === "ready") {
        setModelStatus("ready");
        setModelMessage(message.message);
        setError(null);
        pendingLoadRef.current?.resolve();
        pendingLoadRef.current = null;
        return;
      }
      if (message.status === "transcription") {
        pendingTranscribeRef.current?.resolve(message.result);
        pendingTranscribeRef.current = null;
        return;
      }
      if (message.status === "error") {
        setError(message.message);
        setModelMessage(message.message);
        if (pendingLoadRef.current) {
          setModelStatus("error");
          pendingLoadRef.current.reject(new Error(message.message));
          pendingLoadRef.current = null;
        }

        pendingTranscribeRef.current?.reject(new Error(message.message));
        pendingTranscribeRef.current = null;
      }
    };

    workerRef.current = worker;
    return worker;
  }, []);

  const transcribeWithWorker = useCallback(
    (audio: Float32Array): Promise<ModelTranscriptionResult> => {
      const worker = ensureWorker();
      if (pendingTranscribeRef.current) {
        return Promise.reject(
          new Error("Transcription request already in progress"),
        );
      }

      return new Promise<ModelTranscriptionResult>((resolve, reject) => {
        pendingTranscribeRef.current = { resolve, reject };
        worker.postMessage({
          type: "transcribe",
          data: { audio },
        });
      });
    },
    [ensureWorker],
  );

  const loadForDevice = useCallback(
    (device: "webgpu" | "wasm"): Promise<void> => {
      const worker = ensureWorker();
      return new Promise<void>((resolve, reject) => {
        pendingLoadRef.current = { resolve, reject };
        worker.postMessage({
          type: "load",
          data: {
            modelVersion: MODEL_VERSION,
            options: { device },
          },
        });
      });
    },
    [ensureWorker],
  );

  const loadModel = useCallback(async () => {
    if (modelStatus === "ready" || modelStatus === "loading") {
      return;
    }

    setError(null);
    setModelStatus("loading");
    setModelMessage("Initializing model...");

    try {
      await loadForDevice("webgpu");
    } catch {
      setModelMessage("WebGPU unavailable, retrying with CPU backend...");
      await loadForDevice("wasm");
    }
  }, [loadForDevice, modelStatus]);

  const stopRecording = useCallback(async () => {
    if (!isRecording && !recorderRef.current) {
      return;
    }

    clearPollingTimer();
    setIsRecording(false);

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      await recorder.stop();
    }

    inFlightRef.current = false;
    const audio = audioBufferRef.current?.getBuffer() ?? new Float32Array(0);
    if (audio.length > 0 && streamingRef.current) {
      try {
        const finalText = await streamingRef.current.finalize(audio);
        setFixedText(finalText);
      } catch (stopError) {
        const message =
          stopError instanceof Error
            ? stopError.message
            : "Failed to finalize transcription";
        setError(message);
      }
    }
    setActiveText("");
    setAudioLevel(0);
  }, [clearPollingTimer, isRecording]);

  const startRecording = useCallback(async () => {
    if (modelStatus !== "ready") {
      setError("Load model before starting recording.");
      return;
    }
    if (isRecording) {
      return;
    }

    setError(null);
    setFixedText("");
    setActiveText("");
    setTimestampSeconds(0);
    setAudioLevel(0);

    audioBufferRef.current = new AudioBufferStore();
    const modelWrapper: TranscriptionModel = {
      transcribe: transcribeWithWorker,
    };
    streamingRef.current = new SmartProgressiveStreamingHandler(modelWrapper, {
      maxWindowSize: 15,
      sentenceBuffer: 2,
      sampleRate: SAMPLE_RATE,
    });
    streamingRef.current.reset();

    const recorder = new AudioRecorder(
      (audioChunk) => {
        audioBufferRef.current?.appendChunk(audioChunk);
      },
      (level) => {
        setAudioLevel((currentLevel) => {
          const nextLevel =
            level > currentLevel
              ? currentLevel * 0.5 + level * 0.5
              : currentLevel * 0.8 + level * 0.2;
          return nextLevel < 0.01 ? 0 : nextLevel;
        });
      },
    );
    await recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);

    const tick = async () => {
      if (inFlightRef.current) {
        return;
      }

      const audioBuffer = audioBufferRef.current?.getBuffer();
      if (!audioBuffer) {
        return;
      }

      const duration = audioBuffer.length / SAMPLE_RATE;
      setTimestampSeconds(duration);

      if (audioBuffer.length < MIN_TRANSCRIBE_SAMPLES) {
        return;
      }

      const recentWindow = audioBuffer.slice(-Math.min(audioBuffer.length, 32000));
      let maxAmplitude = 0;
      for (let index = 0; index < recentWindow.length; index++) {
        const sample = Math.abs(recentWindow[index] ?? 0);
        if (sample > maxAmplitude) {
          maxAmplitude = sample;
        }
      }

      if (maxAmplitude < VAD_THRESHOLD) {
        return;
      }

      if (!streamingRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const result = await streamingRef.current.transcribeIncremental(audioBuffer);
        setFixedText(result.fixedText);
        setActiveText(result.activeText);
      } catch (transcribeError) {
        const message =
          transcribeError instanceof Error
            ? transcribeError.message
            : "Transcription failed";
        setError(message);
      } finally {
        inFlightRef.current = false;
      }
    };

    intervalRef.current = window.setInterval(() => {
      void tick();
    }, PROGRESSIVE_INTERVAL_MS);
  }, [isRecording, modelStatus, transcribeWithWorker]);

  const resetSession = useCallback(async () => {
    if (isRecording || recorderRef.current) {
      await stopRecording();
    }
    audioBufferRef.current?.reset();
    streamingRef.current?.reset();
    setFixedText("");
    setActiveText("");
    setTimestampSeconds(0);
    setAudioLevel(0);
    setError(null);
  }, [isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      clearPollingTimer();
      if (recorderRef.current) {
        void recorderRef.current.stop();
        recorderRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [clearPollingTimer]);

  return {
    modelStatus,
    modelMessage,
    isRecording,
    fixedText,
    activeText,
    timestampSeconds,
    audioLevel,
    error,
    loadModel,
    startRecording,
    stopRecording,
    resetSession,
  };
}
