import { OpenRouter } from "@openrouter/sdk";

const TAG = "model";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// Content types for multimodal messages
type TextContent = {
  type: "text";
  text: string;
};

type ImageUrlContent = {
  type: "image_url";
  imageUrl: {
    url: string;
  };
};

type MessageContent = TextContent | ImageUrlContent;

export type MultimodalMessage = {
  role: "user" | "assistant" | "system";
  content: string | MessageContent[];
};

export const ASK_TEXT = async function* (
  apiKey: string,
  messages: ChatMessage[],
  options?: Record<string, unknown> & { signal?: AbortSignal },
) {
  const openrouter = new OpenRouter({ apiKey });

  const {
    stream: _ignored,
    provider: __ignored,
    overrideModel,
    signal,
    ...opts
  } = options ?? {};

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const stream = await openrouter.chat.send(
    {
      model: (overrideModel as string | undefined) || "moonshotai/kimi-k2-0905",
      messages,
      ...opts,
      stream: true as const,
      provider: {
        sort: "throughput",
      },
    },
    {
      signal,
    },
  );

  for await (const chunk of stream) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content || delta?.reasoning) {
      yield {
        content: delta?.content ?? undefined,
        reasoning: delta?.reasoning ?? undefined,
      };
    }
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
};

export const ASK_IMAGE = async function* (
  apiKey: string,
  textContent: string,
  base64Images: string[],
  options?: Record<string, unknown> & { controller?: AbortController },
) {
  const openrouter = new OpenRouter({ apiKey });
  const {
    stream: _ignored,
    provider: __ignored,
    overrideModel,
    controller,
    ...opts
  } = options ?? {};

  // Build multimodal content array
  const contentArray: MessageContent[] = [
    {
      type: "text",
      text: textContent,
    },
  ];

  for (const base64Image of base64Images) {
    contentArray.push({
      type: "image_url",
      imageUrl: {
        url: base64Image,
      },
    });
  }

  const messages: MultimodalMessage[] = [
    {
      role: "user",
      content: contentArray,
    },
  ];

  const stream = await openrouter.chat.send(
    {
      model:
        (overrideModel as string | undefined) ||
        "qwen/qwen3-vl-30b-a3b-thinking",
      messages: messages as any,
      ...opts,
      stream: true as const,
      provider: {
        sort: "throughput",
      },
    },
    {
      signal: controller?.signal,
    },
  );

  for await (const chunk of stream) {
    if (controller?.signal?.aborted) {
      break;
    }
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content || delta?.reasoning) {
      yield {
        content: delta?.content ?? undefined,
        reasoning: delta?.reasoning ?? undefined,
      };
    }
  }
};

export const EXTRACT_WEB_SEARCH = async function (
  apiKey: string,
  query: string,
  webPageContent: string,
): Promise<string | null | undefined> {
  const openrouter = new OpenRouter({ apiKey });

  const results = await openrouter.chat.send({
    model: "google/gemini-2.0-flash-lite-001",
    messages: [
      {
        role: "system",
        content:
          "u are web page info extractor. user will provide you a query and the extracted info from crawled wep page results. you have to answer only with the extracted info from crawled wep page results.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: query,
          },
          {
            type: "text",
            text: webPageContent,
          },
        ],
      },
    ],
  });

  const content = results.choices?.[0]?.message?.content;

  // Handle case where content might be an array of content items
  if (Array.isArray(content)) {
    // Extract text from all text content items
    return content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("");
  }

  return content;
};
