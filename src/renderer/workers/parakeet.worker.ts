/// <reference lib="webworker" />

import { fromHub } from "parakeet.js";

interface WordAlignment {
  text: string;
  start_time?: number;
  end_time?: number;
}

interface RawTranscriptionResult {
  utterance_text?: string;
  words?: WordAlignment[];
  confidence_scores?: unknown;
  metrics?: unknown;
}

interface ParakeetModel {
  transcribe: (
    audio: Float32Array,
    sampleRate: number,
    options?: Record<string, unknown>,
  ) => Promise<RawTranscriptionResult>;
}

interface Sentence {
  text: string;
  start: number;
  end: number;
}

interface TranscriptionPayload {
  text: string;
  sentences: Sentence[];
  words: WordAlignment[];
  metadata: {
    latency: number;
    audioDuration: number;
    rtf: number;
    confidence: unknown;
    metrics: unknown;
  };
}

type WorkerRequest =
  | {
      type: "load";
      data?: {
        modelVersion?: string;
        options?: {
          device?: "webgpu" | "wasm";
        };
      };
    }
  | {
      type: "transcribe";
      data: {
        audio: Float32Array;
      };
    }
  | {
      type: "ping";
    };

type WorkerResponse =
  | { status: "loading"; message: string }
  | { status: "ready"; message: string; device: string; modelVersion: string }
  | { status: "initiate"; file: string; progress: number; total: number }
  | {
      status: "progress";
      file: string;
      progress: number;
      total: number;
      loaded: number;
    }
  | { status: "done"; file: string }
  | { status: "transcription"; result: TranscriptionPayload }
  | { status: "error"; message: string; error: string }
  | { status: "pong" };

const worker = self;

let model: ParakeetModel | null = null;
let isLoading = false;

function postMessage(message: WorkerResponse): void {
  worker.postMessage(message);
}

function groupWordsIntoSentences(words: WordAlignment[]): Sentence[] {
  if (words.length === 0) {
    return [];
  }

  const sentences: Sentence[] = [];
  let currentWords: string[] = [];
  let sentenceStart = words[0]?.start_time ?? 0;

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (!word) {
      continue;
    }
    currentWords.push(word.text);
    const isTerminal = /[.!?]$/.test(word.text);
    const isLastWord = index === words.length - 1;

    if (isTerminal || isLastWord) {
      sentences.push({
        text: currentWords.join(" ").trim(),
        start: sentenceStart,
        end: word.end_time ?? word.start_time ?? sentenceStart,
      });

      if (!isLastWord) {
        currentWords = [];
        sentenceStart = words[index + 1]?.start_time ?? sentenceStart;
      }
    }
  }

  return sentences;
}

async function loadModel(
  modelVersion = "parakeet-tdt-0.6b-v2",
  device: "webgpu" | "wasm" = "webgpu",
): Promise<void> {
  if (isLoading) {
    postMessage({ status: "loading", message: "Model is already loading..." });
    return;
  }
  if (model) {
    postMessage({
      status: "ready",
      message: "Model already loaded",
      device,
      modelVersion,
    });
    return;
  }

  isLoading = true;
  try {
    const backend = device === "webgpu" ? "webgpu-hybrid" : "wasm";
    postMessage({
      status: "loading",
      message: `Loading ${modelVersion} (${backend})...`,
    });

    const initiatedFiles = new Set<string>();
    const quantization =
      backend === "wasm"
        ? { encoderQuant: "int8", decoderQuant: "int8", preprocessor: "nemo128" }
        : { encoderQuant: "fp32", decoderQuant: "int8", preprocessor: "nemo128" };

    const loadFromHub = fromHub as unknown as (
      version: string,
      options: Record<string, unknown>,
    ) => Promise<unknown>;
    model = (await loadFromHub(modelVersion, {
      backend,
      ...quantization,
      progress: (progressData: { loaded: number; total: number; file: string }) => {
        const { loaded, total, file } = progressData;
        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;

        if (!initiatedFiles.has(file)) {
          initiatedFiles.add(file);
          postMessage({ status: "initiate", file, progress: 0, total });
        }

        postMessage({
          status: "progress",
          file,
          progress,
          total,
          loaded,
        });

        if (loaded >= total) {
          postMessage({ status: "done", file });
        }
      },
    })) as ParakeetModel;

    await model.transcribe(new Float32Array(16000), 16000);

    postMessage({
      status: "ready",
      message: `${modelVersion} ready`,
      device: backend,
      modelVersion,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load model";
    postMessage({ status: "error", message, error: String(error) });
    model = null;
  } finally {
    isLoading = false;
  }
}

async function transcribe(audio: Float32Array): Promise<void> {
  if (!model) {
    throw new Error("Model not loaded");
  }

  const start = performance.now();
  const result = await model.transcribe(audio, 16000, {
    returnTimestamps: true,
    returnConfidences: true,
    temperature: 1.0,
  });
  const end = performance.now();

  const words = result.words ?? [];
  const sentences = groupWordsIntoSentences(words);
  const latency = (end - start) / 1000;
  const audioDuration = audio.length / 16000;
  const rtf = latency > 0 ? audioDuration / latency : 0;

  postMessage({
    status: "transcription",
    result: {
      text: result.utterance_text ?? "",
      sentences,
      words,
      metadata: {
        latency,
        audioDuration,
        rtf,
        confidence: result.confidence_scores ?? null,
        metrics: result.metrics ?? null,
      },
    },
  });
}

worker.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "load") {
      await loadModel(
        message.data?.modelVersion,
        message.data?.options?.device ?? "webgpu",
      );
      return;
    }
    if (message.type === "transcribe") {
      await transcribe(message.data.audio);
      return;
    }
    if (message.type === "ping") {
      postMessage({ status: "pong" });
      return;
    }

    postMessage({
      status: "error",
      message: "Unknown message type",
      error: "unknown_message",
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unexpected worker error";
    postMessage({
      status: "error",
      message: messageText,
      error: String(error),
    });
  }
};
