import Groq from "groq-sdk";

export const agents = {
  fileAgent: {
    name: "file_agent",
    desc: "this agent can readFile,writeFile,listDirectory,createDirectory,deleteFileOrDirectory,getFileInfo,checkExists, searchFiles this agent is called multiple times of iteration itself",
  },
  timeAgent: {
    name: "time_agent",
    desc: "this agent return current date time eg:Tuesday, August 12, 2025 at 08:51:57 PM India Standard Time",
  },
  youtubeAgent: {
    name: "youtube_agent",
    desc: "this agent can get the details of a youtube video by providing the video info extracted from screenshot of youtube video",
  },
  notoolAgent: {
    name: "notool_agent",
    desc: "this agent is called when no tool is needed to be called",
  },
};


export const doorPrompt = (userPrompt: string) => `
# Task Planning Assistant (Modular Agent Approach)

## User Request
${userPrompt}

## Available Agents
You can orchestrate the following autonomous agents:

${Object.values(agents).map((agent) => `${agent.name}: ${agent.desc}`).join("\n\n")}

## Planning Directives
- Use agent-level steps only. Do NOT prescribe internal actions.
- Provide ONLY a short step description (what to do). Do not include the literal text "context:".
- Do NOT specify the same agent consecutively; consolidate responsibilities.
- Keep the plan minimal and outcome-oriented. Use inter-agent handoffs only when necessary.
- Agents internally handle sequencing, retries on failures, and verification.

## Examples

Example 1: Save time to file
Steps:
1. time_agent: retrieve current local timestamp
2. file_agent: write the retrieved time in the desktop folder

Example 2: YouTube analysis to file
Steps:
1. youtube_agent: provided video screenshot info; produce video details and summary
2. file_agent: save the video details in Documents folder

Example 3: How many moons saturn have
Steps:
1. notool_agent: question about number of moons of Saturn


`;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface DoorPlanStep {
  stepNumber: number;
  agentName: string;
  description: string;
}

export interface DoorPlan {
  steps: DoorPlanStep[];
}

// JSON Schema for structured output

function parseDoorPlan(planData: DoorPlan): DoorPlanStep[] {
  return planData.steps || [];
}

async function getDoorResponse(userInput: string): Promise<DoorPlanStep[]> {
  try {
    if (!userInput) {
      throw new Error("User input is required");
    }
    const prompt = doorPrompt(userInput);
    const response = await groq.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
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
                  },
                  required: ["stepNumber", "agentName", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["steps"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No response content received from Groq");
    }
    const planData: DoorPlan = JSON.parse(content);
    return planData.steps;
  } catch (error) {
    console.log(error);
    return [];
  }
}

if (require.main === module) {
  getDoorResponse("save current time in a txt file on my desktop").then((response) => {
    console.log(response);
  });
}