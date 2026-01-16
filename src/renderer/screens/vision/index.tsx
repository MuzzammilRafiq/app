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
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-4xl text-center space-y-8">
            <div className="space-y-4">
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light/40 text-primary text-xs font-semibold uppercase tracking-wider border border-primary/20">
                  <Zap size={14} className="text-primary" strokeWidth={2} />
                  Vision Mode
                </span>
              </div>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-light/40 border border-primary/20 flex items-center justify-center shadow-sm">
                  <Eye size={30} className="text-primary" strokeWidth={1.5} />
                </div>
              </div>
              <h1 className="text-4xl font-semibold text-primary">
                Vision Agent
              </h1>
              <p className="text-base md:text-lg text-text-muted max-w-2xl mx-auto">
                Automate tasks on your screen with AI-powered vision
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="group flex gap-3 p-5 rounded-2xl shadow-premium bg-surface/70 border border-border-strong transition-all hover:-translate-y-0.5 hover:shadow-float">
                <div className="w-10 h-10 rounded-xl bg-primary-light/40 border border-primary/20 flex items-center justify-center shrink-0">
                  <MousePointer2
                    size={22}
                    className="text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-text-main">
                    Click Elements
                  </h3>
                  <p className="text-sm text-text-muted">
                    Automatically click buttons, links, and UI elements
                  </p>
                </div>
              </div>

              <div className="group flex gap-3 p-5 rounded-2xl shadow-premium bg-surface/70 border border-border-strong transition-all hover:-translate-y-0.5 hover:shadow-float">
                <div className="w-10 h-10 rounded-xl bg-primary-light/40 border border-primary/20 flex items-center justify-center shrink-0">
                  <Keyboard
                    size={22}
                    className="text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-text-main">
                    Type Text
                  </h3>
                  <p className="text-sm text-text-muted">
                    Fill forms and input fields automatically
                  </p>
                </div>
              </div>

              <div className="group flex gap-3 p-5 rounded-2xl shadow-premium bg-surface/70 border border-border-strong transition-all hover:-translate-y-0.5 hover:shadow-float">
                <div className="w-10 h-10 rounded-xl bg-primary-light/40 border border-primary/20 flex items-center justify-center shrink-0">
                  <Eye size={22} className="text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-text-main">
                    Visual Detection
                  </h3>
                  <p className="text-sm text-text-muted">
                    Find and interact with UI elements by vision
                  </p>
                </div>
              </div>

              <div className="group flex gap-3 p-5 rounded-2xl shadow-premium bg-surface/70 border border-border-strong transition-all hover:-translate-y-0.5 hover:shadow-float">
                <div className="w-10 h-10 rounded-xl bg-primary-light/40 border border-primary/20 flex items-center justify-center shrink-0">
                  <Zap size={22} className="text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-text-main">
                    Multi-Step Tasks
                  </h3>
                  <p className="text-sm text-text-muted">
                    Complete complex workflows automatically
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-text-subtle">
              Tip: Mention app names, buttons, or URLs for best results.
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      <VisionInput />
    </div>
  );
}
