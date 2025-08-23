import Groq from "groq-sdk";
import { ChatCompletion } from "groq-sdk/resources/chat/completions.mjs";
import dotenv from "dotenv";
import { APIPromise } from "groq-sdk/core.mjs";
dotenv.config();
class GroqService {
  private static instance: GroqService;
  private ai: Groq;

  private constructor() {
    this.ai = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
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
  public async stream(model: string, options: any): Promise<any> {
    return this.ai.chat.completions.create({
      ...options,
      model,
    });
  }
}

export const groq = GroqService.getInstance();
