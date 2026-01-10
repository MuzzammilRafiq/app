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
      <div className="w-[90%] max-w-[420px] overflow-hidden rounded-xl border border-primary/8 bg-surface shadow-[0_20px_40px_-8px_rgba(62,39,35,0.2)] animate-slide-up">
        <div className="p-5">
          <p className="mb-2.5 text-[13px] font-medium text-[#6b5a47]">
            The following command will be executed:
          </p>
          <code className="block max-h-[200px] overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-primary/10 bg-[#f5f0e8] p-3 font-mono text-[13px] leading-relaxed text-primary">
            {command}
          </code>

          <p className="mt-3 flex flex-col gap-1 text-xs">
            <span className="text-[#8d7b68]">Working directory:</span>
            <span className="break-all font-mono font-medium text-primary-hover">
              {cwd}
            </span>
          </p>
        </div>

        <div className="flex gap-2.5 p-5 pt-0">
          <button
            ref={allowButtonRef}
            className="flex flex-1 items-center justify-center rounded-md border-none bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_4px_rgba(62,39,35,0.2)] transition-all duration-100 placeholder:ease-out hover:-translate-y-px hover:bg-primary-hover active:translate-y-0 cursor-pointer"
            onClick={() => onAllow(requestId)}
          >
            Allow (Enter)
          </button>
          <button
            className="flex flex-1 items-center justify-center rounded-md border border-primary/20 bg-transparent px-4 py-2 text-[13px] font-semibold text-primary transition-all duration-100 ease-out hover:border-primary hover:bg-primary/4 cursor-pointer"
            onClick={() => onDeny(requestId)}
          >
            Deny (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
