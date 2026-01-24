type ChatRole = "user" | "assistant" | "execution";
type ChatType =
  | "stream"
  | "general"
  | "log"
  | "plan"
  | "user"
  | "source"
  | "search-status"
  | "cancelled"
  | "terminal-confirmation";

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

// Adaptive terminal executor types for loop-based command execution
interface AdaptiveExecutorConfig {
  maxIterations: number; // Maximum loop iterations (default: 10)
  maxConsecutiveErrors: number; // Stop after this many consecutive errors (default: 2)
}

interface AdaptiveExecutorCommand {
  command: string;
  output: string;
  success: boolean;
}

interface AdaptiveExecutorResult {
  success: boolean;
  output: string; // Summary or final context
  iterations: number;
  commands: AdaptiveExecutorCommand[];
  finalCwd: string;
  failureReason?: string;
}
interface StreamChunk {
  chunk: string;
  type: ChatType;
  sessionId?: string;
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

// Vision types
type VisionLogType =
  | "server"
  | "llm-request"
  | "llm-response"
  | "thinking"
  | "status"
  | "vision-status"
  | "error"
  | "image-preview";

type VisionSessionStatus = "running" | "completed" | "failed" | "cancelled";

interface VisionSessionRecord {
  id: string;
  goal: string;
  createdAt: number;
  updatedAt: number;
  status: VisionSessionStatus;
}

interface VisionLogRecord {
  id: string;
  sessionId: string;
  type: VisionLogType;
  title: string;
  content: string;
  imagePath: string | null;
  timestamp: number;
}

interface VisionSessionWithLogs extends VisionSessionRecord {
  logs: VisionLogRecord[];
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
  AdaptiveExecutorCommand,
  AdaptiveExecutorConfig,
  AdaptiveExecutorResult,
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
  VisionLogType,
  VisionSessionStatus,
  VisionSessionRecord,
  VisionLogRecord,
  VisionSessionWithLogs,
};
