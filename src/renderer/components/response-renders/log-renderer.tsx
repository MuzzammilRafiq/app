import clsx from "clsx";
import { useState } from "react";
export default function LogRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 rounded"
      >
        <div className="text-xs font-semibold text-amber-600 flex items-center">
          <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          LOG
        </div>
        <svg
          className={clsx(
            "w-4 h-4 text-amber-600 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
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
