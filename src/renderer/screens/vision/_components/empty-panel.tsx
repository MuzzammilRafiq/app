import { MousePointer2, Keyboard, Eye, Zap } from "lucide-react";

export default function EmptyPanel() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-4xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold text-primary">Vision Agent</h1>
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
              <Keyboard size={22} className="text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-semibold mb-1 text-text-main">Type Text</h3>
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
      </div>
    </div>
  );
}
