import { OpenRouter } from "@openrouter/sdk";
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export const ASK_TEXT = async function* (
  apiKey: string,
  messages: ChatMessage[],
  options?: Record<string, unknown>,
) {
  const openrouter = new OpenRouter({ apiKey });

  const { stream: _ignored, provider: __ignored, ...opts } = options ?? {};
  const stream = await openrouter.chat.send({
    model: "moonshotai/kimi-k2-thinking",
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
  messages: ChatMessage[],
  options?: Record<string, unknown>,
) {
  const openrouter = new OpenRouter({ apiKey });
  const { stream: _ignored, provider: __ignored, ...opts } = options ?? {};
  const stream = await openrouter.chat.send({
    model: "qwen/qwen3-vl-30b-a3b-thinking",
    messages,
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
