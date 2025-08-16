import { groq } from "../services/groq.js";
import { tools, type MakePlanResponse } from "./plan.js";

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
    const s = `No. ${step.step_number} tool: ${step.tool_name} description: ${step.description} status: ${step.status}`;
    xml += `<step>${s}</step>`;
  }
  xml += "\n</plan>";
  return xml;
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
      const agentEntry = Object.values(tools).find((tool) => tool.name === nextStep.tool_name);
      if (!agentEntry) {
        throw new Error(`Unknown agent: ${nextStep.tool_name}`);
      }

      const result = await agentEntry.function(relevant_context);

      // Update the current step status and description with the result
      nextStep.status = "done";
      nextStep.description = result.output;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};
