import type { ChatMessage as ChatMessageType } from "../services/llm";
import type { MakePlanResponse } from "../../common/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";
import { useState } from "react";

function MarkdownRenderer({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom styling for different markdown elements
        h1: ({ children }) => (
          <h1 className={clsx("text-xl font-bold mb-3 mt-6", isUser ? "text-blue-700" : "text-slate-800")}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className={clsx("text-lg font-bold mb-2 mt-5", isUser ? "text-blue-700" : "text-slate-800")}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className={clsx("text-base font-bold mb-2 mt-4", isUser ? "text-blue-700" : "text-slate-800")}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className={clsx("mb-2 leading-relaxed", isUser ? "text-blue-700" : "text-slate-700")}>{children}</p>
        ),
        ul: ({ children }) => (
          <ul
            className={clsx("list-disc list-inside mb-3 space-y-1 pl-6", isUser ? "text-blue-700" : "text-slate-700")}
          >
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol
            className={clsx(
              "list-decimal list-inside mb-3 space-y-1 pl-6",
              isUser ? "text-blue-700" : "text-slate-700"
            )}
          >
            {children}
          </ol>
        ),
        li: ({ children }) => <li className={clsx(isUser ? "text-blue-700" : "text-slate-700")}>{children}</li>,
        strong: ({ children }) => (
          <strong className={clsx("font-semibold", isUser ? "text-blue-700" : "text-slate-800")}>{children}</strong>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className={clsx(
                  "text-sm font-mono px-1.5 py-0.5 rounded-md",
                  isUser ? "bg-gray-200 text-blue-700" : "bg-slate-200 text-slate-700"
                )}
              >
                {children}
              </code>
            );
          }

          // Extract language from className (format: language-{lang})
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
                showLineNumbers={language !== "text" && language !== "plaintext"}
                wrapLines={true}
                wrapLongLines={true}
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
              isUser ? "bg-gray-200 border border-gray-300" : "bg-slate-50 border border-slate-200"
            )}
          >
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className={clsx(
              "border-l-4 pl-4 italic mb-3",
              isUser ? "border-gray-400 text-blue-700" : "border-slate-300 text-slate-600"
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
              isUser ? "text-blue-700 hover:text-blue-800" : "text-blue-600 hover:text-blue-700"
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
                isUser ? "border-blue-500/30" : "border-slate-200"
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
              isUser ? "border-gray-300 bg-gray-200 text-blue-700" : "border-slate-200 bg-slate-100 text-slate-700"
            )}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            className={clsx(
              "border px-4 py-3",
              isUser ? "border-gray-300 text-blue-700" : "border-slate-200 text-slate-700"
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
function PlanRenderer({ content }: { content: string }) {
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
export default function ChatMessage(message: ChatMessageType) {
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = !isUser && !isError && message.content === "";

  // Get message type for rendering logic
  const getMessageType = () => {
    if (isUser) return "user";
    switch (message.type) {
      case "plan":
        return "plan";
      case "log":
        return "log";
      case "stream":
        return "stream";
      default:
        return "stream";
    }
  };

  const messageType = getMessageType();

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[80%] break-words overflow-hidden overflow-wrap-anywhere",
          isUser
            ? "bg-blue-100 rounded-xl px-2 py-2"
            : isError
              ? "bg-gradient-to-br from-red-50 to-red-100 text-red-800 border-red-200 px-4 py-2.5"
              : "text-slate-800 px-4 py-2.5"
        )}
      >
        {isStreaming ? (
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Display images if present */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {message.images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={image.name || `Image ${index + 1}`}
                      className="max-w-full max-h-48 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md"
                      style={{ maxWidth: "200px" }}
                    />
                    {image.name && (
                      <div className={clsx("text-xs mt-2 opacity-75", isUser ? "text-gray-500" : "text-slate-500")}>
                        {image.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {messageType === "plan" && (
              // Render plan messages
              <PlanRenderer content={message.content} />
            )}

            {messageType === "log" && (
              // Render log messages
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <button
                  onClick={() => setIsLogExpanded(!isLogExpanded)}
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
                      isLogExpanded ? "rotate-180" : "rotate-0"
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
                    isLogExpanded ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
                  )}
                >
                  <pre className="text-sm text-amber-700 whitespace-pre-wrap font-mono break-words overflow-hidden">
                    {message.content}
                  </pre>
                </div>
              </div>
            )}

            {(messageType === "stream" || messageType === "user") && message.content && (
              // Render stream messages and user messages with markdown formatting
              <div
                className={clsx(
                  "max-w-none leading-relaxed [&>p:last-child]:mb-0 break-words overflow-hidden",
                  isUser ? "text-blue-700" : "text-slate-700"
                )}
              >
                <MarkdownRenderer content={message.content} isUser={isUser} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
