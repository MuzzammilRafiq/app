import type { ChatMessageRecord } from "../../../common/types";
import { PlanRenderer, LogRenderer, SourceRenderer } from "./renderers";
import clsx from "clsx";
import { memo } from "react";

interface MessageDetailsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  plans: ChatMessageRecord[];
  logs: ChatMessageRecord[];
  sources: ChatMessageRecord[];
}

function MessageDetailsSidebar({
  isOpen,
  onClose,
  plans,
  logs,
  sources,
}: MessageDetailsSidebarProps) {
  const hasAny =
    (plans?.length ?? 0) + (logs?.length ?? 0) + (sources?.length ?? 0) > 0;

  return (
    <aside
      className={clsx(
        "h-full bg-bg-app border-l border-slate-200 shrink-0 overflow-hidden",
        "transition-all duration-300 ease-in-out",
        isOpen ? "w-[320px] sm:w-[360px]" : "w-0",
      )}
      aria-hidden={!isOpen}
    >
      <div
        className={clsx(
          "h-full flex flex-col min-w-[320px] sm:min-w-[360px]",
          "transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0",
        )}
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
        <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
          {!hasAny && (
            <div className="text-xs text-slate-600">No content available.</div>
          )}

          {plans && plans.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-slate-700 mb-1">
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
              <div className="space-y-2 text-xs">
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
      </div>
    </aside>
  );
}

export default memo(MessageDetailsSidebar, (prevProps, nextProps) => {
  if (prevProps.isOpen !== nextProps.isOpen) return false;
  if (prevProps.plans?.length !== nextProps.plans?.length) return false;
  if (prevProps.logs?.length !== nextProps.logs?.length) return false;
  if (prevProps.sources?.length !== nextProps.sources?.length) return false;
  return (
    JSON.stringify(prevProps.plans) === JSON.stringify(nextProps.plans) &&
    JSON.stringify(prevProps.logs) === JSON.stringify(nextProps.logs) &&
    JSON.stringify(prevProps.sources) === JSON.stringify(nextProps.sources)
  );
});
