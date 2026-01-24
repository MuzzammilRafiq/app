import type { ChatMessageRecord } from "../../../../common/types";
import { PlanRenderer, LogRenderer, SourceRenderer } from "./renderers";
import clsx from "clsx";
import { memo, useState, useCallback, useRef, useEffect } from "react";

interface MessageDetailsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  plans: ChatMessageRecord[];
  logs: ChatMessageRecord[];
  sources: ChatMessageRecord[];
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;

function MessageDetailsSidebar({
  isOpen,
  onClose,
  plans,
  logs,
  sources,
}: MessageDetailsSidebarProps) {
  const hasAny =
    (plans?.length ?? 0) + (logs?.length ?? 0) + (sources?.length ?? 0) > 0;

  const [width, setWidth] = useState(MIN_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;

      // Calculate new width based on mouse position relative to window right edge
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;

      // Clamp width between min and max
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Prevent text selection while resizing
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isOpen) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [isOpen, plans, logs, sources]);

  return (
    <aside
      ref={sidebarRef}
      className={clsx(
        "h-full bg-bg-surface border-l border-border shrink-0 overflow-hidden relative",
        !isResizing && "transition-all duration-300 ease-in-out",
      )}
      style={{ width: isOpen ? width : 0 }}
      aria-hidden={!isOpen}
    >
      {/* Resize handle */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          className={clsx(
            "absolute left-0 top-0 h-full w-1.5 cursor-ew-resize z-10",
            "hover:bg-primary/30 transition-colors duration-150",
            isResizing && "bg-primary/40",
          )}
          title="Drag to resize"
        />
      )}
      <div
        className={clsx(
          "h-full flex flex-col",
          "transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        style={{ minWidth: MIN_WIDTH }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-main">Details</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-text-main hover:text-text-main hover:bg-border transition-colors"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar"
        >
          {!hasAny && (
            <div className="text-xs text-text-muted">No content available.</div>
          )}

          {plans && plans.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-text-main mb-1">
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

          {sources && sources.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-text-main mb-1">
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

          {logs && logs.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-text-main mb-1">
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
