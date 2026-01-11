import { MousePointer2, Keyboard, Eye, Zap } from "lucide-react";
import VisionInput from "./_components/input";
import VisionLogPanel from "./_components/log-panel";
import { useVisionLogStore } from "../../utils/store";

export default function VisionScreen() {
  const logs = useVisionLogStore((s) => s.logs);
  const hasLogs = logs.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-bg-app">
      {hasLogs ? (
        <>
          {/* Log Panel */}
          <VisionLogPanel />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl text-center space-y-6">
            <div className="space-y-3">
              <div className="flex justify-center">
                <Zap size={64} className="text-primary" strokeWidth={1.5} />
              </div>
              <h1 className="text-4xl font-semibold text-primary">
                Vision Agent
              </h1>
              <p className="text-lg text-text-muted">
                Automate tasks on your screen with AI-powered vision
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
              <div className="p-4 rounded-lg shadow-premium bg-surface border border-border">
                <div className="mb-2">
                  <MousePointer2
                    size={28}
                    className="text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="font-medium mb-1 text-primary">
                  Click Elements
                </h3>
                <p className="text-sm text-text-muted">
                  Automatically click buttons, links, and UI elements
                </p>
              </div>

              <div className="p-4 rounded-lg shadow-premium bg-surface border border-border">
                <div className="mb-2">
                  <Keyboard
                    size={28}
                    className="text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="font-medium mb-1 text-primary">Type Text</h3>
                <p className="text-sm text-text-muted">
                  Fill forms and input fields automatically
                </p>
              </div>

              <div className="p-4 rounded-lg shadow-premium bg-surface border border-border">
                <div className="mb-2">
                  <Eye size={28} className="text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1 text-primary">
                  Visual Detection
                </h3>
                <p className="text-sm text-text-muted">
                  Find and interact with UI elements by vision
                </p>
              </div>

              <div className="p-4 rounded-lg shadow-premium bg-surface border border-border">
                <div className="mb-2">
                  <Zap size={28} className="text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1 text-primary">
                  Multi-Step Tasks
                </h3>
                <p className="text-sm text-text-muted">
                  Complete complex workflows automatically
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <VisionInput />
    </div>
  );
}
