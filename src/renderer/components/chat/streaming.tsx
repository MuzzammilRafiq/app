import { useRef, useState } from "react";
import type { StreamChunk } from "../../../common/types";
import { PlanRenderer, LogRenderer, MarkdownRenderer } from "./renderers";

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

  const setupStreaming = () => {
    setIsStreaming(true);
    segmentsRef.current = [];
    setSegments([]);

    const handleStreamChunk = (data: StreamChunk) => {
      setSegments((prev) => {
        const updated = [...prev];
        if (data.type === "plan") {
          // Plan is single; overwrite if exists else insert at end
          const existingIndex = updated.findIndex((s) => s.type === "plan");
          if (existingIndex >= 0) {
            const existing = updated[existingIndex];
            if (existing) {
              updated[existingIndex] = { id: existing.id, type: existing.type, content: data.chunk };
            }
          } else {
            updated.push({ id: crypto.randomUUID(), type: "plan", content: data.chunk });
          }
        } else {
          const last = updated[updated.length - 1];
          if (last && last.type === data.type) {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + data.chunk,
            };
          } else {
            updated.push({ id: crypto.randomUUID(), type: data.type, content: data.chunk });
          }
        }
        segmentsRef.current = updated;
        return updated;
      });
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

  const planSegment = segments.find((seg) => seg.type === "plan");
  const logSegment = segments.find((seg) => seg.type === "log");
  const streamSegments = segments.filter((seg) => seg.type === "stream");

  return (
    <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/40 animate-pulse space-y-4">
      <div className="max-h-60 overflow-y-auto">
        {planSegment && <PlanRenderer content={planSegment.content} />}
        {logSegment && (
          <div className="mt-4">
            <LogRenderer content={logSegment.content} />
          </div>
        )}
      </div>
      {streamSegments.map((seg) => (
        <div key={seg.id} className="prose prose-sm max-w-none">
          <MarkdownRenderer content={seg.content} isUser={false} />
        </div>
      ))}
    </div>
  );
}
