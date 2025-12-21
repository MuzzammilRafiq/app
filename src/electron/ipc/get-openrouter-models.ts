import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
dotenv.config();
import { ipcMain } from "electron";
import log from "../../common/log.js";

const createClient = (apiKey?: string) =>
  new OpenRouter({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
  });

export const getModels = async (apiKey?: string) => {
  try {
    log.GREEN("Fetching OpenRouter models...");
    const client = createClient(apiKey);
    const list = await client.models.list();
    const models = list.data
      .filter((m: any) => {
        const sp = m.supportedParameters;
        if (Array.isArray(sp)) return sp.includes("tools");
        return !!sp && "tools" in sp;
      })
      .map((model: any) => ({
        id: model.id,
        name: model.name,
        input_modalities: model.architecture.inputModalities,
        output_modalities: model.architecture.outputModalities,
        supported_parameters: Array.isArray(model.supportedParameters)
          ? model.supportedParameters
          : Object.keys(model.supportedParameters || {}),
      }));
    return models;
  } catch (error) {
    console.error("Failed to fetch OpenRouter models:", error);
    return [];
  }
};

export function getOpenRouterModels() {
  ipcMain.handle("get-openrouter-models", async (_event, apiKey?: string) => {
    try {
      const models = await getModels(apiKey);
      return models;
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
      throw error;
    }
  });
}
