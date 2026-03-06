import { IpcMainInvokeEvent } from "electron";
import {
  ASK_TEXT,
  EXTRACT_WEB_SEARCH,
  type ChatMessage,
} from "../../services/model.js";
import { LOG, JSON_PRINT } from "../../utils/logging.js";
import { StreamChunkBuffer } from "../../utils/stream-buffer.js";
import { getChatStreamContextFromEvent, sendChatChunk } from "../../utils/chat-stream.js";
import { createWebSearchQueriesPrompt } from "../../prompts/web-search.js";

const TAG = "web-search";
const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

/**
 * Generate optimized web search queries from user input.
 * Returns 3-4 diverse search queries suitable for internet search.
 */
async function generateWebSearchQueries(
  event: IpcMainInvokeEvent,
  apiKey: string,
  userQuery: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const prompt = createWebSearchQueriesPrompt(userQuery);

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];

  const options = {
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "web_search_queries",
        schema: {
          type: "object",
          properties: {
            queries: {
              type: "array",
              items: {
                type: "string",
                description: "A web search query",
              },
              description: "List of 3-4 optimized web search queries",
            },
          },
          required: ["queries"],
          additionalProperties: false,
        },
      },
    },
    stream: false,
    signal,
  };

  const response = ASK_TEXT(apiKey, messages, options);
  if (!response) {
    throw new Error("No response content received from LLM");
  }

  const buffer = new StreamChunkBuffer(
    event.sender,
    getChatStreamContextFromEvent(event),
  );
  let c = "";
  for await (const { content, reasoning } of response) {
    if (content) {
      c += content;
    }
    if (reasoning) {
      buffer.send(reasoning, "log");
    }
  }
  buffer.flush();

  try {
    const parsedResponse = JSON.parse(c);
    LOG(TAG).INFO(
      "Generated web search queries:",
      JSON_PRINT(parsedResponse.queries),
    );
    return parsedResponse.queries;
  } catch (error) {
    LOG(TAG).ERROR("Error parsing web search queries response:", error);
    return [userQuery]; // Fallback to original query
  }
}

/**
 * Helper: Creates a promise that rejects when the signal is aborted.
 * Use with Promise.race to make any async operation "cancellable".
 */
function createAbortPromise(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) {
      // Never resolves/rejects if no signal - just keeps waiting forever
      return;
    }
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Call the Python web search API with generated queries.
 * Returns concatenated markdown content from search results.
 * If signal is aborted, rejects immediately (server may continue, we just don't wait).
 */
async function searchWebAPI(
  queries: string[],
  limitPerQuery: number = 1,
  signal?: AbortSignal,
): Promise<{ results: any[]; errors: string[] | null }> {
  const fetchPromise = fetch(`${URL}/web/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queries,
      limit_per_query: limitPerQuery,
    }),
  });

  // Race between fetch and abort - if aborted, we stop waiting immediately
  const response = signal
    ? await Promise.race([fetchPromise, createAbortPromise(signal)])
    : await fetchPromise;

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Web search failed: ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Main web search function that generates queries and fetches results.
 * Returns formatted markdown content for context augmentation.
 */
export async function webSearchAnswer(
  event: IpcMainInvokeEvent,
  apiKey: string,
  userQuery: string,
  sessionId: string,
  limitPerQuery: number = 1,
  signal?: AbortSignal,
): Promise<string> {
  LOG(TAG).INFO("Web search enabled, generating queries...", { userQuery });
  const context = getChatStreamContextFromEvent(event);

  // Send search status event - generating queries
  sendChatChunk(
    event.sender,
    context,
    JSON.stringify({
      phase: "generating",
      message: "Generating search queries",
    }),
    "search-status",
  );

  // Generate optimized search queries
  const queries = await generateWebSearchQueries(
    event,
    apiKey,
    userQuery,
    sessionId,
    signal,
  );

  // Check if cancelled - bail out early (server query may still run, we just won't use it)
  if (signal?.aborted) {
    LOG(TAG).INFO("Web search cancelled by user after query generation");
    return "";
  }

  // Log the generated queries to UI (keep as log for details)
  sendChatChunk(
    event.sender,
    context,
    `*Generated queries:*\n${queries.map((q, i) => `  ${i + 1}. "${q}"`).join("\n")}`,
    "log",
  );

  // Send search status event - searching
  sendChatChunk(
    event.sender,
    context,
    JSON.stringify({
      phase: "searching",
      message: `Searching ${queries.length} queries`,
    }),
    "search-status",
  );

  try {
    // Call the web search API - if signal aborts, Promise.race rejects immediately
    const searchResponse = await searchWebAPI(queries, limitPerQuery, signal);

    // Check if cancelled after search API returns
    if (signal?.aborted) {
      LOG(TAG).INFO("Web search cancelled by user after API response");
      return "";
    }

    if (searchResponse.errors && searchResponse.errors.length > 0) {
      LOG(TAG).WARN("Some web searches had errors:", searchResponse.errors);
    }

    // Filter successful results and format
    const successfulResults = searchResponse.results.filter((r) => r.success);

    if (successfulResults.length === 0) {
      sendChatChunk(
        event.sender,
        context,
        JSON.stringify({
          phase: "complete",
          message: "No results found",
        }),
        "search-status",
      );
      return "No relevant web search results found.";
    }

    // Send search status event - processing
    sendChatChunk(
      event.sender,
      context,
      JSON.stringify({
        phase: "processing",
        message: `Found ${successfulResults.length} pages`,
      }),
      "search-status",
    );

    // Send sources to UI
    const sources = successfulResults.map((r) => ({
      url: r.url,
      title: r.title,
    }));
    sendChatChunk(event.sender, context, JSON.stringify(sources), "source");

    // Combine all markdown into one pile
    const combinedMarkdown = successfulResults
      .map(
        (r, i) =>
          `## Source ${i + 1}: ${r.title}\nURL: ${r.url}\n\n${r.markdown}`,
      )
      .join("\n\n---\n\n");

    // Send search status event - extracting
    sendChatChunk(
      event.sender,
      context,
      JSON.stringify({
        phase: "extracting",
        message: "Extracting relevant info",
      }),
      "search-status",
    );

    // Use cheap model to extract only relevant info
    const extractedInfo = await EXTRACT_WEB_SEARCH(
      apiKey,
      userQuery,
      combinedMarkdown,
    );

    // Send search status event - complete
    sendChatChunk(
      event.sender,
      context,
      JSON.stringify({ phase: "complete", message: "Search complete" }),
      "search-status",
    );

    LOG(TAG).SUCCESS(
      `Web search completed with ${successfulResults.length} results, extracted relevant info`,
    );

    return (
      extractedInfo || "No relevant information extracted from web search."
    );
  } catch (error) {
    // Handle cancellation gracefully - not an error
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.message === "Aborted")
    ) {
      LOG(TAG).INFO("Web search cancelled by user");
      return "";
    }

    LOG(TAG).ERROR("Web search API error:", error);
    sendChatChunk(
      event.sender,
      context,
      JSON.stringify({
        phase: "error",
        message: error instanceof Error ? error.message : "Search failed",
      }),
      "search-status",
    );
    return `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
