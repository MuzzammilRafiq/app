const TARGET_SAMPLE_RATE = 16000;

export class AudioRecorder {
  private readonly onDataAvailable: (audioChunk: Float32Array) => void;
  private readonly onLevelChange?: (level: number) => void;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording = false;
  private readonly chunks: Float32Array[] = [];

  constructor(
    onDataAvailable: (audioChunk: Float32Array) => void,
    onLevelChange?: (level: number) => void,
  ) {
    this.onDataAvailable = onDataAvailable;
    this.onLevelChange = onLevelChange;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.audioContext = new AudioContext();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    const sourceSampleRate = this.audioContext.sampleRate;
    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);
      const resampled = this.resample(
        inputData,
        sourceSampleRate,
        TARGET_SAMPLE_RATE,
      );
      this.onLevelChange?.(this.calculateLevel(inputData));
      this.chunks.push(resampled);
      this.onDataAvailable(resampled);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  async stop(): Promise<Float32Array> {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    const completeAudio = this.concatenateChunks(this.chunks);
    await this.cleanup();
    return completeAudio;
  }

  private async cleanup(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.chunks.length = 0;
  }

  private resample(
    audioData: Float32Array,
    sourceRate: number,
    targetRate: number,
  ): Float32Array {
    if (sourceRate === targetRate) {
      return new Float32Array(audioData);
    }

    const ratio = sourceRate / targetRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const floorIndex = Math.floor(sourceIndex);
      const ceilIndex = Math.min(floorIndex + 1, audioData.length - 1);
      const blend = sourceIndex - floorIndex;
      const floorValue = audioData[floorIndex] ?? 0;
      const ceilValue = audioData[ceilIndex] ?? 0;
      result[i] =
        floorValue * (1 - blend) + ceilValue * blend;
    }

    return result;
  }

  private concatenateChunks(chunks: Float32Array[]): Float32Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }

    return output;
  }

  private calculateLevel(audioData: Float32Array): number {
    if (audioData.length === 0) {
      return 0;
    }

    let energy = 0;
    let peak = 0;
    for (let index = 0; index < audioData.length; index++) {
      const sample = audioData[index] ?? 0;
      const magnitude = Math.abs(sample);
      energy += sample * sample;
      if (magnitude > peak) {
        peak = magnitude;
      }
    }

    const rms = Math.sqrt(energy / audioData.length);
    return Math.min(1, rms * 7.5 + peak * 0.35);
  }
}

export class AudioBufferStore {
  private buffer = new Float32Array(0);

  appendChunk(chunk: Float32Array): void {
    const merged = new Float32Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
  }

  getBuffer(): Float32Array {
    return this.buffer;
  }

  reset(): void {
    this.buffer = new Float32Array(0);
  }
}

export const SAMPLE_RATE = TARGET_SAMPLE_RATE;
