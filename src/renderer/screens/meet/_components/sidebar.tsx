import { VideoCameraSVG } from "../../../components/icons";

export default function MeetSidebar() {
  return (
    <div className="h-full px-3 py-2">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-primary">
          {VideoCameraSVG}
          <p className="text-sm font-semibold text-text-main">Live Meet Mode</p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          Meet is now transcription-only. Click <strong>New Meeting</strong>,
          load the model, and start recording.
        </p>
      </div>
    </div>
  );
}
