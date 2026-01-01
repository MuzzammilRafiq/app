import { ASK_IMAGE } from "../../services/model.js";
import { ragAnswer } from "../rag/index.js";
import { webSearchAnswer } from "../web-search/index.js";
import { IpcMainInvokeEvent } from "electron";
import { ChatMessageRecord } from "../../../common/types.js";
import { LOG } from "../../utils/logging.js";
const TAG = "pre";

export const preProcessMessage = async (
  lastUserMessage: ChatMessageRecord,
  event: IpcMainInvokeEvent,
  apiKey: string,
  config: any,
) => {
  // If there are images, generate text description using OpenRouter multimodal model
  if (lastUserMessage?.imagePaths && lastUserMessage.imagePaths.length > 0) {
    try {
      LOG(TAG).INFO("generating image description using OpenRouter");
      event.sender.send("stream-chunk", {
        chunk: `*Analyzing image(s) with vision model...*`,
        type: "log",
      });

      // Use ASK_IMAGE to describe the image
      const response = ASK_IMAGE(
        apiKey,
        "Describe this image in detail and extract any text visible in it.",
        lastUserMessage.imagePaths,
        {
          overrideModel: config?.imageModelOverride,
        }
      );

      let description = "";
      for await (const { content } of response) {
        if (content) {
          description += content;
        }
      }

      LOG(TAG).SUCCESS("image description generated");
      event.sender.send("stream-chunk", {
        chunk: `*Image description extracted successfully*`,
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
          description +
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
      LOG(TAG).ERROR(`Failed to generate image description: ${err}`);
    }
  }

  if (config?.rag) {
    const retreivedDocuments = await ragAnswer(
      event,
      apiKey,
      lastUserMessage.content,
    );
    lastUserMessage.content =
      lastUserMessage.content +
      "\n" +
      "<RAG_RESULT>\n" +
      retreivedDocuments +
      "\n</RAG_RESULT>";
  }

  if (config?.webSearch) {
    const webSearchResults = await webSearchAnswer(
      event,
      apiKey,
      lastUserMessage.content
    );
    lastUserMessage.content =
      lastUserMessage.content +
      "\n" +
      "<WEB_SEARCH_RESULT>\n" +
      webSearchResults +
      "\n</WEB_SEARCH_RESULT>";
  }

  return lastUserMessage;
};
