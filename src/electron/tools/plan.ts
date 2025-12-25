import { generalTool } from "./general/index.js";
import { terminalAgent } from "./terminal/index.js";
import { youtubeTool } from "./youtube/index.js";
import { ChatMessageRecord, MakePlanResponse } from "../../common/types.js";
import { type ChatMessage, ASK_TEXT } from "../services/llm.js";
import { LOG, JSON_PRINT } from "../utils/logging.js";
const TAG = "plan";
export const tools = {
  terminal_tool: {
    name: "terminal_tool",
    desc: "this is an intelligent terminal agent that can execute complex multi-step terminal operations autonomously. It breaks down complex goals into sequential commands, handles failures gracefully with adaptive retry logic, and maintains execution context across multiple iterations. Features security checks, command validation, and can achieve goals like file conversions, system operations, data processing, and file management. Defaults to ~/Documents folder if no path specified. perform calculations,give date time",
    function: terminalAgent,
  },
  youtube_tool: {
    name: "youtube_tool",
    desc: "this agent can get the details of a youtube video by providing the video info extracted from screenshot of youtube video",
    function: youtubeTool,
  },
  general_tool: {
    name: "general_tool",
    desc: "this is used when u need to do simple llm query it does not have any tool to call its usally used to give final formatted markdown response  to the user based on the plan and the results of the tools",
    function: generalTool,
  },
} as const;

// TODO: add agent responses also in the context history
const SYSTEM_PROMPT_MAKE_PLAN = `
Task Planning (Modular Agents)

Context:
- Consider current request, history, incomplete tasks, prior outputs, user constraints

Agents:
${Object.values(tools)
  .map((agent) => `${agent.name}: ${agent.desc}`)
  .join("\n\n")}

Rules:
- Output JSON only; match the provided schema strictly
- Create 1–5 tool-level steps; outcome-focused
- Start step_number at 1 and increment by 1 (no gaps)
- Use tool_name only from the listed agents
- Keep description short (≤15 words), no low-level commands
- Set status to "todo" for all steps
- Always end with a general_tool step for the final user response
- If greeting/unclear, return a single general_tool step

History Awareness:
- Build on previous work, reuse prior outputs, respect current state and user prefs

Examples
1) Save time to file
Steps:
1. terminal_tool: write current timestamp to Desktop file (todo)
2. general_tool: report completion (todo)

2) Convert Python to JS (ES6)
Steps:
1. terminal_tool: convert all .py in Documents to ES6 JS, keep structure (todo)
2. general_tool: summarize results (todo)

3) YouTube analysis + compare
Steps:
1. youtube_tool: extract details from provided screenshot (todo)
2. terminal_tool: save results and compare with previous if exists (todo)
3. general_tool: deliver comparison (todo)
`;

export const getPlan = async (
  event: any,
  messages: ChatMessageRecord[],
  apiKey: string,
): Promise<{ steps: MakePlanResponse[] }> => {
  try {
    const userInput: ChatMessage[] = messages.map((msg) => {
      return {
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      };
    });
    const M = [
      {
        role: "system",
        content: SYSTEM_PROMPT_MAKE_PLAN,
      } as ChatMessage,
      ...userInput,
    ];
    const options = {
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              steps: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    step_number: {
                      type: "number",
                      description: "Sequential step number starting from 1",
                    },
                    tool_name: {
                      type: "string",
                      enum: Object.values(tools).map((tool) => tool.name),
                      description: "The agent responsible for this step",
                    },
                    description: {
                      type: "string",
                      description:
                        "Clear description of what this step should accomplish",
                    },
                    status: {
                      type: "string",
                      enum: ["todo", "done"],
                      description: "The status of the step",
                    },
                  },
                  required: [
                    "step_number",
                    "tool_name",
                    "description",
                    "status",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["steps"],
            additionalProperties: false,
          },
        },
      },
    };
    const response = ASK_TEXT(apiKey, M, options);
    if (!response) {
      throw new Error("No response content received from LLM");
    }
    let c = "";
    for await (const { content, reasoning } of response) {
      if (content) {
        c += content;
      }
      if (reasoning) {
        event.sender.send("stream-chunk", {
          chunk: reasoning,
          type: "log",
        });
      }
    }
    LOG(TAG).INFO(JSON_PRINT(JSON.parse(c)));
    LOG(TAG).INFO(JSON_PRINT(messages));
    const planData: {
      steps: MakePlanResponse[];
    } = JSON.parse(c);
    if (!planData.steps || planData.steps.length === 0) {
      const fallback: MakePlanResponse = {
        step_number: 1,
        tool_name: "general_tool",
        description:
          "Respond to the user's message and ask what goal they want to achieve",
        status: "todo",
      };
      return { steps: [fallback] };
    }
    return { steps: planData.steps };
  } catch (error) {
    console.log(error);
    return { steps: [] };
  }
};
