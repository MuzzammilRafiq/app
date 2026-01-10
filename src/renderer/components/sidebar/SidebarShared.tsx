import { TrashSVG } from "../icons";

// Premium button styling
export const iconBtnClass =
  "p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer border border-transparent hover:border-primary/10 disabled:opacity-50 disabled:cursor-not-allowed";

// Helper function to format relative time
export function formatRelativeTime(dateString: string | number): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Chat icon component
export const ChatIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

// Session list item component for consistency
export interface SessionItemProps {
  isSelected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
}

export function SessionItem({
  isSelected,
  title,
  subtitle,
  onClick,
  onDelete,
  icon,
}: SessionItemProps) {
  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? "bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm"
          : "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm"
      }`}
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
        }`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate font-medium ${
            isSelected
              ? "text-primary"
              : "text-slate-700 group-hover:text-slate-900"
          }`}
        >
          {title}
        </div>
        <div
          className={`text-[11px] mt-0.5 ${isSelected ? "text-primary/70" : "text-slate-400"}`}
        >
          {subtitle}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer shrink-0"
        title="Delete"
      >
        <div className="w-4 h-4">{TrashSVG}</div>
      </button>
    </div>
  );
}

// Empty state component
export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
    </div>
  );
}
