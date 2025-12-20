import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
dotenv.config();
import { ipcMain } from "electron";
import log from "../../common/log.js";

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const getModels = async () => {
  try {
    log.GREEN("Fetching OpenRouter models...");
    const models = (await openRouter.models.list()).data
      .filter((m) => "tools" in m.supportedParameters)
      .map((model) => ({
        id: model.id,
        name: model.name,
        input_modalities: model.architecture.inputModalities,
        output_modalities: model.architecture.outputModalities,
        supported_parameters: model.supportedParameters,
      }));
    return models;
  } catch (error) {
    console.error("Failed to fetch OpenRouter models:", error);
    return [];
  }
};

export function getOpenRouterModels() {
  ipcMain.handle("get-openrouter-models", async (_event) => {
    try {
      const models = await getModels();
      return models;
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
      throw error;
    }
  });
}
