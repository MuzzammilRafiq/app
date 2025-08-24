import { useState } from "react";
import type { MakePlanResponse } from "../../../common/types";
import clsx from "clsx";
export default function PlanRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);   
  let plan: MakePlanResponse[];

  try {
    // Parse the JSON string content
    plan = JSON.parse(content);
  } catch (error) {
    // If parsing fails, fall back to displaying as raw text
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
        >
          <div className="text-xs font-semibold text-blue-600">Plan</div>
          <svg
            className={clsx(
              "w-4 h-4 text-blue-600 transition-transform duration-200",
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
          <pre className="text-sm text-blue-700 whitespace-pre-wrap font-mono">{content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded mb-3"
      >
        <div className="text-sm font-semibold text-blue-700 flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          Execution Plan
        </div>
        <svg
          className={clsx(
            "w-4 h-4 text-blue-700 transition-transform duration-200",
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
          isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-3">
          {plan.map((step: MakePlanResponse, index: number) => (
            <div key={index} className="bg-white rounded-lg border border-blue-200 p-3 shadow-sm">
              <div className="flex items-start space-x-3">
                {/* Step number */}
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 border-2 border-blue-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-700">{step.step_number}</span>
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
                      {step.status === "done" && (
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {step.status === "todo" && (
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                      {step.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-700 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
