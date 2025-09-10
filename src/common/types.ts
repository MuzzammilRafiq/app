import type { Labels } from "./constants";

interface MakePlanResponse {
  step_number: number;
  tool_name: string;
  description: string;
  status: Labels.TODO | Labels.DONE;
}
interface StreamChunk {
  chunk: string;
  type: Labels.STREAM | Labels.LOG | Labels.PLAN | Labels.SOURCE;
}
interface VideoDetails {
  title: string;
  description: string;
  publishedAt: string;
  channelTitle: string;
  channelId: string;
  videoId: string;
  thumbnail: string;
  duration: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
}
interface VideoParams {
  videoId: string;
  parts?: string[];
}
interface VideoInfoResult {
  videotitle: string;
  channelname: string;
  generate_summary: boolean;
}

type ChatRole = "user" | "assistant" | "execution";
type ChatType = "stream" | "log" | "plan" | "user";

interface ChatMessageRecord {
  id: string;
  sessionId: string;
  content: string;
  role: ChatRole;
  timestamp: number;
  isError: string;
  imagePaths: string[] | null; // path to images
  type: ChatType;
}

interface ChatSessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatSessionWithMessages extends ChatSessionRecord {
  messages: ChatMessageRecord[];
}
export type {
  ChatMessageRecord,
  ChatRole,
  ChatSessionRecord,
  ChatType,
  MakePlanResponse,
  StreamChunk,
  VideoDetails,
  VideoParams,
  VideoInfoResult,
  ChatSessionWithMessages,
};
