import VisionInput from "./VisionInput";
import VisionLogPanel from "./VisionLogPanel";

export default function VisionContainer() {
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-bg-chat">
      {/* Log Panel */}
      <VisionLogPanel />

      {/* Input */}
      <VisionInput />
    </div>
  );
}
