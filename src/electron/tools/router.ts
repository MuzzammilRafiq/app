import { groq } from "../services/groq.js";
import { agents, type MakePlanResponse } from "./make_plan.js";

const MAX_ITERATIONS = 10;
const DONE = "DONE";
const PROMPT_ROUTE_AGENT = (plan: string, context: any) => `
You are an intelligent agent router. Your task is to analyze the current plan and determine which agent should execute the next step.

## Current Plan
${plan}

## Original User Context
${context}

## Instructions
- Look at the plan above and identify the next step that has status "todo" (not "done")
- Provide relevant context that will help the agent understand what needs to be done
- The relevant context should include:
  - What the user originally requested
  - What has been accomplished so far (from "done" steps)
  - What specifically this agent needs to do for this step
  - Any important details from previous steps that this agent might need

## Response Format
Return a JSON object with:
- "relevant_context": a clear description of what this agent needs to do and any context it needs to know

Example:
{
  "relevant_context": "User wants to save current time to desktop. Time has been retrieved as '2024-01-15 14:30:00'. Now create a txt file on desktop containing this timestamp."
}
`;
const PROMPT_FINAN_RESPONSE = (plan: string, context: string) => `
You are tasked with creating a final response for the user based on the completed plan and their original request.

## Completed Plan
${plan}

## Original User Request
${context}

## Instructions
Create a well-formatted markdown response that:

1. **If the user asked to DO something** (save file, create something, etc.):
   - Provide clear confirmation that the task was completed
   - Mention what was accomplished
   - Include any relevant details (file location, etc.)

2. **If the user asked for INFORMATION** (get time, analyze video, etc.):
   - Provide the requested information clearly
   - Present it in a readable format

3. **Always include a plan summary** in this format:
   <plan>
   Step 1: [Brief 1-2 sentence description of what was done]
   Step 2: [Brief 1-2 sentence description of what was done]
   ...
   </plan>

## Response Format
- Use markdown formatting for readability
- Keep it concise but informative
- Be conversational and helpful
- Don't over-format with excessive markdown

## Example Response for "save current time to desktop":
✅ **Task Completed Successfully**

I've saved the current time to your desktop as requested.

**Details:**
- Current time: Tuesday, January 15, 2024 at 2:30:45 PM
- File saved: /Users/username/Desktop/current_time.txt

<plan>
Step 1: Retrieved the current local timestamp
Step 2: Created a text file on the desktop containing the timestamp
</plan>

## Example Response for "how many moons does Saturn have":
**Saturn's Moons**

Saturn has **146 confirmed moons**. This includes its largest moon Titan, which is larger than Mercury, and Enceladus, known for its subsurface ocean.

<plan>
Step 1: Provided information about Saturn's moon count based on current astronomical data
</plan>
`;

const getRelevantContext = async (plan: string, context: any): Promise<string> => {
  if (!plan || !context) {
    throw new Error("Plan and context are required");
  }

  const prompt = PROMPT_ROUTE_AGENT(plan, context);
  const options = {
    temperature: 0.6,
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "routeAgent",
        schema: {
          type: "object",
          properties: {
            // Optional: allow model to include which agent it thinks is next, but we only require context
            agent: { type: "string" },
            relevant_context: { type: "string" },
          },
          required: ["relevant_context"],
          additionalProperties: false,
        },
      },
    },
  };
  const content = await groq.chat("moonshotai/kimi-k2-instruct", options);
  if (!content) {
    throw new Error("No response content received from router");
  }
  const { relevant_context }: { relevant_context: string } = JSON.parse(content);

  return relevant_context;
};

const planToXML = (plan: MakePlanResponse[]): string => {
  let xml = "<plan>\n";
  for (const step of plan) {
    const s = `No. ${step.stepNumber} agent: ${step.agentName} description: ${step.description} status: ${step.status}`;
    xml += `<step>${s}</step>`;
  }
  xml += "\n</plan>";
  return xml;
};

const getFinanResponse = async (plan: MakePlanResponse[], context: string): Promise<string> => {
  const prompt = PROMPT_FINAN_RESPONSE(planToXML(plan), context);
  const options = {
    temperature: 0.6,
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  };
  const content = await groq.chat("moonshotai/kimi-k2-instruct", options);
  if (!content) {
    throw new Error("No response content received from summariser");
  }
  return content;
};

export const router = async (plan: MakePlanResponse[], context: any) => {
  try {
    if (!plan || !context) {
      throw new Error("Plan and context are required");
    }

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Find the next step that is still marked as todo
      const nextStep = plan.find((step) => step.status === "todo");
      if (!nextStep) {
        break; // All steps are completed
      }

      const relevant_context = await getRelevantContext(planToXML(plan), context);

      // Resolve the agent function by matching the declared agent name
      const agentEntry = Object.values(agents).find((agent) => agent.name === nextStep.agentName);
      if (!agentEntry) {
        throw new Error(`Unknown agent: ${nextStep.agentName}`);
      }

      const result = await agentEntry.function(relevant_context);

      // Update the current step status and description with the result
      nextStep.status = "done";
      nextStep.description = result;

      if (result === DONE) {
        break;
      }
    }
    const finanResponse = await getFinanResponse(plan, context);
    return finanResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
};
