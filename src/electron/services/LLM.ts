import { generateText, streamText as aiStreamText, StreamTextResult } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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

// Re-export the AI SDK stream type for consumers
export type TextStreamResult = StreamTextResult<Record<string, never>, never>;

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
 * Process image data and return image content for AI SDK
 */
async function processImageData(
  imageData: string
): Promise<{ type: "image"; image: URL | string; mimeType?: string }> {
  // URL
  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    return { type: "image", image: new URL(imageData) };
  }

  // Already a data URL
  if (imageData.startsWith("data:")) {
    return { type: "image", image: imageData };
  }

  // File path - read and convert to base64
  if (
    imageData.includes("/") ||
    imageData.includes("\\") ||
    path.isAbsolute(imageData)
  ) {
    const mimeType = guessMimeFromPath(imageData);
    const buffer = await fs.readFile(imageData);
    const base64 = buffer.toString("base64");
    return { type: "image", image: base64, mimeType };
  }

  // Assume raw base64 string
  return { type: "image", image: imageData };
}

export class LLM {
  private static instance: LLM;
  private openrouter: ReturnType<typeof createOpenRouter> | null = null;

  private constructor() {}

  public static getInstance(): LLM {
    return LLM.instance || (LLM.instance = new LLM());
  }

  /**
   * Get or create OpenRouter instance with the given API key
   */
  private getOpenRouter(apiKey: string) {
    if (!this.openrouter) {
      this.openrouter = createOpenRouter({ apiKey });
    }
    return this.openrouter;
  }

  /**
   * Chat with LLM and return a single text response
   * Supports thinking/reasoning models
   */
  public async chatText(
    apiKey: string,
    modelId: string,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: Record<string, unknown>
  ): Promise<ChatTextResponse> {
    const openrouter = this.getOpenRouter(apiKey);
    const model = openrouter(modelId);

    const result = await generateText({
      model,
      messages,
      ...options,
    });

    // Extract reasoning text if available
    const reasoningText = result.reasoning
      ?.map((r) => r.text)
      .filter(Boolean)
      .join("\n");

    return {
      text: result.text,
      reasoning: reasoningText || undefined,
    };
  }

  /**
   * Stream text from LLM
   * Returns the AI SDK StreamTextResult directly - use .fullStream, .textStream, etc.
   * Supports thinking/reasoning models
   */
  public streamText(
    apiKey: string,
    modelId: string,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: Record<string, unknown>
  ): TextStreamResult {
    const openrouter = this.getOpenRouter(apiKey);
    const model = openrouter(modelId);

    return aiStreamText({
      model,
      messages,
      ...options,
    });
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
    const model = openrouter(modelId);
    const imageContent = await processImageData(imageData);

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            imageContent,
            {
              type: "text",
              text: "Describe this image in detail. If there is any text in the image, read and include that text as well.",
            },
          ],
        },
      ],
      ...options,
    });

    // Extract reasoning text if available
    const reasoningText = result.reasoning
      ?.map((r) => r.text)
      .filter(Boolean)
      .join("\n");

    return {
      text: result.text,
      reasoning: reasoningText || undefined,
    };
  }

  /**
   * Stream image description from a multimodal model
   * Returns the AI SDK StreamTextResult directly - use .fullStream, .textStream, etc.
   * Supports thinking/reasoning models
   *
   * @param imageData - Can be:
   *   - A file path (will be read and converted to base64)
   *   - A URL starting with http:// or https://
   *   - A base64 encoded string (with or without data: prefix)
   */
  public async streamImage(
    apiKey: string,
    modelId: string,
    imageData: string,
    options?: Record<string, unknown>
  ): Promise<TextStreamResult> {
    const openrouter = this.getOpenRouter(apiKey);
    const model = openrouter(modelId);
    const imageContent = await processImageData(imageData);

    return aiStreamText({
      model,
      messages: [
        {
          role: "user",
          content: [
            imageContent,
            {
              type: "text",
              text: "Describe this image in detail. If there is any text in the image, read and include that text as well.",
            },
          ],
        },
      ],
      ...options,
    });
  }
}
