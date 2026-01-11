import { TrashSVG } from "../icons";

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
          : "bg-surface/50 border-border hover:bg-surface hover:border-border-strong hover:shadow-sm"
      }`}
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "bg-primary-light/50 text-text-muted group-hover:bg-primary-light group-hover:text-text-main"
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
              : "text-text-main group-hover:text-primary"
          }`}
        >
          {title}
        </div>
        <div
          className={`text-[11px] mt-0.5 ${isSelected ? "text-primary/70" : "text-text-muted"}`}
        >
          {subtitle}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-text-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200 cursor-pointer shrink-0"
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
      <div className="w-12 h-12 rounded-2xl bg-primary-light/50 flex items-center justify-center mb-3">
        <span className="text-text-muted">{icon}</span>
      </div>
      <p className="text-text-muted text-sm font-medium">{title}</p>
      <p className="text-text-subtle text-xs mt-1">{subtitle}</p>
    </div>
  );
}
