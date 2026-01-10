import { useRef, useEffect } from "react";
import type { StreamChunk } from "../../../../common/types";
import { PlanRenderer, LogRenderer, SourceRenderer } from "./renderers";
import { MarkdownRenderer } from "./markdown-renderer";
import { useStreamingStore } from "../../../utils/store";

interface Segment {
  id: string;
  type: string;
  content: string;
}

// Custom hook for managing streaming state and logic
export function useStreaming() {
  const isStreaming = useStreamingStore((s) => s.isStreaming);
  const streamingSegments = useStreamingStore((s) => s.streamingSegments);
  const segmentsRef = useRef(streamingSegments);

  // Sync ref with latest segments
  useEffect(() => {
    segmentsRef.current = streamingSegments;
  }, [streamingSegments]);

  const setupStreaming = () => {
    useStreamingStore.getState().clearStreaming();
    useStreamingStore.getState().setStreaming(true);

    const handleStreamChunk = (data: StreamChunk) => {
      useStreamingStore.getState().addStreamingChunk(data);
    };

    window.electronAPI.onStreamChunk(handleStreamChunk);
    return handleStreamChunk;
  };

  const cleanupStreaming = () => {
    window.electronAPI.removeStreamChunkListener();
    useStreamingStore.getState().clearStreaming();
  };

  return {
    isStreaming,
    segments: streamingSegments,
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
            <MarkdownRenderer content={msg.content} isUser={false} />
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
