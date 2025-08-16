import { groq } from "../services/groq.js";
import { generalTool } from "./general/index.js";
import { makePlanTool } from "./plan/index.js";
import { terminalTool } from "./terminal/index.js";
import { youtubeTool } from "./youtube/index.js";

export const tools = {
  fileAgent: {
    name: "terminal_tool",
    desc: "this agent can execute terminal commands",
    function: terminalTool,
  },
  youtubeAgent: {
    name: "youtube_tool",
    desc: "this agent can get the details of a youtube video by providing the video info extracted from screenshot of youtube video",
    function: youtubeTool,
  },
  plan_tool: {
    name: "plan_tool",
    desc: "this tool is used when the original a step of the original plan is complex and u need to break it down into smaller steps and execute them one by one and get the final result to the original plan and return it to the original plan eg convert all py file to js in a folder",
    function: makePlanTool,
  },
  general_tool: {
    name: "general_tool",
    desc: "this is a general tool this is used when u need to do something and not require tool or need to do simple llm query",
    function: generalTool,
  },
};

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
- Do not give entire description of what to do each step the plan is passed through router and the router handles all the little things.

## Examples

Example 1: Save time to file in desktop folder
Steps:
1. terminal_agent: retrieve current local timestamp  (todo)
2. file_agent: write the retrieved time in the desktop folder (todo)

Example 2: YouTube analysis to file
Steps:
1. youtube_agent: provided video screenshot info; produce video details and summary (todo)
2. file_agent: save the video details in Documents folder (todo)

Example 3: How many moons saturn have
Steps:
1. general_tool: question about number of moons of Saturn (todo)

`;

export interface MakePlanResponse {
  stepNumber: number;
  agentName: string;
  description: string;
  status: "todo" | "done";
}

export const getDoorResponse = async (userInput: string): Promise<{ steps: MakePlanResponse[]; context: string }> => {
  try {
    if (!userInput) {
      throw new Error("User input is required");
    }
    const prompt = PROMPT_MAKE_PLAN(userInput);
    const options = {
      temperature: 0.6,
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
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
                    stepNumber: {
                      type: "number",
                      description: "Sequential step number starting from 1",
                    },
                    agentName: {
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
                  required: ["stepNumber", "agentName", "description", "status"],
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
    return { steps: planData.steps, context: userInput };
  } catch (error) {
    console.log(error);
    return { steps: [], context: userInput };
  }
};

if (require.main === module) {
  getDoorResponse(
    "convert the python fizzbuzz file in Documents folder to javascript and then save the file to each folder present in Desktop folder override if present"
  ).then((response) => {
    console.log(response.steps);
  });
}
