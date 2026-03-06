import { memo, useEffect } from "react";
import type { TranscriptionRunRecord } from "../../../../common/types";
import { VideoCameraSVG } from "../../../components/icons";
import {
  EmptyState,
  SessionItem,
  formatRelativeTime,
} from "../../../components/sidebar/shared";
import { useMeetHistoryStore } from "../../../utils/store";

function formatDuration(durationSeconds: number): string {
  const mins = Math.floor(durationSeconds / 60);
  const secs = Math.floor(durationSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getPreviewText(run: TranscriptionRunRecord): string {
  const preview = run.transcriptText.replace(/\s+/g, " ").trim();
  if (!preview) {
    return "New transcription";
  }
  return preview.length > 48 ? `${preview.slice(0, 48)}...` : preview;
}

function MeetSidebarInner() {
  const transcriptionRuns = useMeetHistoryStore((s) => s.transcriptionRuns);
  const currentTranscriptionRun = useMeetHistoryStore(
    (s) => s.currentTranscriptionRun,
  );
  const setTranscriptionRuns = useMeetHistoryStore((s) => s.setTranscriptionRuns);
  const setCurrentTranscriptionRun = useMeetHistoryStore(
    (s) => s.setCurrentTranscriptionRun,
  );

  useEffect(() => {
    (async () => {
      const runs = await window.electronAPI.dbGetTranscriptionRuns(50);
      setTranscriptionRuns(runs);
    })();
  }, [setTranscriptionRuns]);

  const onDeleteRun = async (id: string) => {
    try {
      await window.electronAPI.dbDeleteTranscriptionRun(id);
      const runs = transcriptionRuns.filter((run) => run.id !== id);
      setTranscriptionRuns(runs);

      if (currentTranscriptionRun?.id === id) {
        if ((window as { __meetNewSession?: () => void }).__meetNewSession) {
          void (window as { __meetNewSession?: () => void }).__meetNewSession?.();
        } else {
          setCurrentTranscriptionRun(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete transcription run", err);
    }
  };

  if (transcriptionRuns.length === 0) {
    return (
      <EmptyState
        icon={VideoCameraSVG}
        title="No transcription runs yet"
        subtitle="Record a meeting to build history"
      />
    );
  }

  return (
    <>
      {transcriptionRuns.map((run) => (
        <SessionItem
          key={run.id}
          isSelected={currentTranscriptionRun?.id === run.id}
          title={getPreviewText(run)}
          subtitle={`${formatDuration(run.durationSeconds)} • ${formatRelativeTime(run.createdAt)}`}
          onClick={() => setCurrentTranscriptionRun(run)}
          onDelete={(e) => {
            e.stopPropagation();
            void onDeleteRun(run.id);
          }}
          icon={VideoCameraSVG}
        />
      ))}
    </>
  );
}

export const MeetSidebar = memo(MeetSidebarInner);
export default MeetSidebar;
