import { useState } from "react";
import type { MakePlanResponse } from "../../../common/types";
import clsx from "clsx";
import { ChevronDownIcon, ClipboardIcon, CheckSolidIcon, ClockIcon } from "../../components/icons";

// Attempt to safely extract and parse a JSON array from possibly noisy content
interface ExtractedPlan {
  steps: MakePlanResponse[];
  logs?: string;
}

function extractPlan(raw: string): ExtractedPlan | null {
  // Direct parse possibilities
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { steps: parsed as MakePlanResponse[] };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).steps)) {
      return {
        steps: (parsed as any).steps as MakePlanResponse[],
        logs: typeof (parsed as any).logs === "string" ? (parsed as any).logs : undefined,
      };
    }
  } catch (_) {
    // ignore and try fallback
  }
  // Fallback: first JSON array for steps
  const match = raw.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const candidate = JSON.parse(match[0]);
      if (Array.isArray(candidate)) return { steps: candidate as MakePlanResponse[] };
    } catch (_) {
      // ignore
    }
  }
  return null;
}
export default function PlanRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const extracted = extractPlan(content);
  if (!extracted) {
    // Raw fallback (non-JSON or unrecoverable)
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
        >
          <div className="text-xs font-semibold text-blue-600">Plan (raw)</div>
          <ChevronDownIcon
            className={clsx(
              "w-4 h-4 text-blue-600 transition-transform duration-200",
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
          <pre className="text-sm text-blue-700 whitespace-pre-wrap font-mono">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left p-2"
      >
        <div className="text-sm font-semibold text-blue-700 flex items-center">
          <ClipboardIcon className="w-4 h-4 mr-2" />
          Plan
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-4 h-4 text-blue-700 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-3">
          {extracted.steps.map((step: MakePlanResponse, index: number) => (
            <div key={index} className="bg-white rounded-lg border border-blue-200 p-3 shadow-sm">
              <div className="flex items-start space-x-3">
                {/* Step number */}
                <div className=" border border-blue-200 bg-blue-200  w-8 items-center justify-center flex py-0.5 rounded-full">
                  <span className="text-sm  text-blue-800">{step.step_number}</span>
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    {/* Tool name badge */}
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {step.tool_name}
                    </span>

                    {/* Status indicator */}
                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border",
                        step.status === "done"
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-gray-100 text-gray-800 border-gray-200"
                      )}
                    >
                      {step.status === "done" && <CheckSolidIcon className="w-3 h-3 mr-1" />}
                      {step.status === "todo" && <ClockIcon className="w-3 h-3 mr-1" />}
                      {step.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-blue-900 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
          {extracted.logs && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">Execution Log</div>
              <pre className="text-xs whitespace-pre-wrap text-slate-700 max-h-64 overflow-y-auto">
                {extracted.logs}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
