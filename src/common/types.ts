type ChatRole = "user" | "assistant" | "execution";
type ChatType = "stream" | "log" | "plan" | "user";

interface MakePlanResponse {
  step_number: number;
  tool_name: string;
  description: string;
  status: "todo" | "done";
}
interface StreamChunk {
  chunk: string;
  type: ChatType;
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
interface SearchResult {
  ids: string[][];
  embeddings: null | number[][];
  documents: string[][];
  uris: null | string[][];
  included: string[];
  data: null | unknown;
  metadatas: {
    index: number;
    path: string;
  }[][];
  distances: null | unknown;
}
interface UniqueResult {
  id: string;
  document: string;
  metadata: {
    path: string;
    index: number;
  };
}
interface StreamMessageConfig {
  rag?: boolean;
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
  SearchResult,
  UniqueResult,
  StreamMessageConfig,
};
