import { IpcMainInvokeEvent } from "electron";

import log from "../../../common/log.js";
import { ASK_TEXT, ChatMessage } from "../../services/llm.js";

const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";
async function generateSearchQueries(
  event: any,
  apiKey: string,
  userQuery: string
): Promise<string[]> {
  const prompt = `
You are a search assistant for a similarity search system. 
Given a user query, generate 3 alternative search queries that capture 
different ways of asking the same thing. These queries will be used for 
similarity search to find relevant documents.

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
        name: "search_queries",
        schema: {
          type: "object",
          properties: {
            queries: {
              type: "array",
              items: {
                type: "string",
                description: "Alternative search query",
              },
              description: "List of 3 alternative search queries",
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
    return parsedResponse.queries;
  } catch (error) {
    console.error("Error parsing search queries response:", error);
    return [];
  }
}

async function searchLocalAPI(query: string, limit: number = 3) {
  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty");
  }

  const response = await fetch(`${URL}/text/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query_text: query.trim(), n_results: limit }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }

  const results = await response.json();
  return results;
}

export async function ragAnswer(
  event: IpcMainInvokeEvent,
  apiKey: string,
  userQuery: string,
  limit = 3
): Promise<string> {
  log.BG_BRIGHT_GREEN("RAG enabled, performing retrieval...", {
    userQuery,
    limit,
  });
  const queries = await generateSearchQueries(event, apiKey, userQuery);
  const results: any[] = [];
  for (const q of queries) {
    try {
      const r = await searchLocalAPI(q, limit);
      results.push(r);
    } catch (err) {
      console.error(`Error searching for "${q}":`, err);
    }
  }
  // now elemenate the duplicate in results based on ids
  const set = new Set<string>();
  const uniqueResults = [];
  for (const r of results) {
    const ids = r.ids[0];
    const documents = r.documents[0];
    const metadata = r.metadatas[0];

    for (let i = 0; i < ids.length; i++) {
      if (!set.has(ids[i])) {
        set.add(ids[i]);
        uniqueResults.push({
          id: ids[i],
          document: documents[i],
          metadata: metadata[i],
        });
      }
    }
  }
  log.BG_BRIGHT_GREEN("uniqueResults", uniqueResults);
  event.sender.send("stream-chunk", {
    chunk: JSON.stringify(uniqueResults),
    type: "source",
  });
  return uniqueResults.map((ur) => ur.document).join("\n\n");
}

// const v: SearchResult = {
//   ids: [["8416b7bb-3ac6-4d36-b958-674a558f0b7d"]],
//   embeddings: null,
//   documents: [
//     [
//       'output: commandResult.output, success: commandResult.success, }); currentContext = `${agentResponse.updatedContext}\\n\\nLast Command: ${agentResponse.command}\\nOutput: ${commandResult.output}`; if (!commandResult.success) { currentContext += `\\nCommand failed with error: ${commandResult.reason}`; // Send error information to UI event.sender.send("stream-chunk", { chunk: `ERROR: ${commandResult.reason}\\n`, type: "log", }); } } log.RED("max iterations reached"); log.YELLOW("task may not be fully completed. consider increasing maxIterations or checking the plan."); return { output: currentContext }; }; // Function declaration for Groq tool use export const executeCommandFD = { type: "function", function: { name: "executeCommand", description: "Execute a terminal command safely with security checks. Use this to run system commands, file operations, get date time or any terminal-based',
//     ],
//   ],
//   uris: null,
//   included: ["metadatas", "documents"],
//   data: null,
//   metadatas: [
//     [
//       {
//         path: "/Users/malikmuzzammilrafiq/Code/app/dist-electron/electron/tools/terminal/index.js",
//         index: 339,
//       },
//     ],
//   ],
//   distances: null,
// };
