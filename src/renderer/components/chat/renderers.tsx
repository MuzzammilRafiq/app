import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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

// Markdown renderer for both user and assistant content
export function MarkdownRenderer({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1
            className={clsx(
              "text-xl font-bold mb-3 mt-6",
              isUser ? "text-blue-700" : "text-slate-800",
            )}
          >
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2
            className={clsx(
              "text-lg font-bold mb-2 mt-5",
              isUser ? "text-blue-700" : "text-slate-800",
            )}
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3
            className={clsx(
              "text-base font-bold mb-2 mt-4",
              isUser ? "text-blue-700" : "text-slate-800",
            )}
          >
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p
            className={clsx(
              "mb-2 leading-relaxed",
              isUser ? "text-blue-700" : "text-slate-700",
            )}
          >
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul
            className={clsx(
              "list-disc list-inside mb-3 space-y-1 pl-6",
              isUser ? "text-blue-700" : "text-slate-700",
            )}
          >
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol
            className={clsx(
              "list-decimal list-inside mb-3 space-y-1 pl-6",
              isUser ? "text-blue-700" : "text-slate-700",
            )}
          >
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className={clsx(isUser ? "text-blue-700" : "text-slate-700")}>
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong
            className={clsx(
              "font-semibold",
              isUser ? "text-blue-700" : "text-slate-800",
            )}
          >
            {children}
          </strong>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className={clsx(
                  "text-sm font-mono px-1.5 py-0.5 rounded-md",
                  isUser
                    ? "bg-gray-200 text-blue-700"
                    : "bg-slate-200 text-slate-700",
                )}
              >
                {children}
              </code>
            );
          }
          const language = className?.replace("language-", "") || "text";
          return (
            <div className="mb-3">
              <SyntaxHighlighter
                language={language}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  lineHeight: "1.5",
                  border: isUser ? "none" : "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                  overflowX: "auto",
                  wordWrap: "break-word",
                  whiteSpace: "pre-wrap",
                }}
                showLineNumbers={
                  language !== "text" && language !== "plaintext"
                }
                wrapLines
                wrapLongLines
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            </div>
          );
        },
        pre: ({ children }) => (
          <pre
            className={clsx(
              "rounded-xl overflow-x-auto mb-3 p-4 whitespace-pre-wrap break-words",
              isUser
                ? "bg-gray-200 border border-gray-300"
                : "bg-slate-50 border border-slate-200",
            )}
          >
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className={clsx(
              "border-l-4 pl-4 italic mb-3",
              isUser
                ? "border-gray-400 text-blue-700"
                : "border-slate-300 text-slate-600",
            )}
          >
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "underline underline-offset-2 font-medium transition-colors duration-200",
              isUser
                ? "text-blue-700 hover:text-blue-800"
                : "text-blue-600 hover:text-blue-700",
            )}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table
              className={clsx(
                "min-w-full border rounded-lg overflow-hidden shadow-sm",
                isUser ? "border-blue-500/30" : "border-slate-200",
              )}
            >
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th
            className={clsx(
              "border px-4 py-3 font-semibold",
              isUser
                ? "border-gray-300 bg-gray-200 text-blue-700"
                : "border-slate-200 bg-slate-100 text-slate-700",
            )}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            className={clsx(
              "border px-4 py-3",
              isUser
                ? "border-gray-300 text-blue-700"
                : "border-slate-200 text-slate-700",
            )}
          >
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Plan renderer with optional logs support
function extractPlan(
  raw: string,
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
        >
          <div className="text-xs font-semibold text-blue-600">Plan</div>
          <ChevronDownIcon
            className={clsx(
              "w-4 h-4 text-blue-600 transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
        <div
          className={clsx(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[800px] opacity-100 mt-2" : "max-h-0 opacity-0",
          )}
        >
          <pre className="text-sm text-blue-700 whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto">
            {content}
          </pre>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left px-2 py-1"
      >
        <div className="text-xs font-semibold text-blue-700 flex items-center">
          <ClipboardIcon className="w-3 h-3 mr-1" />
          Plan
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-3 h-3 text-blue-700 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="space-y-3 max-h-[600px] overflow-y-auto px-2 pb-2">
          {extracted.steps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-blue-200 p-3 shadow-sm"
            >
              <div className="flex items-start space-x-3">
                <div className=" border border-blue-200 bg-blue-200  w-8 items-center justify-center flex py-0.5 rounded-full">
                  <span className="text-sm  text-blue-800">
                    {step.step_number}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {step.tool_name}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border",
                        step.status === "done"
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-gray-100 text-gray-800 border-gray-200",
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
                  <p className="text-sm text-blue-900 leading-relaxed">
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
            isExpanded ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[800px] opacity-100 mt-2" : "max-h-0 opacity-0",
        )}
      >
        <pre className="text-sm text-amber-700 whitespace-pre-wrap font-mono break-words max-h-[600px] overflow-y-auto px-2 pb-2">
          {content}
        </pre>
      </div>
    </div>
  );
}

// Sources renderer
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
          typeof d.metadata.index === "number",
      );
    }
    return null;
  } catch {
    return null;
  }
}

export function SourceRenderer({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const sources = parseSources(content);
  if (!sources || sources.length === 0) return null;
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/60">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left px-2 py-1"
      >
        <div className="text-xs font-semibold text-emerald-700 flex items-center">
          {FileSVG}
          Source ({sources.length})
        </div>
        <ChevronDownIcon
          className={clsx(
            "w-3 h-3 text-emerald-700 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[800px] opacity-100 mt-2" : "max-h-0 opacity-0",
        )}
      >
        <ul className="space-y-2 px-2 pb-2 max-h-[600px] overflow-y-auto">
          {sources.map((s) => (
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
