import VisionInput from "./_components/input";
import VisionLogPanel from "./_components/log-panel";
import { useVisionLogStore } from "../../utils/store";
import EmptyPanel from "./_components/empty-panel";

export default function VisionScreen() {
  const logs = useVisionLogStore((s) => s.logs);
  const hasLogs = logs.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-bg-app w-full max-w-4xl mx-auto">
      {hasLogs ? <VisionLogPanel /> : <EmptyPanel />}
      <VisionInput />
    </div>
  );
}
