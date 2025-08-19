export interface MakePlanResponse {
  step_number: number;
  tool_name: string;
  description: string;
  status: "todo" | "done";
}
export interface StreamChunk {
  chunk: string;
  type: "stream" | "log" | "plan";
}
