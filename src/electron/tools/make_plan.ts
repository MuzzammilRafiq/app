import { groq } from "../services/groq.js";
import { masterFileTool } from "./file/index.js";
import { getCurrentDateTime } from "./time/index.js";
import { getYoutubeVideoDetailsByVideoInfo } from "./youtube/index.js";

export const agents: Record<string, { name: string; desc: string; function: (context: string) => Promise<string> }> = {
  fileAgent: {
    name: "file_agent",
    desc: "this agent can readFile,writeFile,listDirectory,createDirectory,deleteFileOrDirectory,getFileInfo,checkExists, searchFiles this agent is called multiple times of iteration itself",
    function: masterFileTool,
  },
  timeAgent: {
    name: "time_agent",
    desc: "this agent return current date time eg:Tuesday, August 12, 2025 at 08:51:57 PM India Standard Time",
    function: getCurrentDateTime,
  },
  youtubeAgent: {
    name: "youtube_agent",
    desc: "this agent can get the details of a youtube video by providing the video info extracted from screenshot of youtube video",
    function: getYoutubeVideoDetailsByVideoInfo,
  },
  notoolAgent: {
    name: "notool_agent",
    desc: "this agent is called when no tool is needed to be called",
    function: (context: string) => Promise.resolve("no tool is needed to be called"),
  },
};

const PROMPT_MAKE_PLAN = (userPrompt: string) => `
# Task Planning Assistant (Modular Agent Approach)

## User Request
${userPrompt}

## Available Agents
You can orchestrate the following autonomous agents:

${Object.values(agents)
  .map((agent) => `${agent.name}: ${agent.desc}`)
  .join("\n\n")}

## Planning Directives
- Use agent-level steps only. Do NOT prescribe internal actions.
- Provide ONLY a short step description (what to do). Do not include the literal text "context:".
- Do NOT specify the same agent consecutively; consolidate responsibilities.
- Keep the plan minimal and outcome-oriented. Use inter-agent handoffs only when necessary.
- Agents internally handle sequencing, retries on failures, and verification.

## Examples

Example 1: Save time to file
Steps:
1. time_agent: retrieve current local timestamp (todo)
2. file_agent: write the retrieved time in the desktop folder (todo)

Example 2: YouTube analysis to file
Steps:
1. youtube_agent: provided video screenshot info; produce video details and summary (todo)
2. file_agent: save the video details in Documents folder (todo)

Example 3: How many moons saturn have
Steps:
1. notool_agent: question about number of moons of Saturn


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
                      enum: Object.values(agents).map((agent) => agent.name),
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

// if (require.main === module) {
//   getDoorResponse("save current time in a txt file on my desktop").then((response) => {
//     console.log(response.steps);
//   });
// }
