import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  duotoneLight as lightTheme,
  duotoneEarth as darkTheme,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";
import { useTheme } from "../../../hooks/useTheme";

interface MarkdownRendererProps {
  content: string;
  isUser: boolean;
}

// Memoized code block component to avoid re-renders
const CodeBlock = memo(function CodeBlock({
  language,
  children,
  isUser,
  isDark,
}: {
  language: string | undefined;
  children: string;
  isUser: boolean;
  isDark: boolean;
}) {
  if (!language) {
    // Inline code
    return (
      <code
        className={clsx(
          "px-1.5 py-0.5 rounded text-sm font-mono",
          isUser ? "bg-white/20 text-white" : "bg-border text-text-main"
        )}
      >
        {children}
      </code>
    );
  }

  // User messages always use dark theme (since they have dark background)
  // Assistant messages use theme based on app's current mode
  const codeStyle = isUser || isDark ? darkTheme : lightTheme;

  return (
    <SyntaxHighlighter
      style={codeStyle}
      language={language}
      PreTag="div"
      className="rounded-xl my-4 text-sm border border-border"
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
  const { isDark } = useTheme();

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
          <CodeBlock language={match?.[1]} isUser={isUser} isDark={isDark}>
            {codeString}
          </CodeBlock>
        );
      },
      table({ children }: { children?: React.ReactNode }) {
        return (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-border rounded-lg">
              {children}
            </table>
          </div>
        );
      },
      th({ children }: { children?: React.ReactNode }) {
        return (
          <th className="border border-border px-4 py-2 bg-surface text-left font-semibold text-text-muted">
            {children}
          </th>
        );
      },
      td({ children }: { children?: React.ReactNode }) {
        return (
          <td className="border border-border px-4 py-2 text-text-muted">
            {children}
          </td>
        );
      },
      a({ href, children }: { href?: string; children?: React.ReactNode }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "underline hover:no-underline",
              isUser ? "text-blue-200" : "text-blue-600 dark:text-blue-400"
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
                : "border-border text-text-muted"
            )}
          >
            {children}
          </blockquote>
        );
      },
    }),
    [isUser, isDark]
  );

  return (
    <div
      className={clsx(
        "markdown-body",
        isUser ? "text-white" : "text-text-main"
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
