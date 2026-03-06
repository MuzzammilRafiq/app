import type { WorkerMessage, WorkerResponse } from "./markdown.worker";
import MarkdownWorker from "./markdown.worker?worker";
import { createRendererLogger } from "../utils/logger";

const LOG = createRendererLogger("markdown-worker");

class MarkdownWorkerManager {
  private worker: Worker;
  private listeners: Map<
    string,
    (result: { html: string; error?: string }) => void
  > = new Map();
  private pending: Map<
    string,
    { resolve: (html: string) => void; reject: (err: any) => void }
  > = new Map();

  constructor() {
    LOG.INFO("Initializing worker");
    try {
      this.worker = new MarkdownWorker();
      LOG.INFO("Worker created successfully");

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, html, error } = e.data;
        LOG.DEBUG("Received worker response", {
          id,
          htmlLength: html?.length,
          error,
        });

        // Handle one-off promises (if used directly)
        const promise = this.pending.get(id);
        if (promise) {
          if (error) {
            LOG.ERROR("Markdown worker returned an error", { id, error });
            promise.reject(error);
          } else {
            promise.resolve(html);
          }
          this.pending.delete(id);
        }

        // Handle subscription listeners (for React components)
        const listener = this.listeners.get(id);
        if (listener) {
          listener({ html, error });
        }
      };

      this.worker.onerror = (e: ErrorEvent) => {
        LOG.ERROR("Markdown worker crashed", { message: e.message }, e.error);
      };
    } catch (e) {
      LOG.ERROR("Failed to create markdown worker", e);
      throw e;
    }
  }

  public process(
    id: string,
    content: string,
    isUser: boolean
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, content, isUser } as WorkerMessage);
    });
  }

  // Fire and forget (useful for streaming updates where we just want the listener to fire eventually)
  public post(id: string, content: string, isUser: boolean) {
    this.worker.postMessage({ id, content, isUser } as WorkerMessage);
  }

  public subscribe(
    id: string,
    callback: (result: { html: string; error?: string }) => void
  ) {
    this.listeners.set(id, callback);
    return () => {
      this.listeners.delete(id);
    };
  }
}

export const markdownWorker = new MarkdownWorkerManager();
