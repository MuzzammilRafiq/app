import { useState } from "react";
import clsx from "clsx";

import type { MakePlanResponse, UniqueResult } from "../../../common/types";
import {
  BadgeCheckIcon,
  ChevronDownIcon,
  CheckSolidIcon,
  ClockIcon,
  FileSVG,
  ClipboardIcon,
} from "../icons";

// Plan renderer with optional logs support
function extractPlan(
  raw: string
): { steps: MakePlanResponse[]; logs?: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { steps: parsed as MakePlanResponse[] };
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as any).steps)
    ) {
      return {
        steps: (parsed as any).steps as MakePlanResponse[],
        logs:
          typeof (parsed as any).logs === "string"
            ? (parsed as any).logs
            : undefined,
      };
    }
  } catch {}
  const match = raw.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const candidate = JSON.parse(match[0]);
      if (Array.isArray(candidate))
        return { steps: candidate as MakePlanResponse[] };
    } catch {}
  }
  return null;
}

export function PlanRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const extracted = extractPlan(content);
  if (!extracted) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50 rounded"
        >
          <div className="text-xs font-semibold text-slate-600">Plan</div>
          <ChevronDownIcon
            className={clsx(
              "w-4 h-4 text-slate-600 transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        </button>
        <div
          className={clsx(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[800px] opacity-100 mt-2" : "max-h-0 opacity-0"
          )}
        >
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto">
            {content}
          </pre>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left px-2 py-1"
      >
        <div className="text-xs font-semibold text-slate-700 flex items-center">
          <ClipboardIcon className="w-3 h-3 mr-1" />
          Plan
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-3 h-3 text-slate-700 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-3 max-h-[600px] overflow-y-auto px-2 pb-2">
          {extracted.steps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm"
            >
              <div className="flex items-start space-x-3">
                <div className="border border-slate-300 bg-slate-200 w-8 items-center justify-center flex py-0.5 rounded-full">
                  <span className="text-sm text-slate-800">
                    {step.step_number}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {step.tool_name}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border",
                        step.status === "done"
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-gray-100 text-gray-800 border-gray-200"
                      )}
                    >
                      {step.status === "done" && (
                        <CheckSolidIcon className="w-3 h-3 mr-1" />
                      )}
                      {step.status === "todo" && (
                        <ClockIcon className="w-3 h-3 mr-1" />
                      )}
                      {step.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-900 leading-relaxed wrap-break-words overflow-wrap-anywhere">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {extracted.logs && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Execution Log
              </div>
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

// Collapsible log renderer
export function LogRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left px-2 py-1"
      >
        <div className="text-xs font-semibold text-amber-600 flex items-center">
          <BadgeCheckIcon className="w-3 h-3 mr-1" />
          Log
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-3 h-3 text-amber-600 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "opacity-100 mt-2" : "max-h-0 opacity-0"
        )}
      >
        <pre className="text-xs text-amber-700 whitespace-pre-wrap font-mono wrap-break-words px-2 pb-2">
          {content}
        </pre>
      </div>
    </div>
  );
}

// Sources renderer
interface WebSource {
  url: string;
  title: string;
}

function parseSources(content: string): UniqueResult[] | null {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data.filter(
        (d: any) =>
          d &&
          typeof d.id === "string" &&
          typeof d.document === "string" &&
          d.metadata &&
          typeof d.metadata.path === "string" &&
          typeof d.metadata.index === "number"
      );
    }
    return null;
  } catch {
    return null;
  }
}

function parseWebSources(content: string): WebSource[] | null {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      const webSources = data.filter(
        (d: any) =>
          d && typeof d.url === "string" && typeof d.title === "string"
      );
      return webSources.length > 0 ? webSources : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function SourceRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Try parsing as RAG sources first
  const ragSources = parseSources(content);
  // Try parsing as web sources
  const webSources = parseWebSources(content);

  // Render RAG sources if present
  if (ragSources && ragSources.length > 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50/60">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left px-2 py-1"
        >
          <div className="text-xs font-semibold text-emerald-700 flex items-center">
            {FileSVG}
            Source ({ragSources.length})
          </div>
          <ChevronDownIcon
            className={clsx(
              "w-3 h-3 text-emerald-700 transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        </button>
        <div
          className={clsx(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[800px] opacity-100 mt-2" : "max-h-0 opacity-0"
          )}
        >
          <ul className="space-y-2 px-2 pb-2 max-h-[600px] overflow-y-auto">
            {ragSources.map((s) => (
              <li
                key={s.id}
                className="group rounded border border-emerald-200/60 bg-white p-2 text-sm shadow-sm"
              >
                <div className="font-medium text-slate-800">
                  {s.document.slice(0, 200)}
                  {s.document.length > 200 ? "…" : ""}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <span className="truncate">{s.metadata.path}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-400" />
                  <span>Index: {s.metadata.index}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Render web sources if present
  if (webSources && webSources.length > 0) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50/60">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left px-2 py-1"
        >
          <div className="text-xs font-semibold text-blue-700 flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
              />
            </svg>
            Web Sources ({webSources.length})
          </div>
          <ChevronDownIcon
            className={clsx(
              "w-3 h-3 text-blue-700 transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        </button>
        <div
          className={clsx(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[800px] opacity-100 mt-2" : "max-h-0 opacity-0"
          )}
        >
          <ul className="space-y-2 px-2 pb-2 max-h-[600px] overflow-y-auto">
            {webSources.map((s, index) => (
              <li
                key={`${s.url}-${index}`}
                className="group rounded border border-blue-200/60 bg-white p-2 text-sm shadow-sm hover:border-blue-300 transition-colors"
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                    {s.title || "Untitled"}
                    <svg
                      className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>
                  <div className="mt-1 text-xs text-blue-600/80 truncate">
                    {s.url}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return null;
}
