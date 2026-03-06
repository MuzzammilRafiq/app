import { tool } from "ai";
import * as z from "zod";
import {
  createExecuteCommandTool,
  createTerminalAgentConfig,
} from "../terminal/index.js";
import { webSearchAnswer } from "../web-search/index.js";

export interface ChatToolRegistryContext {
  event: any;
  sessionId: string;
  apiKey: string;
  config: any;
  signal?: AbortSignal;
}

export function buildChatExecutionTools(context: ChatToolRegistryContext): {
  tools: Record<string, any>;
  availableToolNames: string[];
} {
  const tools: Record<string, any> = {
    executeCommand: createExecuteCommandTool(
      createTerminalAgentConfig(),
      context.event,
      context.signal,
    ),
  };

  if (context.config?.webSearch) {
    tools.webSearch = tool({
      description:
        "Search the web for up-to-date information and return a concise synthesis of the relevant results.",
      inputSchema: z.object({
        query: z.string().describe("The search query to look up on the web"),
        reason: z
          .string()
          .optional()
          .describe("Brief explanation of why this search is needed"),
        limitPerQuery: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Maximum results to fetch per generated query"),
      }),
      execute: async ({ query, reason, limitPerQuery }) => {
        if (context.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        if (reason) {
          context.event?.sender?.send("stream-chunk", {
            chunk: `WEB SEARCH REASON: ${reason}\n`,
            type: "log",
            sessionId: context.sessionId,
          });
        }

        const result = await webSearchAnswer(
          context.event,
          context.apiKey,
          query,
          context.sessionId,
          limitPerQuery ?? 1,
          context.signal,
        );

        return {
          query,
          result,
        };
      },
    });
  }

  return {
    tools,
    availableToolNames: Object.keys(tools),
  };
}