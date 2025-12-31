type ChatRole = "user" | "assistant" | "execution";
type ChatType = "stream" | "log" | "plan" | "user" | "source";

interface MakePlanResponse {
  step_number: number;
  tool_name: string;
  description: string;
  status: "todo" | "done";
}

// Orchestrator types for the new agent architecture
type AgentType = "terminal" | "general"; // Extensible for future agents

interface OrchestratorStep {
  step_number: number;
  agent: AgentType;
  action: string; // Command for terminal, task description for general
  status: "pending" | "running" | "done" | "failed";
  result?: string;
}

interface OrchestratorContext {
  goal: string;
  cwd: string;
  currentStep: number;
  steps: OrchestratorStep[];
  history: Array<{ step: number; command: string; output: string }>;
  done: boolean;
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
interface OpenRouterModel {
  id: string;
  name: string;
  input_modalities: string[];
  output_modalities: string[];
  supported_parameters: string[];
}

export type {
  AgentType,
  ChatMessageRecord,
  ChatRole,
  ChatSessionRecord,
  ChatType,
  MakePlanResponse,
  OrchestratorContext,
  OrchestratorStep,
  StreamChunk,
  VideoDetails,
  VideoParams,
  VideoInfoResult,
  ChatSessionWithMessages,
  SearchResult,
  UniqueResult,
  StreamMessageConfig,
  OpenRouterModel,
};
