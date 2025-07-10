import { GoogleGenAI } from "@google/genai";

/**
 * Global GoogleGenAI instance - singleton pattern
 * This ensures only one instance of GoogleGenAI is created and used throughout the app
 */
class AIService {
  private static instance: AIService;
  private ai: GoogleGenAI;

  private constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public getAI(): GoogleGenAI {
    return this.ai;
  }

  public isInitialized(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }
}

export const aiService = AIService.getInstance();
