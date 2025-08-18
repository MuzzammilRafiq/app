import { groq } from "../../services/groq.js";
import log from "../../../common/log.js";

export const generalTool = async (context: string): Promise<{ output: string }> => {
  try {
    log.BLUE(`[generalTool] Processing context: ${context}`);

    const prompt = `You are a helpful AI assistant that provides clear, well-formatted markdown responses. 

Based on the following context/request, provide a comprehensive and nicely formatted markdown response:

Context: ${context}

Requirements:
- Use proper markdown formatting with headers, lists, code blocks, etc.
- Be informative and helpful
- Structure your response clearly
- Use appropriate emphasis (bold, italic) where needed
- Include relevant details and explanations
- If the context contains results from other tools or operations, summarize them clearly
- Make the response user-friendly and easy to read

Provide your response in markdown format:`;

    const options = {
      temperature: 0.7,
      max_completion_tokens: 8192,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
    };

    const response = await groq.chat("moonshotai/kimi-k2-instruct", options);

    if (!response) {
      throw new Error("No response received from AI service");
    }

    log.BLUE(`[generalTool] Generated response length: ${response.length}`);

    return { output: response };
  } catch (error) {
    log.RED(`[generalTool] Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      output: `# Error\n\nSorry, I encountered an error while processing your request:\n\n\`${error instanceof Error ? error.message : "Unknown error"}\`\n\nPlease try again or contact support if the issue persists.`,
    };
  }
};
