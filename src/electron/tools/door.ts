import Groq from "groq-sdk";

export const toolAgents = {
  fileAgent:
    "file_agent: this agent can readFile,writeFile,listDirectory,createDirectory,deleteFileOrDirectory,getFileInfo,checkExists, searchFiles this agent is called multiple times of iteration itself",
  timeAgent:
    "time_agent: this agent return current date time eg:Tuesday, August 12, 2025 at 08:51:57 PM India Standard Time",
  youtubeAgent:
    "youtube_agent: this agent can get the details of a youtube video by providing the video info extracted from screenshot of youtube video",
  notoolAgent: "notool_agent: this agent is called when no tool is needed to be called",
};

export const doorPrompt = (userPrompt: string) => `
# Task Planning Assistant (Modular Agent Approach)

## User Request
<user_prompt>
${userPrompt}
</user_prompt>

## Available Agents
You can orchestrate the following autonomous agents:

${Object.values(toolAgents).join("\n\n")}

## Planning Directives
- Use agent-level steps only. Do NOT prescribe internal actions.
- Provide ONLY context updates per step (goal, inputs/handoffs, constraints, paths, success criteria).
- Do NOT specify the same agent consecutively; consolidate responsibilities.
- Keep the plan minimal and outcome-oriented. Use inter-agent handoffs only when necessary.
- Agents internally handle sequencing, retries on failures, and verification.

## Output Format
Return ONLY the plan, with no extra commentary:

<plan>
1. [agent_name] [context: goal/inputs/constraints/paths/success criteria]
2. [agent_name] [context: goal/inputs/constraints/paths/success criteria]
...
</plan>

## Examples

Example 1: Save time to file
<plan>
1. [time_agent] [context: current local timestamp]
2. [file_agent] [context: destination Desktop/current_time.txt; overwrite: true; content: timestamp from step 1]
</plan>

Example 2: YouTube analysis to file
<plan>
1. [youtube_agent] [context: provided video screenshot info; produce video details and summary]
2. [file_agent] [context: destination Documents/video_summary.txt; content: summary from step 1]
</plan>

Example 3: Organize photos by date and create backup
<plan>
1. [file_agent] [context: goal organize ~/Pictures by date (YYYY-MM-DD) and create backup at ~/Backups/Pictures; include verification]
</plan>

Example 4: How many moons saturn have
<plan>
1. [notool_agent] [context: question about number of moons of Saturn]
</plan>

Important Notes
- Preserve bracket format [agent_name] [description] for parsing
- Prefer absolute paths (e.g., ~/Desktop, ~/Documents) and keep in mind you are running on macOS
- Output ONLY the <plan> XML. No extra explanations.
`;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface DoorPlanStep {
  stepNumber: number;
  agentName: string;
  context: string;
  rawLine: string;
}

/**
 * Transforms a door plan output string into an array of structured steps.
 * Accepts either a raw plan or a string containing a <plan>...</plan> block.
 */
export function transformDoorOutputToArray(output: string): DoorPlanStep[] {
  if (!output || typeof output !== "string") return [];

  const planBlockMatch = output.match(/<plan>([\s\S]*?)<\/plan>/i);
  const planText = planBlockMatch ? planBlockMatch[1] : output;

  const lines = planText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const steps: DoorPlanStep[] = [];

  for (const line of lines) {
    // Example line: 1. [time_agent] [context: current local timestamp]
    const numberedMatch = line.match(/^\s*(\d+)\.?\s*(.*)$/);
    const stepNumber = numberedMatch ? parseInt(numberedMatch[1], 10) : steps.length + 1;
    const rest = numberedMatch ? numberedMatch[2].trim() : line;

    // Extract [agent] and [context: ...]
    const bracketMatches = Array.from(rest.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1]);
    const agentCandidate = bracketMatches[0] || "";
    const contextCandidate = bracketMatches[1] || rest;

    const agentName = agentCandidate.trim();
    const context = contextCandidate.replace(/^context:\s*/i, "").trim();

    steps.push({
      stepNumber: Number.isFinite(stepNumber) ? stepNumber : steps.length + 1,
      agentName,
      context,
      rawLine: line,
    });
  }

  return steps;
}

export async function getDoorResponse(userInput: string): Promise<string> {
  const prompt = doorPrompt(userInput);

  const response = await groq.chat.completions.create({
    model: "moonshotai/kimi-k2-instruct",
    temperature: 0.6,
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices?.[0]?.message?.content ?? "";
}

if (require.main === module) {
  getDoorResponse("save current time in a txt file on my desktop").then((response) => {
    console.log(response);
    console.log(transformDoorOutputToArray(response));
  });
}
