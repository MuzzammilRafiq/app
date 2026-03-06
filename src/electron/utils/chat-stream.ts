import type { IpcMainInvokeEvent, WebContents } from "electron";
import type { ChatType } from "../../common/types.js";

export interface ChatStreamContext {
  sessionId: string;
  requestId: string;
}

export type ChatStreamEvent = IpcMainInvokeEvent & Partial<ChatStreamContext>;

export function getChatStreamContext(
  value: Partial<ChatStreamContext>,
): ChatStreamContext {
  const { sessionId, requestId } = value;

  if (!sessionId || !requestId) {
    throw new Error("Missing chat stream context");
  }

  return { sessionId, requestId };
}

export function getChatStreamContextFromEvent(
  event: ChatStreamEvent,
): ChatStreamContext {
  return getChatStreamContext({
    sessionId: event.sessionId,
    requestId: event.requestId,
  });
}

export function sendChatChunk(
  sender: WebContents,
  context: ChatStreamContext,
  chunk: string,
  type: ChatType,
): void {
  sender.send("stream-chunk", {
    chunk,
    type,
    sessionId: context.sessionId,
    requestId: context.requestId,
  });
}