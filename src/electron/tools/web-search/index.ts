import { IpcMainInvokeEvent } from "electron";
import {
  ASK_TEXT,
  EXTRACT_WEB_SEARCH,
  type ChatMessage,
} from "../../services/model.js";
import { LOG, JSON_PRINT } from "../../utils/logging.js";

const TAG = "web-search";
const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

/**
 * Generate optimized web search queries from user input.
 * Returns 3-4 diverse search queries suitable for internet search.
 */
async function generateWebSearchQueries(
  event: IpcMainInvokeEvent,
  apiKey: string,
  userQuery: string
): Promise<string[]> {
  const prompt = `
You are a search query optimizer for web search.
Given a user's question or request, generate 3-4 different search queries that would help find relevant information on the internet.

Guidelines:
- Make queries specific and searchable
- Use different phrasings to capture different aspects
- Include relevant keywords that might appear in web pages
- Keep queries concise but informative

User query: "${userQuery}"
`;

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
  };

  const response = ASK_TEXT(apiKey, messages, options);
  if (!response) {
    throw new Error("No response content received from LLM");
  }

  let c = "";
  for await (const { content, reasoning } of response) {
    if (content) {
      c += content;
    }
    if (reasoning) {
      event.sender.send("stream-chunk", {
        chunk: reasoning,
        type: "log",
      });
    }
  }

  try {
    const parsedResponse = JSON.parse(c);
    LOG(TAG).INFO(
      "Generated web search queries:",
      JSON_PRINT(parsedResponse.queries)
    );
    return parsedResponse.queries;
  } catch (error) {
    LOG(TAG).ERROR("Error parsing web search queries response:", error);
    return [userQuery]; // Fallback to original query
  }
}

/**
 * Call the Python web search API with generated queries.
 * Returns concatenated markdown content from search results.
 */
async function searchWebAPI(
  queries: string[],
  limitPerQuery: number = 1
): Promise<{ results: any[]; errors: string[] | null }> {
  const response = await fetch(`${URL}/web/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queries,
      limit_per_query: limitPerQuery,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Web search failed: ${response.status}`
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
  limitPerQuery: number = 1
): Promise<string> {
  LOG(TAG).INFO("Web search enabled, generating queries...", { userQuery });

  event.sender.send("stream-chunk", {
    chunk: "*Generating web search queries...*",
    type: "log",
  });

  // Generate optimized search queries
  const queries = await generateWebSearchQueries(event, apiKey, userQuery);

  // Log the generated queries to UI
  event.sender.send("stream-chunk", {
    chunk: `*Generated queries:*\n${queries.map((q, i) => `  ${i + 1}. "${q}"`).join("\n")}`,
    type: "log",
  });

  event.sender.send("stream-chunk", {
    chunk: `*Searching the web with ${queries.length} queries...*`,
    type: "log",
  });

  try {
    // Call the web search API
    const searchResponse = await searchWebAPI(queries, limitPerQuery);

    if (searchResponse.errors && searchResponse.errors.length > 0) {
      LOG(TAG).WARN("Some web searches had errors:", searchResponse.errors);
    }

    // Filter successful results and format
    const successfulResults = searchResponse.results.filter((r) => r.success);

    if (successfulResults.length === 0) {
      event.sender.send("stream-chunk", {
        chunk: "*No web search results found*",
        type: "log",
      });
      return "No relevant web search results found.";
    }

    event.sender.send("stream-chunk", {
      chunk: `*Found ${successfulResults.length} web pages*`,
      type: "log",
    });

    // Send sources to UI
    const sources = successfulResults.map((r) => ({
      url: r.url,
      title: r.title,
    }));
    event.sender.send("stream-chunk", {
      chunk: JSON.stringify(sources),
      type: "source",
    });

    // Combine all markdown into one pile
    const combinedMarkdown = successfulResults
      .map(
        (r, i) =>
          `## Source ${i + 1}: ${r.title}\nURL: ${r.url}\n\n${r.markdown}`
      )
      .join("\n\n---\n\n");

    event.sender.send("stream-chunk", {
      chunk: "*Extracting relevant info from web pages...*",
      type: "log",
    });

    // Use cheap model to extract only relevant info
    const extractedInfo = await EXTRACT_WEB_SEARCH(
      apiKey,
      userQuery,
      combinedMarkdown
    );

    LOG(TAG).SUCCESS(
      `Web search completed with ${successfulResults.length} results, extracted relevant info`
    );

    return (
      extractedInfo || "No relevant information extracted from web search."
    );
  } catch (error) {
    LOG(TAG).ERROR("Web search API error:", error);
    event.sender.send("stream-chunk", {
      chunk: `*Web search error: ${error instanceof Error ? error.message : "Unknown error"}*`,
      type: "log",
    });
    return `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
