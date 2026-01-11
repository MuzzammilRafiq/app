import { useState, useEffect, useRef } from "react";
import { markdownWorker } from "../../../services/markdown-worker-manager";
import clsx from "clsx";

// Throttle helper
function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(
      () => {
        if (Date.now() - lastRan.current >= limit) {
          setThrottledValue(value);
          lastRan.current = Date.now();
        }
      },
      limit - (Date.now() - lastRan.current),
    );

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

export function WorkerMarkdownRenderer({
  id,
  content,
  isUser,
  isStreaming = false,
}: {
  id: string;
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
}) {
  // We use content hash or length as part of the cache key if we wanted global caching,
  // but for now, rely on local state + worker response.

  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const renderedOnce = useRef(false);

  // If streaming, throttle updates to the worker to avoid congestion
  // But always show the latest raw content immediately if HTML isn't ready

  // Throttle the INPUT to the worker
  const throttledContent = useThrottle(content, isStreaming ? 150 : 0);

  useEffect(() => {
    // Unique ID for this specific render task context
    // We append content length to ID to ensure state updates if ID is reused (unlikely for msgs but good practice)
    const uniqueId = `${id}-${isUser ? "u" : "a"}`;

    console.log(
      `[WorkerMarkdownRenderer] Subscribing with ID: ${uniqueId}, content length: ${throttledContent.length}`,
    );

    // Reset error on new content/id
    setError(null);

    const unsub = markdownWorker.subscribe(uniqueId, (result) => {
      console.log(
        `[WorkerMarkdownRenderer] Callback received for ${uniqueId}:`,
        result,
      );
      // Result is now an object { html, error }
      // We need to update manager to pass this object
      if (typeof result === "string") {
        setHtml(result);
      } else if (typeof result === "object") {
        if (result.error) {
          setError(result.error);
        } else {
          console.log(
            `[WorkerMarkdownRenderer] Setting HTML, length: ${result.html?.length}`,
          );
          setHtml(result.html);
        }
      }
      renderedOnce.current = true;
    });

    // Send task
    console.log(`[WorkerMarkdownRenderer] Posting to worker: ${uniqueId}`);
    markdownWorker.post(uniqueId, throttledContent, isUser);

    return unsub;
  }, [id, throttledContent, isUser]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-mono whitespace-pre-wrap">
        Markdown Error: {error}
        <hr className="my-2 border-red-200" />
        {content}
      </div>
    );
  }

  // Fallback: If no HTML yet, render raw content with basic whitespace handling
  // This ensures instant feedback during streaming before the first worker response comes back
  // or between throttled frames.
  if (!html) {
    return (
      <div
        className={clsx(
          "whitespace-pre-wrap overflow-wrap-anywhere font-sans text-[15px] leading-relaxed",
          isUser ? "text-white" : "text-text-main",
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "markdown-body", // We will need to ensure global styles target this or scoped styles
        isUser
          ? "text-white prose-headings:text-white prose-p:text-white prose-strong:text-white prose-li:text-white"
          : "text-text-main",
      )}
      // Safe because we sanitize in the worker
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
