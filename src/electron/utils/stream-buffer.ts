import type { WebContents } from "electron";

/**
 * Buffers stream-type chunks for a specified duration before sending them
 * to reduce the frequency of IPC events and improve frontend rendering performance.
 *
 * Non-stream types (log, plan, source) are sent immediately without buffering.
 */
export class StreamChunkBuffer {
  private buffer: string = "";
  private timer: NodeJS.Timeout | null = null;
  private readonly BUFFER_MS: number;

  constructor(
    private sender: WebContents,
    private eventName: string = "stream-chunk",
    bufferMs: number = 400
  ) {
    this.BUFFER_MS = bufferMs;
  }

  /**
   * Send a chunk. Stream-type chunks are buffered; others are sent immediately.
   */
  send(chunk: string, type: string): void {
    if (type !== "stream") {
      // Non-stream types bypass buffer for immediate delivery
      this.sender.send(this.eventName, { chunk, type });
      return;
    }

    this.buffer += chunk;

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.BUFFER_MS);
    }
  }

  /**
   * Flush any buffered content immediately.
   * Call this when the stream completes or is aborted.
   */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer) {
      this.sender.send(this.eventName, { chunk: this.buffer, type: "stream" });
      this.buffer = "";
    }
  }

  /**
   * Alias for flush - ensures all buffered content is sent before cleanup.
   */
  destroy(): void {
    this.flush();
  }
}
