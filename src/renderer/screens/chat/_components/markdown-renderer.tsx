import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";

interface MarkdownRendererProps {
  content: string;
  isUser: boolean;
}

// Memoized code block component to avoid re-renders
const CodeBlock = memo(function CodeBlock({
  language,
  children,
  isUser,
}: {
  language: string | undefined;
  children: string;
  isUser: boolean;
}) {
  if (!language) {
    // Inline code
    return (
      <code
        className={clsx(
          "px-1.5 py-0.5 rounded text-sm font-mono",
          isUser
            ? "bg-white/20 text-white"
            : "bg-slate-100 text-slate-800"
        )}
      >
        {children}
      </code>
    );
  }

  return (
    <SyntaxHighlighter
      style={oneLight}
      language={language}
      PreTag="div"
      className="rounded-xl my-4 text-sm border border-slate-200/50"
    >
      {children}
    </SyntaxHighlighter>
  );
});

// Main markdown renderer - memoized to prevent unnecessary re-renders
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isUser,
}: MarkdownRendererProps) {
  // Memoize the components config to avoid recreating on each render
  const components = useMemo(
    () => ({
      code({
        className,
        children,
      }: {
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(className || "");
        const codeString = String(children).replace(/\n$/, "");

        return (
          <CodeBlock language={match?.[1]} isUser={isUser}>
            {codeString}
          </CodeBlock>
        );
      },
      table({ children }: { children?: React.ReactNode }) {
        return (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-slate-200 rounded-lg">
              {children}
            </table>
          </div>
        );
      },
      th({ children }: { children?: React.ReactNode }) {
        return (
          <th className="border border-slate-200 px-4 py-2 bg-slate-50 text-left font-semibold text-slate-700">
            {children}
          </th>
        );
      },
      td({ children }: { children?: React.ReactNode }) {
        return (
          <td className="border border-slate-200 px-4 py-2 text-slate-700">
            {children}
          </td>
        );
      },
      a({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "underline hover:no-underline",
              isUser ? "text-blue-200" : "text-blue-600"
            )}
          >
            {children}
          </a>
        );
      },
      blockquote({ children }: { children?: React.ReactNode }) {
        return (
          <blockquote
            className={clsx(
              "border-l-4 pl-4 my-4 italic",
              isUser
                ? "border-white/50 text-white/90"
                : "border-slate-300 text-slate-600"
            )}
          >
            {children}
          </blockquote>
        );
      },
    }),
    [isUser]
  );

  return (
    <div
      className={clsx("markdown-body", isUser ? "text-white" : "text-slate-800")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
