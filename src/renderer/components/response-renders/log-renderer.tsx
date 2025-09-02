import clsx from "clsx";
import { useState } from "react";
import { BadgeCheckIcon, ChevronDownIcon } from "../../components/icons";
export default function LogRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left p-2"
      >
        <div className="text-xs font-semibold text-amber-600 flex items-center">
          <BadgeCheckIcon className="w-3 h-3 mr-2" />
          LOG
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-4 h-4 text-amber-600 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
        )}
      >
        <pre className="text-sm text-amber-700 whitespace-pre-wrap font-mono break-words overflow-hidden">
          {content}
        </pre>
      </div>
    </div>
  );
}
