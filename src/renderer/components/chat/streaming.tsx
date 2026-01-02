import { useRef, useState } from "react";
import type { StreamChunk } from "../../../common/types";
import { PlanRenderer, LogRenderer, SourceRenderer } from "./renderers";
import { WorkerMarkdownRenderer } from "./worker-renderers";

interface Segment {
  id: string;
  type: string;
  content: string;
}

// Custom hook for managing streaming state and logic
export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const segmentsRef = useRef<Segment[]>([]);

  // Optional callback allows callers to handle chunks directly (e.g., write into store)
  const setupStreaming = (onChunk?: (data: StreamChunk) => void) => {
    setIsStreaming(true);
    segmentsRef.current = [];
    setSegments([]);

    const handleStreamChunk = (data: StreamChunk) => {
      // Allow external side-effects first
      if (onChunk) {
        try {
          onChunk(data);
        } catch (err) {
          // Swallow errors from external callback to avoid breaking stream updates
          // eslint-disable-next-line no-console
          console.error("onChunk handler error:", err);
        }
      }

      // Use ref for immediate state access to avoid stale closures during rapid updates
      const updated = [...segmentsRef.current];
      if (data.type === "plan") {
        // Plan is single; overwrite if exists else insert at end
        const existingIndex = updated.findIndex((s) => s.type === "plan");
        if (existingIndex >= 0) {
          const existing = updated[existingIndex];
          if (existing) {
            updated[existingIndex] = {
              id: existing.id,
              type: existing.type,
              content: data.chunk,
            };
          }
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: "plan",
            content: data.chunk,
          });
        }
      } else {
        const last = updated[updated.length - 1];
        if (last && last.type === data.type) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + data.chunk,
          };
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: data.type,
            content: data.chunk,
          });
        }
      }
      segmentsRef.current = updated;
      setSegments(updated);
    };

    window.electronAPI.onStreamChunk(handleStreamChunk);
    return handleStreamChunk;
  };

  const cleanupStreaming = () => {
    window.electronAPI.removeStreamChunkListener();
    setIsStreaming(false);
    segmentsRef.current = [];
    setSegments([]);
  };

  return {
    isStreaming,
    segments,
    segmentsRef,
    setupStreaming,
    cleanupStreaming,
  };
}

// Component for displaying live streaming preview
export function StreamingPreview({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) return null;

  // Only take the last plan segment to avoid duplicates during streaming
  let planSegment: Segment | undefined;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg && seg.type === "plan") {
      planSegment = seg;
      break;
    }
  }
  const logSegments = segments.filter((seg) => seg.type === "log");
  const streamSegments = segments.filter((seg) => seg.type === "stream");
  const sourceSegments = segments.filter((seg) => seg.type === "source");

  return (
    <div className="flex justify-start">
      <div className="overflow-wrap-anywhere overflow-hidden text-slate-800 px-4 py-2.5 space-y-4">
        {/* Plan - only render the latest one */}
        {planSegment && (
          <PlanRenderer key={planSegment.id} content={planSegment.content} />
        )}

        {/* Logs */}
        {logSegments.map((msg) => (
          <div key={msg.id}>
            <LogRenderer content={msg.content} />
          </div>
        ))}

        {/* Stream messages */}
        {streamSegments.map((msg) => (
          <div key={msg.id} className="prose prose-sm max-w-none">
            <WorkerMarkdownRenderer
              id={msg.id}
              content={msg.content}
              isUser={false}
              isStreaming={true}
            />
          </div>
        ))}

        {/* Sources */}
        {sourceSegments.map((msg) => (
          <div key={msg.id}>
            <SourceRenderer content={msg.content} />
          </div>
        ))}
      </div>
    </div>
  );
}
