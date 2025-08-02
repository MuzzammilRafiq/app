import type { ChatMessage as ChatMessageType } from "../services/geminiService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";

export default function ChatMessage(message: ChatMessageType) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = !isUser && !isError && message.content === "";

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "",
          isUser
            ? "bg-blue-100 rounded-xl px-2 py-2 max-w-[75%]"
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

            {/* Display markdown content */}
            {message.content && (
              <div
                className={clsx(
                  "max-w-none leading-relaxed [&>p:last-child]:mb-0",
                  isUser ? "text-blue-700" : "text-slate-700"
                )}
              >
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
                      <h3
                        className={clsx("text-base font-bold mb-2 mt-4", isUser ? "text-blue-700" : "text-slate-800")}
                      >
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className={clsx("mb-2 leading-relaxed", isUser ? "text-blue-700" : "text-slate-700")}>
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul
                        className={clsx(
                          "list-disc list-inside mb-3 space-y-1 pl-6",
                          isUser ? "text-blue-700" : "text-slate-700"
                        )}
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
                    li: ({ children }) => (
                      <li className={clsx(isUser ? "text-blue-700" : "text-slate-700")}>{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className={clsx("font-semibold", isUser ? "text-blue-700" : "text-slate-800")}>
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
                            }}
                            showLineNumbers={language !== "text" && language !== "plaintext"}
                            wrapLines={true}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                    pre: ({ children }) => (
                      <pre
                        className={clsx(
                          "rounded-xl overflow-x-auto mb-3 p-4",
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
                          isUser
                            ? "border-gray-300 bg-gray-200 text-blue-700"
                            : "border-slate-200 bg-slate-100 text-slate-700"
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
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
