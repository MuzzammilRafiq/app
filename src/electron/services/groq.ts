import Groq from "groq-sdk";
class GroqService {
  private static instance: GroqService;
  private ai: Groq;

  private constructor() {
    this.ai = new Groq({});
  }
  public static getInstance(): GroqService {
    if (!GroqService.instance) {
      GroqService.instance = new GroqService();
    }
    return GroqService.instance;
  }
  public async chat(model: string, options: any): Promise<string | null> {
    const res = await this.ai.chat.completions.create({
      model,
      ...options,
    });
    return res.choices?.[0]?.message?.content ?? null;
  }
}

export const groq = GroqService.getInstance();
