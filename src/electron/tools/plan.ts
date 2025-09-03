import { groq } from "../services/groq.js";
import { generalTool } from "./general/index.js";
import { terminalAgent } from "./terminal/index.js";
import { youtubeTool } from "./youtube/index.js";
import { MakePlanResponse } from "../common/types.js";

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

const PROMPT_MAKE_PLAN = (userPrompt: string) => `
# Task Planning Assistant (Modular Agent Approach)

## User Request
${userPrompt}

## Available Agents
You can orchestrate the following autonomous agents:

${Object.values(tools)
  .map((agent) => `${agent.name}: ${agent.desc}`)
  .join("\n\n")}

## Planning Directives
- Use tool-level steps only. 
- Provide ONLY a short step description (what to do).
- Keep the plan minimal and outcome-oriented. 
- The terminal_tool is now an intelligent agent that can handle complex multi-step operations autonomously, so you can assign it broad goals rather than individual commands.
- Do not give entire description of what to do each step the plan is passed through router and the router handles all the little things.

## Examples

Example 1: Save time to file in desktop folder
Steps:
1. terminal_tool: get current timestamp and save it to a file in desktop folder (todo)
2. general_tool: provide final response about task completion (todo)

Example 2: Convert all Python files to JavaScript
Steps:
1. terminal_tool: find all Python files in Documents folder and convert them to JavaScript format (todo)
2. general_tool: provide final response about conversion results (todo)

Example 3: YouTube analysis to file
Steps:
1. youtube_tool: analyze provided video screenshot and extract video details and summary (todo)
2. terminal_tool: save the video analysis results to a file in Documents folder (todo)
3. general_tool: provide final response about task completion (todo)

Example 4: How many moons does Saturn have
Steps:
1. general_tool: answer question about number of moons of Saturn (todo)


at the last step always call the general_tool to give the final response to the user
`;

export const getPlan = async (userInput: string): Promise<{ steps: MakePlanResponse[] }> => {
  try {
    if (!userInput) {
      throw new Error("User input is required");
    }
    const options = {
      temperature: 0.6,
      max_completion_tokens: 8192,
      messages: [
        {
          role: "user",
          content: PROMPT_MAKE_PLAN(userInput),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
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
                      description: "Clear description of what this step should accomplish",
                    },
                    status: {
                      type: "string",
                      enum: ["todo", "done"],
                      description: "The status of the step",
                    },
                  },
                  required: ["step_number", "tool_name", "description", "status"],
                  additionalProperties: false,
                },
              },
            },
            required: ["steps"],
            additionalProperties: false,
          },
        },
      },
      stream: false,
    };
    const content = await groq.chat("moonshotai/kimi-k2-instruct", options);
    if (!content) {
      throw new Error("No response content received from Groq");
    }
    const planData: {
      steps: MakePlanResponse[];
    } = JSON.parse(content);
    return { steps: planData.steps };
  } catch (error) {
    console.log(error);
    return { steps: [] };
  }
};
