import { useEffect } from "react";
import EmptyPanel from "./_components/empty-panel";
import MeetingPanel from "./_components/meeting-panel";
import { useMeetTranscription } from "./_hooks/useMeetTranscription";

export default function MeetScreen() {
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
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-bg-app w-full max-w-6xl mx-auto">
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
          onLoadModel={loadModel}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onReset={resetSession}
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
