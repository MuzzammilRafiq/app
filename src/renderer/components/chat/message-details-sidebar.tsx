import type { ChatMessageRecord } from "../../../common/types";
import { PlanRenderer, LogRenderer, SourceRenderer } from "./renderers";
import clsx from "clsx";

interface MessageDetailsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  plans: ChatMessageRecord[];
  logs: ChatMessageRecord[];
  sources: ChatMessageRecord[];
}

export default function MessageDetailsSidebar({
  isOpen,
  onClose,
  plans,
  logs,
  sources,
}: MessageDetailsSidebarProps) {
  const hasAny =
    (plans?.length ?? 0) + (logs?.length ?? 0) + (sources?.length ?? 0) > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 bg-black/20 transition-opacity z-40",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={clsx(
          "fixed right-0 top-0 h-full w-[380px] sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 z-50",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">Details</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto p-3 space-y-3">
          {!hasAny && (
            <div className="text-sm text-slate-600">No content available.</div>
          )}

          {plans && plans.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-blue-700 mb-1">
                Plan
              </div>
              <div className="space-y-2">
                {plans.map((m) => (
                  <div key={m.id}>
                    <PlanRenderer content={m.content} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {logs && logs.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-amber-700 mb-1">
                Log
              </div>
              <div className="space-y-2">
                {logs.map((m) => (
                  <div key={m.id}>
                    <LogRenderer content={m.content} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {sources && sources.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-emerald-700 mb-1">
                Sources
              </div>
              <div className="space-y-2">
                {sources.map((m) => (
                  <div key={m.id}>
                    <SourceRenderer content={m.content} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
