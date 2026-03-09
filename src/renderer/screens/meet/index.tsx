import { useEffect } from "react";
import EmptyPanel from "./_components/empty-panel";
import MeetingPanel from "./_components/meeting-panel";
import { useMeetTranscription } from "./_hooks/useMeetTranscription";
import { useMeetChatStore, useMeetHistoryStore } from "../../utils/store";

export default function MeetScreen() {
  const currentTranscriptionRun = useMeetHistoryStore(
    (s) => s.currentTranscriptionRun,
  );
  const {
    modelStatus,
    modelMessage,
    isRecording,
    fixedText,
    activeText,
    timestampSeconds,
    audioLevel,
    error,
    loadModel,
    startRecording,
    stopRecording,
    resetSession,
  } = useMeetTranscription();
  const selectedRunId = currentTranscriptionRun?.id ?? null;
  const meetChatSession = useMeetChatStore((s) =>
    selectedRunId ? s.sessionsByRunId[selectedRunId] ?? null : null,
  );
  const meetChatLoading = useMeetChatStore((s) =>
    selectedRunId ? Boolean(s.loadingByRunId[selectedRunId]) : false,
  );
  const meetChatError = useMeetChatStore((s) =>
    selectedRunId ? s.errorByRunId[selectedRunId] ?? null : null,
  );

  useEffect(() => {
    (window as { __meetNewSession?: () => void }).__meetNewSession = () => {
      void resetSession();
    };

    return () => {
      (window as { __meetNewSession?: () => void }).__meetNewSession = undefined;
    };
  }, [resetSession]);

  const hasTranscript =
    fixedText.trim().length > 0 || activeText.trim().length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-app w-full">
      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {isRecording || hasTranscript ? (
        <MeetingPanel
          modelStatus={modelStatus}
          modelMessage={modelMessage}
          fixedText={fixedText}
          activeText={activeText}
          isRecording={isRecording}
          timestampSeconds={timestampSeconds}
          audioLevel={audioLevel}
          meetChatSession={meetChatSession}
          meetChatLoading={meetChatLoading}
          meetChatError={meetChatError}
          onLoadModel={loadModel}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
      ) : (
        <EmptyPanel
          modelStatus={modelStatus}
          modelMessage={modelMessage}
          audioLevel={audioLevel}
          onLoadModel={loadModel}
          onStartRecording={startRecording}
        />
      )}
    </div>
  );
}
