export interface TranscriptSentence {
  text: string;
  start: number;
  end: number;
}

export interface ModelTranscriptionResult {
  text: string;
  sentences: TranscriptSentence[];
}

export interface PartialTranscription {
  fixedText: string;
  activeText: string;
  timestamp: number;
  isFinal: boolean;
}

export interface TranscriptionModel {
  transcribe: (audio: Float32Array) => Promise<ModelTranscriptionResult>;
}

interface StreamingOptions {
  maxWindowSize?: number;
  sentenceBuffer?: number;
  sampleRate?: number;
}

export class SmartProgressiveStreamingHandler {
  private readonly model: TranscriptionModel;
  private readonly maxWindowSize: number;
  private readonly sentenceBuffer: number;
  private readonly sampleRate: number;

  private fixedSentences: string[] = [];
  private fixedEndTime = 0;
  private lastTranscribedLength = 0;

  constructor(model: TranscriptionModel, options: StreamingOptions = {}) {
    this.model = model;
    this.maxWindowSize = options.maxWindowSize ?? 15;
    this.sentenceBuffer = options.sentenceBuffer ?? 2;
    this.sampleRate = options.sampleRate ?? 16000;
  }

  reset(): void {
    this.fixedSentences = [];
    this.fixedEndTime = 0;
    this.lastTranscribedLength = 0;
  }

  async transcribeIncremental(
    audio: Float32Array,
  ): Promise<PartialTranscription> {
    const currentLength = audio.length;
    if (currentLength < this.sampleRate * 0.5) {
      return {
        fixedText: this.fixedSentences.join(" "),
        activeText: "",
        timestamp: currentLength / this.sampleRate,
        isFinal: false,
      };
    }

    if (currentLength === this.lastTranscribedLength) {
      return {
        fixedText: this.fixedSentences.join(" "),
        activeText: "",
        timestamp: currentLength / this.sampleRate,
        isFinal: false,
      };
    }

    this.lastTranscribedLength = currentLength;

    const startSample = Math.floor(this.fixedEndTime * this.sampleRate);
    const audioWindow = audio.slice(startSample);
    const windowDuration = audioWindow.length / this.sampleRate;

    let result = await this.model.transcribe(audioWindow);

    if (
      windowDuration >= this.maxWindowSize &&
      result.sentences.length > 1
    ) {
      const cutoffTime = windowDuration - this.sentenceBuffer;
      const newFixedSentences: string[] = [];
      let newFixedEndTime = this.fixedEndTime;

      for (const sentence of result.sentences) {
        if (sentence.end < cutoffTime) {
          newFixedSentences.push(sentence.text.trim());
          newFixedEndTime = this.fixedEndTime + sentence.end;
        } else {
          break;
        }
      }

      if (newFixedSentences.length > 0) {
        this.fixedSentences.push(...newFixedSentences);
        this.fixedEndTime = newFixedEndTime;
        const nextWindowStart = Math.floor(this.fixedEndTime * this.sampleRate);
        result = await this.model.transcribe(audio.slice(nextWindowStart));
      }
    }

    return {
      fixedText: this.fixedSentences.join(" "),
      activeText: result.text.trim(),
      timestamp: currentLength / this.sampleRate,
      isFinal: false,
    };
  }

  async finalize(audio: Float32Array): Promise<string> {
    const result = await this.transcribeIncremental(audio);
    return [result.fixedText, result.activeText].filter(Boolean).join(" ");
  }
}
