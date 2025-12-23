import { generalTool } from "./general/index.js";
import { terminalAgent } from "./terminal/index.js";
import { youtubeTool } from "./youtube/index.js";
import { ChatMessageRecord, MakePlanResponse } from "../../common/types.js";
import { ChatMessage, ASK_TEXT } from "../services/llm.js";

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
# Task Planning Assistant (Modular Agent Approach)

## Context Analysis
Before creating a plan, analyze:
- Current user request and its requirements
- Previous conversation history for context, dependencies, and state
- Any incomplete tasks, follow-ups, or referenced items from earlier messages
- Files, data, or outputs that may have been created in previous steps
- User preferences or constraints mentioned earlier in the conversation

## Available Agents
You can orchestrate the following autonomous agents:
${Object.values(tools)
  .map((agent) => `${agent.name}: ${agent.desc}`)
  .join("\n\n")}

## Planning Directives
- Use tool-level steps only
- Provide ONLY a short step description (what to do)
- Keep the plan minimal and outcome-oriented
- Consider conversation history when determining dependencies and prerequisites
- If the current request builds on previous work, reference or utilize existing outputs
- If previous tasks are incomplete, factor that into the current plan
- The terminal_tool is now an intelligent agent that can handle complex multi-step operations autonomously, so you can assign it broad goals rather than individual commands
- Do not give entire description of what to do each step - the plan is passed through router and the router handles all the details

## History-Aware Planning
- **Continuation Tasks**: If this request continues a previous task, build upon existing work
- **Reference Previous Outputs**: Use files, data, or results created in earlier conversation turns
- **State Awareness**: Consider the current state of the system/files based on previous actions
- **Context Dependencies**: Account for user preferences, constraints, or requirements mentioned earlier
- **Follow-up Actions**: If previous messages indicated next steps, incorporate them appropriately

## Examples

Example 1: Save time to file in desktop folder
Steps:
1. terminal_tool: get current timestamp and save it to a file in desktop folder (todo)
2. general_tool: provide final response about task completion (todo)

Example 2: Convert all Python files to JavaScript (with history context)
Previous context: User mentioned they prefer ES6 syntax and have a specific project structure
Steps:
1. terminal_tool: find all Python files in Documents folder and convert them to JavaScript using ES6 syntax, maintaining existing project structure (todo)
2. general_tool: provide final response about conversion results (todo)

Example 3: YouTube analysis to file (building on previous analysis)
Previous context: User previously analyzed a different video and wanted comparison
Steps:
1. youtube_tool: analyze provided video screenshot and extract video details and summary (todo)
2. terminal_tool: save the video analysis results to a file and compare with previous analysis if exists (todo)
3. general_tool: provide final response about task completion and comparison results (todo)

Example 4: Follow-up question after previous research
Previous context: User asked about Saturn's moons yesterday, now asking for more details
Steps:
1. general_tool: provide detailed information about Saturn's moons, building on previous discussion context (todo)

**Always call the general_tool as the final step to give the final response to the user**
`;

export const getPlan = async (
  event: any,
  messages: ChatMessageRecord[],
  apiKey: string
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
          schema: {
            type: "object",
            properties: {
              steps: {
                type: "array",
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
    const planData: {
      steps: MakePlanResponse[];
    } = JSON.parse(c);
    return { steps: planData.steps };
  } catch (error) {
    console.log(error);
    return { steps: [] };
  }
};
