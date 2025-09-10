import { GoogleGenAI } from "@google/genai";
import log from "../../../common/log.js";
import { ragAnswer } from "../rag/index.js";
import { IpcMainInvokeEvent } from "electron";
export const pre = async (ai: GoogleGenAI, lastUserMessage: any, event: IpcMainInvokeEvent, config: any) => {
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
    event.sender.send("stream-chunk" /* EventChannels.STREAM_CHUNK */, {
      chunk: `*Extracted Image description:*`,
      type: "log" /* Labels.LOG */,
    });
    //TODO add stream chunk for trace
    lastUserMessage = {
      id: lastUserMessage.id,
      content: lastUserMessage.content + "\n\n" + "<ATTACH_IMAGE_DESC>\n" + result.text + "\n</ATTACH_IMAGE_DESC>",
      role: "user",
      timestamp: lastUserMessage.timestamp,
    };
  }
  if (config.rag) {
    const retreivedDocuments = await ragAnswer(event, lastUserMessage.content);
    lastUserMessage.content =
      lastUserMessage.content + "\n" + "<RAG_RESULT>\n" + retreivedDocuments + "\n</RAG_RESULT>";
  }
  return lastUserMessage;
};
//# sourceMappingURL=index.js.map
