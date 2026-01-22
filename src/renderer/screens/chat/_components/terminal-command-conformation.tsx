import { useEffect, useRef } from "react";

interface CommandConfirmationDialogProps {
  isOpen: boolean;
  command: string;
  cwd: string;
  requestId: string;
  onAllow: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

export function CommandConfirmationDialog({
  isOpen,
  command,
  cwd,
  requestId,
  onAllow,
  onDeny,
}: CommandConfirmationDialogProps) {
  const allowButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isOpen && allowButtonRef.current) {
      allowButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Enter") {
        e.preventDefault();
        onAllow(requestId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDeny(requestId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, requestId, onAllow, onDeny]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-primary/40 backdrop-blur-[2px] animate-fade-in">
      <div className="w-[90%] max-w-105 overflow-hidden rounded-xl border border-border bg-surface shadow-premium animate-slide-up">
        <div className="p-5">
          <p className="mb-2.5 text-[13px] font-medium text-text-muted">
            The following command will be executed:
          </p>
          <code className="block max-h-50 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-bg-app p-3 font-mono text-[13px] leading-relaxed text-text-main">
            {command}
          </code>

          <p className="mt-3 flex flex-col gap-1 text-xs">
            <span className="text-text-subtle">Working directory:</span>
            <span className="break-all font-mono font-medium text-text-main">
              {cwd}
            </span>
          </p>
        </div>

        <div className="flex gap-2.5 p-5 pt-0">
          <button
            ref={allowButtonRef}
            className="flex flex-1 items-center justify-center rounded-md border-none bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_4px_rgba(62,39,35,0.2)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-all duration-100 ease-out hover:-translate-y-px hover:bg-primary-hover active:translate-y-0 cursor-pointer"
            onClick={() => onAllow(requestId)}
          >
            Allow (Enter)
          </button>
          <button
            className="flex flex-1 items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-[13px] font-semibold text-text-main transition-all duration-100 ease-out hover:border-primary hover:bg-primary/5 cursor-pointer"
            onClick={() => onDeny(requestId)}
          >
            Deny (Esc)
          </button>
        </div>
      </div>
    </div>  
  );
}
