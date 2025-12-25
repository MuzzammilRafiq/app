import { OpenRouter } from "@openrouter/sdk";
import { promises as fs } from "fs";
import path from "node:path";

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

function guessMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

export const ASK_TEXT = async function* (
  apiKey: string,
  messages: ChatMessage[],
  options?: Record<string, unknown>,
) {
  const openrouter = new OpenRouter({ apiKey });

  const { stream: _ignored, provider: __ignored, ...opts } = options ?? {};
  const stream = await openrouter.chat.send({
    model: "moonshotai/kimi-k2-0905",
    messages,
    ...opts,
    stream: true as const,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content || delta?.reasoning) {
      yield {
        content: delta?.content ?? undefined,
        reasoning: delta?.reasoning ?? undefined,
      };
    }
  }
};

export const ASK_IMAGE = async function* (
  apiKey: string,
  textContent: string,
  imagePaths: string[],
  options?: Record<string, unknown>,
) {
  const openrouter = new OpenRouter({ apiKey });
  const { stream: _ignored, provider: __ignored, ...opts } = options ?? {};

  // Build multimodal content array
  const contentArray: MessageContent[] = [
    {
      type: "text",
      text: textContent,
    },
  ];

  // Add images as base64 encoded data URLs
  for (const imagePath of imagePaths) {
    try {
      const buffer = await fs.readFile(imagePath);
      const base64Image = buffer.toString("base64");
      const mimeType = guessMimeFromPath(imagePath);
      contentArray.push({
        type: "image_url",
        imageUrl: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      });
    } catch (err) {
      console.error(`Failed to read image at ${imagePath}:`, err);
    }
  }

  const messages: MultimodalMessage[] = [
    {
      role: "user",
      content: contentArray,
    },
  ];

  const stream = await openrouter.chat.send({
    model: "qwen/qwen3-vl-30b-a3b-thinking",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    ...opts,
    stream: true as const,
    provider: {
      sort: "throughput",
    },
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content || delta?.reasoning) {
      yield {
        content: delta?.content ?? undefined,
        reasoning: delta?.reasoning ?? undefined,
      };
    }
  }
};
