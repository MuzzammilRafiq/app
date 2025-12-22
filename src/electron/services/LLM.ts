import { OpenRouter } from "@openrouter/sdk";
import { promises as fs } from "fs";
import path from "node:path";

// Response types
export interface ChatTextResponse {
  text: string;
  reasoning?: string;
}

export interface ChatImageResponse {
  text: string;
  reasoning?: string;
}

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface StreamChunk {
  content?: string;
  reasoning?: string;
}

/**
 * Guess MIME type from file path extension
 */
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
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

/**
 * Process image data and return a data URL for OpenRouter API
 */
async function processImageData(imageData: string): Promise<string> {
  // URL - return as-is
  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    return imageData;
  }

  // Already a data URL - return as-is
  if (imageData.startsWith("data:")) {
    return imageData;
  }

  // File path - read and convert to base64 data URL
  if (
    imageData.includes("/") ||
    imageData.includes("\\") ||
    path.isAbsolute(imageData)
  ) {
    const mimeType = guessMimeFromPath(imageData);
    const buffer = await fs.readFile(imageData);
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  }

  // Assume raw base64 string - wrap as data URL with default MIME type
  return `data:image/jpeg;base64,${imageData}`;
}

/**
 * Extract text content from OpenRouter response content
 * Content can be a string or an array of content items
 */
function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (item): item is { type: "text"; text: string } =>
          item &&
          typeof item === "object" &&
          item.type === "text" &&
          typeof item.text === "string"
      )
      .map((item) => item.text)
      .join("");
  }
  return "";
}

export class Llm {
  private static instance: Llm;
  private openrouter: OpenRouter | null = null;
  private currentApiKey: string | null = null;

  private constructor() {}

  public static getInstance(): Llm {
    return Llm.instance || (Llm.instance = new Llm());
  }

  /**
   * Get or create OpenRouter instance with the given API key
   */
  private getOpenRouter(apiKey: string): OpenRouter {
    // Recreate instance if API key changed
    if (!this.openrouter || this.currentApiKey !== apiKey) {
      this.openrouter = new OpenRouter({
        apiKey,
      });
      this.currentApiKey = apiKey;
    }
    return this.openrouter;
  }

  /**
   * Chat with LLM and return a single text response
   * Supports thinking/reasoning models - reasoning is returned in the response
   */
  public async chatText(
    apiKey: string,
    modelId: string,
    messages: ChatMessage[],
    options?: Record<string, unknown>
  ): Promise<ChatTextResponse> {
    const openrouter = this.getOpenRouter(apiKey);

    const result = await openrouter.chat.send({
      model: modelId,
      messages,
      stream: false,
      ...options,
    });

    const message = result.choices?.[0]?.message;
    const rawContent = message?.content;
    const content = extractTextContent(rawContent);
    // Extract reasoning if present (thinking/reasoning models include this)
    const reasoning = message?.reasoning ?? undefined;

    return {
      text: content,
      reasoning: reasoning || undefined,
    };
  }

  /**
   * Stream text from LLM using async generator
   * Yields simplified chunks with content and/or reasoning
   *
   * Usage:
   *   for await (const { content, reasoning } of llm.streamText(...)) {
   *     if (reasoning) console.log(reasoning);
   *     if (content) console.log(content);
   *   }
   */
  public async *streamText(
    apiKey: string,
    modelId: string,
    messages: ChatMessage[],
    options?: Record<string, unknown>
  ): AsyncGenerator<StreamChunk> {
    const openrouter = this.getOpenRouter(apiKey);

    const stream = await openrouter.chat.send({
      model: modelId,
      messages,
      stream: true,
      ...options,
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
  }

  /**
   * Chat with an image using a multimodal model
   * Returns description of the image with any text detected
   * Supports thinking/reasoning models
   *
   * @param imageData - Can be:
   *   - A file path (will be read and converted to base64)
   *   - A URL starting with http:// or https://
   *   - A base64 encoded string (with or without data: prefix)
   */
  public async chatImage(
    apiKey: string,
    modelId: string,
    imageData: string,
    options?: Record<string, unknown>
  ): Promise<ChatImageResponse> {
    const openrouter = this.getOpenRouter(apiKey);
    const imageUrl = await processImageData(imageData);

    const result = await openrouter.chat.send({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in detail. If there is any text in the image, read and include that text as well.",
            },
            {
              type: "image_url",
              imageUrl: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      stream: false,
      ...options,
    });

    const message = result.choices?.[0]?.message;
    const rawContent = message?.content;
    const content = extractTextContent(rawContent);
    const reasoning = message?.reasoning ?? undefined;

    return {
      text: content,
      reasoning: reasoning || undefined,
    };
  }

  /**
   * Stream image description from a multimodal model using async generator
   * Yields simplified chunks with content and/or reasoning
   *
   * Usage:
   *   for await (const { content } of llm.streamImage(...)) {
   *     if (content) console.log(content);
   *   }
   *
   * @param imageData - Can be:
   *   - A file path (will be read and converted to base64)
   *   - A URL starting with http:// or https://
   *   - A base64 encoded string (with or without data: prefix)
   */
  public async *streamImage(
    apiKey: string,
    modelId: string,
    imageData: string,
    options?: Record<string, unknown>
  ): AsyncGenerator<StreamChunk> {
    const openrouter = this.getOpenRouter(apiKey);
    const imageUrl = await processImageData(imageData);

    const stream = await openrouter.chat.send({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in detail. If there is any text in the image, read and include that text as well.",
            },
            {
              type: "image_url",
              imageUrl: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      stream: true,
      ...options,
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
  }
}

export const llm = Llm.getInstance();

if (require.main === module) {
  // run as => bun file.ts <test_number>
  // 1: chatText (regular model)
  // 2: streamText (regular model)
  // 3: chatImage
  // 4: streamImage
  // 5: chatText with thinking model
  // 6: streamText with thinking model
  const args = process.argv;
  const test = args[2] as "1" | "2" | "3" | "4" | "5" | "6";

  switch (test) {
    case "1":
      // Regular chatText
      const textRes = await llm.chatText(
        process.env.OPENROUTER_API_KEY!,
        "moonshotai/kimi-k2-0905",
        [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "hello" },
        ]
      );
      console.log("Response:", textRes.text);
      break;

    case "2":
      // Regular streamText
      process.stdout.write("Response: ");
      for await (const { content } of llm.streamText(
        process.env.OPENROUTER_API_KEY!,
        "moonshotai/kimi-k2-0905",
        [{ role: "user", content: "hello" }]
      )) {
        if (content) {
          process.stdout.write(content);
        }
      }
      console.log();
      break;

    case "3":
      // chatImage
      const imageRes = await llm.chatImage(
        process.env.OPENROUTER_API_KEY!,
        "qwen/qwen3-vl-32b-instruct",
        "/Users/malikmuzzammilrafiq/Downloads/hui.jpg"
      );
      console.log("Response:", imageRes.text);
      break;

    case "4":
      // streamImage
      process.stdout.write("Response: ");
      for await (const { content } of llm.streamImage(
        process.env.OPENROUTER_API_KEY!,
        "qwen/qwen3-vl-32b-instruct",
        "/Users/malikmuzzammilrafiq/Downloads/hui.jpg"
      )) {
        if (content) {
          process.stdout.write(content);
        }
      }
      console.log();
      break;

    case "5":
      // chatText with thinking model
      console.log("Testing thinking model (non-streaming)...\n");
      const thinkingRes = await llm.chatText(
        process.env.OPENROUTER_API_KEY!,
        "moonshotai/kimi-k2-thinking",
        [{ role: "user", content: "What is 15 * 27? Show your work." }]
      );
      if (thinkingRes.reasoning) {
        console.log("=== REASONING ===");
        console.log(thinkingRes.reasoning);
        console.log("=================\n");
      }
      console.log("=== RESPONSE ===");
      console.log(thinkingRes.text);
      break;

    case "6":
      // streamText with thinking model
      console.log("Testing thinking model (streaming)...\n");

      let isInReasoning = false;
      let isInContent = false;

      for await (const { content, reasoning } of llm.streamText(
        process.env.OPENROUTER_API_KEY!,
        "moonshotai/kimi-k2-thinking",
        [{ role: "user", content: "What is 15 * 27? Show your work." }]
      )) {
        // Handle reasoning chunks
        if (reasoning) {
          if (!isInReasoning) {
            console.log("=== REASONING ===");
            isInReasoning = true;
          }
          process.stdout.write(reasoning);
        }

        // Handle content chunks
        if (content) {
          if (isInReasoning && !isInContent) {
            console.log("\n=================\n");
            console.log("=== RESPONSE ===");
            isInContent = true;
          }
          process.stdout.write(content);
        }
      }
      console.log();
      break;

    default:
      console.log("Usage: bun file.ts <test_number>");
      console.log("  1: chatText (regular model)");
      console.log("  2: streamText (regular model)");
      console.log("  3: chatImage");
      console.log("  4: streamImage");
      console.log("  5: chatText with thinking model");
      console.log("  6: streamText with thinking model");
  }
}
