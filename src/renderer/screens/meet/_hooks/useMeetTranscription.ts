import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptionRunRecord } from "../../../../common/types";
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
import { useMeetHistoryStore } from "../../../utils/store";
import WorkerUrl from "../../../workers/parakeet.worker.ts?worker&url";

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
const TRANSCRIPTION_IN_PROGRESS_ERROR = "Transcription request already in progress";

interface PendingPromise<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

function joinTranscriptParts(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
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
  const currentTranscriptionRun = useMeetHistoryStore(
    (s) => s.currentTranscriptionRun,
  );
  const setTranscriptionRuns = useMeetHistoryStore((s) => s.setTranscriptionRuns);
  const setCurrentTranscriptionRun = useMeetHistoryStore(
    (s) => s.setCurrentTranscriptionRun,
  );
  const clearCurrentTranscriptionRun = useMeetHistoryStore(
    (s) => s.clearCurrentTranscriptionRun,
  );

  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioBufferRef = useRef<AudioBufferStore | null>(null);
  const streamingRef = useRef<SmartProgressiveStreamingHandler | null>(null);
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const isStoppingRef = useRef(false);
  const activeTranscriptionTaskRef =
    useRef<Promise<ModelTranscriptionResult> | null>(null);
  const baseTranscriptRef = useRef("");
  const baseDurationRef = useRef(0);
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

    const worker = new Worker(WorkerUrl, { type: "module" });
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
        return Promise.reject(new Error(TRANSCRIPTION_IN_PROGRESS_ERROR));
      }

      const task = new Promise<ModelTranscriptionResult>((resolve, reject) => {
        pendingTranscribeRef.current = { resolve, reject };
        worker.postMessage({
          type: "transcribe",
          data: { audio },
        });
      });

      const trackedTask = task.finally(() => {
        if (activeTranscriptionTaskRef.current === trackedTask) {
          activeTranscriptionTaskRef.current = null;
        }
      });

      activeTranscriptionTaskRef.current = trackedTask;

      return task;
    },
    [ensureWorker],
  );

  const syncRunInStore = useCallback(
    (run: TranscriptionRunRecord) => {
      const existingRuns = useMeetHistoryStore.getState().transcriptionRuns;
      const nextRuns = [run, ...existingRuns.filter((item) => item.id !== run.id)];
      setTranscriptionRuns(nextRuns);
      setCurrentTranscriptionRun(run);
    },
    [setCurrentTranscriptionRun, setTranscriptionRuns],
  );

  const waitForPendingTranscription = useCallback(async () => {
    const pendingTask = activeTranscriptionTaskRef.current;
    if (!pendingTask) {
      return;
    }

    try {
      await pendingTask;
    } catch {
      // Surface the actual error from the request path instead of compounding it.
    }
  }, []);

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
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to initialize WebGPU transcription";
      setModelStatus("error");
      setModelMessage(message);
      setError(message);
    }
  }, [loadForDevice, modelStatus]);

  const ensureActiveRun = useCallback(async (): Promise<TranscriptionRunRecord> => {
    if (currentTranscriptionRun) {
      return currentTranscriptionRun;
    }

    const createdRun = await window.electronAPI.dbCreateTranscriptionRun("", 0);
    syncRunInStore(createdRun);
    return createdRun;
  }, [currentTranscriptionRun, syncRunInStore]);

  const persistRunContent = useCallback(
    async (
      runId: string,
      transcriptText: string,
      durationSeconds: number,
    ): Promise<TranscriptionRunRecord | null> => {
      const updatedRun = await window.electronAPI.dbUpdateTranscriptionRun(
        runId,
        transcriptText,
        durationSeconds,
      );
      syncRunInStore(updatedRun);
      return updatedRun;
    },
    [syncRunInStore],
  );

  const finalizeTranscription = useCallback(
    async (audio: Float32Array): Promise<string> => {
      if (!streamingRef.current) {
        return "";
      }

      try {
        return await streamingRef.current.finalize(audio);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === TRANSCRIPTION_IN_PROGRESS_ERROR
        ) {
          await waitForPendingTranscription();
          return (await streamingRef.current.finalize(audio)).trim();
        }
        throw error;
      }
    },
    [waitForPendingTranscription],
  );

  const stopRecording = useCallback(async () => {
    if (!isRecording && !recorderRef.current) {
      return;
    }

    clearPollingTimer();
    isStoppingRef.current = true;

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      await recorder.stop();
    }

    await waitForPendingTranscription();

    inFlightRef.current = false;
    const audio = audioBufferRef.current?.getBuffer() ?? new Float32Array(0);
    let nextTranscript = baseTranscriptRef.current;
    let nextDuration = baseDurationRef.current;
    if (audio.length > 0 && streamingRef.current) {
      try {
        const finalText = await finalizeTranscription(audio);
        const normalizedText = finalText.trim();
        nextTranscript = joinTranscriptParts(
          baseTranscriptRef.current,
          normalizedText,
        );
        nextDuration = baseDurationRef.current + audio.length / SAMPLE_RATE;
        setFixedText(nextTranscript);

        const activeRun = currentTranscriptionRun ?? (await ensureActiveRun());
        await persistRunContent(activeRun.id, nextTranscript, nextDuration);
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
    setTimestampSeconds(nextDuration);
    setIsRecording(false);
    isStoppingRef.current = false;
  }, [
    clearPollingTimer,
    currentTranscriptionRun,
    ensureActiveRun,
    finalizeTranscription,
    isRecording,
    persistRunContent,
    waitForPendingTranscription,
  ]);

  const startRecording = useCallback(async () => {
    if (modelStatus !== "ready") {
      setError("Load model before starting recording.");
      return;
    }
    if (isRecording || isStoppingRef.current) {
      return;
    }

    setError(null);
    const activeRun = await ensureActiveRun();
    const initialTranscript = activeRun.transcriptText.trim();
    baseTranscriptRef.current = initialTranscript;
    baseDurationRef.current = activeRun.durationSeconds;

    setFixedText(initialTranscript);
    setActiveText("");
    setTimestampSeconds(activeRun.durationSeconds);
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

      const duration = baseDurationRef.current + audioBuffer.length / SAMPLE_RATE;
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
        setFixedText(joinTranscriptParts(baseTranscriptRef.current, result.fixedText));
        setActiveText(result.activeText);
      } catch (transcribeError) {
        if (
          transcribeError instanceof Error &&
          transcribeError.message === TRANSCRIPTION_IN_PROGRESS_ERROR
        ) {
          return;
        }
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
  }, [ensureActiveRun, isRecording, modelStatus, transcribeWithWorker]);

  const resetSession = useCallback(async () => {
    if (isRecording || recorderRef.current) {
      await stopRecording();
    }
    audioBufferRef.current?.reset();
    streamingRef.current?.reset();
    clearCurrentTranscriptionRun();
    baseTranscriptRef.current = "";
    baseDurationRef.current = 0;
    setFixedText("");
    setActiveText("");
    setTimestampSeconds(0);
    setAudioLevel(0);
    setError(null);
  }, [clearCurrentTranscriptionRun, isRecording, stopRecording]);

  useEffect(() => {
    if (!currentTranscriptionRun || isRecording) {
      return;
    }

    setFixedText(currentTranscriptionRun.transcriptText);
    setActiveText("");
    setTimestampSeconds(currentTranscriptionRun.durationSeconds);
    setAudioLevel(0);
    setError(null);
    baseTranscriptRef.current = currentTranscriptionRun.transcriptText.trim();
    baseDurationRef.current = currentTranscriptionRun.durationSeconds;
  }, [currentTranscriptionRun, isRecording]);

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
