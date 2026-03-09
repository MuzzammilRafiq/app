import { randomUUID } from "node:crypto";
import type {
  MeetChatMessageRecord,
  MeetChatProcessConfig,
  MeetChatProcessRequest,
  MeetChatProcessResult,
} from "../../common/types.js";
import { buildMeetChatSystemPrompt, MEET_CHAT_WAKE_WORD } from "../prompts/meet-chat.js";
import dbService from "./database.js";
import { ASK_TEXT, type ChatMessage } from "./model.js";
import { LOG } from "../utils/logging.js";

const TAG = "meet-chat";
const DEFAULT_MODEL = "moonshotai/kimi-k2-0905";
const activeRuns = new Set<string>();
const REQUEST_START_PATTERN =
  /^(what|why|how|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|will|please|explain|summarize|tell|describe|define|clarify|repeat|help|give|list|find|mean|translate)\b/i;
const REQUEST_PHRASE_PATTERN =
  /\b(can you|could you|would you|what does|what is|how do|tell me|help me|explain|summarize|clarify|define|translate|walk me through)\b/i;

function normalizeSegment(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitCompletedText(text: string): string[] {
  const normalized = normalizeSegment(text);
  if (!normalized) {
    return [];
  }

  const segments = normalized.match(/[^.!?\n]+[.!?\n]*/g);
  if (!segments) {
    return [normalized];
  }

  return segments.map((segment) => normalizeSegment(segment)).filter(Boolean);
}

function looksLikeRequest(text: string): boolean {
  const normalized = normalizeSegment(text);
  if (!normalized) {
    return false;
  }

  const tokenCount = normalized.split(/\s+/).length;
  if (tokenCount < 2) {
    return false;
  }

  return (
    normalized.includes("?") ||
    REQUEST_START_PATTERN.test(normalized) ||
    REQUEST_PHRASE_PATTERN.test(normalized)
  );
}

function extractWakeWordQueryFromSegment(
  segment: string,
  wakeWord: string,
): string | null {
  const normalized = normalizeSegment(segment);
  if (!normalized) {
    return null;
  }

  const wakeWordPattern = wakeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const leadingPattern = new RegExp(
    `^${wakeWordPattern}(?:\\s*[:,\\-])?\\s+(.+)$`,
    "i",
  );
  const trailingPattern = new RegExp(
    `^(.+?)\\s*,?\\s*${wakeWordPattern}[.!?]*$`,
    "i",
  );

  const leadingMatch = normalized.match(leadingPattern);
  if (leadingMatch && looksLikeRequest(leadingMatch[1] ?? "")) {
    return normalized;
  }

  const trailingMatch = normalized.match(trailingPattern);
  if (trailingMatch && looksLikeRequest(trailingMatch[1] ?? "")) {
    return normalized;
  }

  return null;
}

function extractWakeWordQuery(
  text: string,
  wakeWord: string = MEET_CHAT_WAKE_WORD,
): string | null {
  const segments = splitCompletedText(text);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const query = extractWakeWordQueryFromSegment(segments[index] ?? "", wakeWord);
    if (query) {
      return query;
    }
  }

  return null;
}

async function collectTextResponse(
  apiKey: string,
  messages: ChatMessage[],
  overrideModel: string,
): Promise<string> {
  let output = "";

  for await (const chunk of ASK_TEXT(apiKey, messages, {
    overrideModel,
  })) {
    if (chunk.content) {
      output += chunk.content;
    }
  }

  return output.trim();
}

async function runMeetChatModel(
  apiKey: string,
  request: MeetChatProcessRequest,
  query: string,
  modelId: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildMeetChatSystemPrompt(),
    },
    {
      role: "user",
      content: [
        `Wake-word query: ${query}`,
        "",
        "Full finalized transcript so far:",
        request.transcriptText,
      ].join("\n"),
    },
  ];

  return collectTextResponse(apiKey, messages, modelId);
}

export async function processMeetChatTranscript(
  apiKey: string,
  request: MeetChatProcessRequest,
  config: MeetChatProcessConfig = {},
): Promise<MeetChatProcessResult> {
  if (!apiKey.trim()) {
    throw new Error("OpenRouter API key is required for Meet Chat.");
  }
  if (!request.transcriptionRunId.trim()) {
    throw new Error("transcriptionRunId is required");
  }
  if (!request.transcriptText.trim()) {
    throw new Error("transcriptText is required");
  }

  const session = dbService.ensureMeetChatSession(request.transcriptionRunId);
  const existingSession = dbService.getMeetChatSessionWithMessagesByTranscriptionRunId(
    request.transcriptionRunId,
  );
  if (!existingSession) {
    throw new Error("Failed to load Meet Chat session");
  }

  if (activeRuns.has(request.transcriptionRunId)) {
    return {
      session: existingSession,
      queryMessage: null,
      responseMessage: null,
    };
  }

  activeRuns.add(request.transcriptionRunId);

  try {
    const processedAt = Date.now();
    const query = extractWakeWordQuery(request.newText);

    if (!query) {
      dbService.updateMeetChatSessionState(session.id, {
        status: "idle",
        lastProcessedAt: processedAt,
        lastProcessedTranscriptLength: request.transcriptText.length,
        lastError: "",
        updatedAt: processedAt,
      });

      return {
        session:
          dbService.getMeetChatSessionWithMessagesByTranscriptionRunId(
            request.transcriptionRunId,
          ) ?? existingSession,
        queryMessage: null,
        responseMessage: null,
      };
    }

    dbService.updateMeetChatSessionState(session.id, {
      status: "processing",
      lastProcessedAt: processedAt,
      lastProcessedTranscriptLength: request.transcriptText.length,
      lastQuery: query,
      lastError: "",
      updatedAt: processedAt,
    });

    const queryMessage: MeetChatMessageRecord = {
      id: randomUUID(),
      sessionId: session.id,
      type: "query",
      content: query,
      timestamp: processedAt,
    };
    dbService.addMeetChatMessage(queryMessage);

    const model = config.model?.trim() || DEFAULT_MODEL;
    const responseText = await runMeetChatModel(apiKey, request, query, model);
    const responseTimestamp = Date.now();
    const responseMessage: MeetChatMessageRecord = {
      id: randomUUID(),
      sessionId: session.id,
      type: "response",
      content: responseText || "I could not produce a useful answer from the finalized transcript.",
      timestamp: responseTimestamp,
    };

    dbService.addMeetChatMessage(responseMessage);
    dbService.updateMeetChatSessionState(session.id, {
      status: "responded",
      lastProcessedAt: responseTimestamp,
      lastProcessedTranscriptLength: request.transcriptText.length,
      lastQuery: query,
      lastError: "",
      updatedAt: responseTimestamp,
    });

    return {
      session:
        dbService.getMeetChatSessionWithMessagesByTranscriptionRunId(
          request.transcriptionRunId,
        ) ?? existingSession,
      queryMessage,
      responseMessage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meet Chat failed";
    dbService.updateMeetChatSessionState(session.id, {
      status: "error",
      lastError: message,
      updatedAt: Date.now(),
    });
    LOG(TAG).ERROR(`Meet Chat failed: ${message}`);
    throw new Error(message);
  } finally {
    activeRuns.delete(request.transcriptionRunId);
  }
}