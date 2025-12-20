import { GoogleGenAI } from "@google/genai";
import log from "../../../common/log.js";
import { ragAnswer } from "../rag/index.js";
import { IpcMainInvokeEvent } from "electron";
import { promises as fs } from "fs";
import path from "node:path";
import { ChatMessageRecord } from "../../../common/types.js";

function guessMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}
export const preProcessMessage = async (
  lastUserMessage: ChatMessageRecord,
  event: IpcMainInvokeEvent,
  config: any,
) => {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  if (lastUserMessage?.imagePaths && lastUserMessage.imagePaths.length > 0) {
    try {
      const imagePath = lastUserMessage.imagePaths[0];
      const mimeType = guessMimeFromPath(imagePath);
      const buffer = await fs.readFile(imagePath);
      const imageBase64 = buffer.toString("base64");
      log.BLUE("generating image description (from path)");
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: "Describe this image and extract text" },
        ],
      });
      log.GREEN("image description generated");
      event.sender.send("stream-chunk", {
        chunk: `*Extracted Image description:*`,
        type: "log",
      });
      lastUserMessage = {
        id: lastUserMessage.id,
        sessionId: lastUserMessage.sessionId,
        isError: lastUserMessage.isError,
        imagePaths: lastUserMessage.imagePaths,
        type: lastUserMessage.type,
        content:
          (lastUserMessage.content || "") +
          "\n\n" +
          "<ATTACH_IMAGE_DESC>\n" +
          result.text +
          "\n</ATTACH_IMAGE_DESC>",
        role: "user",
        timestamp: lastUserMessage.timestamp,
      };
    } catch (err) {
      lastUserMessage = {
        id: lastUserMessage.id,
        sessionId: lastUserMessage.sessionId,
        isError: lastUserMessage.isError,
        imagePaths: lastUserMessage.imagePaths,
        type: lastUserMessage.type,
        content:
          (lastUserMessage.content || "") +
          "\n\n" +
          "<ATTACH_IMAGE_DESC>\n" +
          "failed to generate description" +
          "\n</ATTACH_IMAGE_DESC>",
        role: "user",
        timestamp: lastUserMessage.timestamp,
      };
      log.RED(`Failed to read/process image at path: ${err}`);
    }
  }
  if (config?.rag) {
    const retreivedDocuments = await ragAnswer(event, lastUserMessage.content);
    lastUserMessage.content =
      lastUserMessage.content +
      "\n" +
      "<RAG_RESULT>\n" +
      retreivedDocuments +
      "\n</RAG_RESULT>";
  }
  return lastUserMessage;
};
//# sourceMappingURL=index.js.map
