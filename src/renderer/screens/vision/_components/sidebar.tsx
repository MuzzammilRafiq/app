import { useEffect, useState, memo } from "react";
import type { VisionSessionWithLogs } from "../../../../common/types";
import { useVisionLogStore } from "../../../utils/store";
import { CrosshairSVG } from "../../../components/icons";
import {
  SessionItem,
  EmptyState,
  formatRelativeTime,
} from "../../../components/sidebar/shared";

function VisionSidebarInner() {
  const [visionSessions, setVisionSessions] = useState<VisionSessionWithLogs[]>(
    []
  );
  const [currentVisionSession, setCurrentVisionSession] =
    useState<VisionSessionWithLogs | null>(null);
  const setLogs = useVisionLogStore((s) => s.setLogs);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);

  const onDeleteVisionSession = async (id: string) => {
    try {
      await window.electronAPI.dbDeleteVisionSession(id);
      const sessions = await window.electronAPI.dbGetVisionSessionsWithLogs(50);
      setVisionSessions(sessions);
      if (currentVisionSession?.id === id) {
        setCurrentVisionSession(null);
        clearLogs();
      }
    } catch (err) {
      console.error("Failed to delete vision session", err);
    }
  };

  const onSelectVisionSession = (session: VisionSessionWithLogs) => {
    setCurrentVisionSession(session);
    // Load logs into the vision log store - use setLogs to preserve original IDs and timestamps
    const logEntries = session.logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.type,
      title: log.title,
      content: log.content,
      imagePath: log.imagePath,
    }));
    setLogs(logEntries);
  };

  // Load vision sessions on mount
  useEffect(() => {
    (async () => {
      const sessions = await window.electronAPI.dbGetVisionSessionsWithLogs(50);
      setVisionSessions(sessions);
    })();
  }, []);

  // Expose methods for parent component
  const onNewVisionSession = () => {
    clearLogs();
    setCurrentVisionSession(null);
  };

  // Store the new session handler on window for parent access (temporary pattern)
  useEffect(() => {
    (window as any).__visionSidebarNewSession = onNewVisionSession;
    return () => {
      delete (window as any).__visionSidebarNewSession;
    };
  }, [clearLogs]);

  if (visionSessions.length === 0) {
    return (
      <EmptyState
        icon={CrosshairSVG}
        title="No vision tasks yet"
        subtitle="Create one to get started"
      />
    );
  }

  return (
    <>
      {visionSessions.map((session) => (
        <SessionItem
          key={session.id}
          isSelected={currentVisionSession?.id === session.id}
          title={
            session.goal.length > 40
              ? session.goal.slice(0, 40) + "..."
              : session.goal
          }
          subtitle={`${session.logs.length} steps • ${formatRelativeTime(session.createdAt)}`}
          onClick={() => onSelectVisionSession(session)}
          onDelete={(e) => {
            e.stopPropagation();
            void onDeleteVisionSession(session.id);
          }}
          icon={CrosshairSVG}
        />
      ))}
    </>
  );
}

export const VisionSidebar = memo(VisionSidebarInner);
export default VisionSidebar;
