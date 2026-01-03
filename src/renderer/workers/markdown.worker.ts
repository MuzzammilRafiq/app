import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { visit } from "unist-util-visit";
import { createHighlighter, type Highlighter } from "shiki";

// Define message types
export type WorkerMessage = {
  id: string;
  content: string;
  isUser: boolean;
};

export type WorkerResponse = {
  id: string;
  html: string;
  error?: string;
};

// Singleton highlighter instance
let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
let isShikiErrored = false;

// Initialize highlighter with common languages and a theme
async function getHighlighter() {
  if (isShikiErrored) return null;
  if (highlighter) return highlighter;
  if (highlighterPromise) return highlighterPromise;

  try {
    highlighterPromise = createHighlighter({
      themes: ["one-light", "github-dark"], // Load both for potential theme switching
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "python",
        "json",
        "html",
        "css",
        "bash",
        "markdown",
        "sql",
        "java",
        "c",
        "cpp",
        "go",
        "rust",
        "yaml",
        "xml",
        "docker",
        "dockerfile",
      ],
    });

    highlighter = await highlighterPromise;
    return highlighter;
  } catch (e) {
    console.error("Failed to initialize Shiki:", e);
    isShikiErrored = true;
    return null;
  }
}

// Custom rehype plugin to highlight code blocks using Shiki
function rehypeShiki({ theme }: { theme: string }) {
  return async (tree: any) => {
    const highlighter = await getHighlighter();
    if (!highlighter) return; // Fallback to plain code blocks

    visit(tree, "element", (node, index, parent) => {
      // Check for <pre><code>...</code></pre> pattern
      if (
        node.tagName === "pre" &&
        node.children &&
        node.children.length > 0 &&
        node.children[0].tagName === "code"
      ) {
        const codeNode = node.children[0];
        // Get language from class name (e.g., "language-js")
        const className =
          codeNode.properties?.className &&
          Array.isArray(codeNode.properties.className)
            ? codeNode.properties.className.join(" ")
            : "";
        const match = /language-(\w+)/.exec(className);
        const lang = match ? match[1] : "text";

        // Get code content
        let codeContent = "";
        if (
          codeNode.children &&
          codeNode.children.length > 0 &&
          codeNode.children[0].type === "text"
        ) {
          codeContent = codeNode.children[0].value;
        }

        try {
          // Verify language exists, fallback to text if not
          const loadedLangs = highlighter.getLoadedLanguages();
          const safeLang = loadedLangs.includes(lang || "") ? lang : "text";

          const hast = highlighter.codeToHast(codeContent, {
            lang: safeLang as any,
            theme: theme,
          });

          // Replace current node (pre) with the hast root's children (pre)
          if (parent && typeof index === "number") {
            // codeToHast returns a Root node { type: 'root', children: [...] }
            // The first child is the <pre> element.
            if (hast.children && hast.children.length > 0) {
              const preNode = hast.children[0] as any;

              // Helper to merge styles or add standard classes if needed
              // For now, let's trust Shiki's output but ensure it has nice defaults
              if (!preNode.properties) preNode.properties = {};

              // Add standard classes for styling consistency if Shiki theme doesn't provide them
              preNode.properties.className = [
                ...(preNode.properties.className || []),
                "shiki",
                "rounded-xl",
                "p-4",
                "overflow-x-auto",
                "my-4",
                "text-sm",
                "leading-relaxed",
                "border",
                "border-slate-200/50",
              ];

              // Ensure border/bg matches theme expectations if needed
              // Shiki inline styles handle background, but border might be missing
              // We can rely on CSS targeting .shiki

              parent.children[index] = preNode;
            }
          }
        } catch (e) {
          console.error("Shiki highlight error:", e);
        }
      }
    });
  };
}

// Processor pipeline
async function processMarkdown(content: string, isUser: boolean) {
  // const theme = isUser ? "one-light" : "one-light"; // Use light theme for now, or pass in preference
  // Ideally, user messages are dark bg, assistant light bg.
  // Let's assume we want 'one-light' for assistant (paper look) and maybe 'github-dark' for user?
  // Previous code: User = bg-white/10 (dark mode-ish), Assistant = bg-slate-50 (light).
  // So User -> Dark theme, Assistant -> Light theme.
  const targetTheme = isUser ? "github-dark" : "one-light";

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        code: [["className", /^language-./]],
        span: [["className", /^line/], ["style"]], // Allow style for Shiki
        pre: [["className"], ["style"]],
      },
    })
    .use(rehypeShiki, { theme: targetTheme })
    .use(rehypeStringify)
    .process(content);

  return String(file);
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, content, isUser } = e.data;

  try {
    const html = await processMarkdown(content, isUser);
    self.postMessage({ id, html } as WorkerResponse);
  } catch (error) {
    self.postMessage({ id, html: "", error: String(error) } as WorkerResponse);
  }
};
