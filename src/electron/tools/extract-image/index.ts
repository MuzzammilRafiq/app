import { GoogleGenAI } from "@google/genai";
import log from "../../common/log.js";

export const extractImage = async (ai: GoogleGenAI, lastUserMessage: any, event: any) => {
  if (lastUserMessage.images && lastUserMessage.images.length > 0) {
    const { data: imageData, mimeType: imageMimeType } = lastUserMessage.images[0];

    const imageBase64 = Buffer.from(imageData, "base64").toString("base64");
    log.BLUE("generating image description");
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        },
        { text: "Describe this image and extract text" },
      ],
    });
    //TODO add stream chunk for trace
    lastUserMessage = {
      id: lastUserMessage.id,
      content: `query: "${lastUserMessage.content}"\n\nimage description extracted from the image in the query by a tool: <description>${result.text}</description>`,
      role: "user",
      timestamp: lastUserMessage.timestamp,
    };
  }
  return lastUserMessage;
};
