import type { ChatMessage as ChatMessageType } from "../services/geminiService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ChatMessage(message: ChatMessageType) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = !isUser && !isError && message.content === "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[70%] px-4 py-3 rounded-lg ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none"
            : isError
            ? "bg-red-100 text-red-800 border border-red-300 rounded-bl-none"
            : "bg-gray-200 text-gray-800 rounded-bl-none"
        }`}
      >
        {isStreaming ? (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-gray-600 text-sm">AI is typing...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Display images if present */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={image.name || `Image ${index + 1}`}
                      className="max-w-full max-h-48 rounded-lg border border-gray-300"
                      style={{ maxWidth: "200px" }}
                    />
                    {image.name && (
                      <div className={`text-xs mt-1 opacity-70 ${isUser ? "text-blue-100" : "text-gray-500"}`}>
                        {image.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Display markdown content */}
            {message.content && (
              <div className={`prose ${isUser ? "prose-invert" : ""} max-w-none`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom styling for different markdown elements
                    h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    code: ({ children, className }) => {
                      const isInline = !className;
                      if (isInline) {
                        return <code className="text-sm font-mono">{children}</code>;
                      }

                      // Extract language from className (format: language-{lang})
                      const language = className?.replace("language-", "") || "text";

                      return (
                        <div className="mb-2">
                          <SyntaxHighlighter
                            language={language}
                            style={oneDark}
                            customStyle={{
                              margin: 0,
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              lineHeight: "1.5",
                            }}
                            showLineNumbers={language !== "text" && language !== "plaintext"}
                            wrapLines={true}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                    pre: ({ children }) => <pre className="rounded-lg overflow-x-auto mb-2">{children}</pre>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2">{children}</blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`underline ${isUser ? "text-blue-100" : "text-blue-600"}`}
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-2">
                        <table className="min-w-full border border-gray-300">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold">{children}</th>
                    ),
                    td: ({ children }) => <td className="border border-gray-300 px-3 py-2">{children}</td>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        <div
          className={`text-xs mt-2 opacity-70 ${isUser ? "text-blue-100" : isError ? "text-red-600" : "text-gray-500"}`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
