interface ToggleRowProps {
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
}

export function ToggleRow({
  title,
  description,
  enabled,
  onClick,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-600">{description}</div>
      </div>
      <button
        onClick={onClick}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
          enabled ? "bg-blue-600" : "bg-gray-200"
        } shadow-inner`}
      >
        <span
          className={`absolute left-0.5 top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
            enabled
              ? "translate-x-4 border border-blue-600"
              : "translate-x-0 border border-gray-300"
          }`}
        />
      </button>
    </div>
  );
}
