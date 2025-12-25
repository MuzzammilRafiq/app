import { google } from "googleapis";
import {
  VideoDetails,
  VideoInfoResult,
  VideoParams,
} from "../../../common/types.js";
import { getSubtitlesByVideoId } from "./yt-dlp.js";
import { LOG, JSON_PRINT } from "../../utils/logging.js";
import dotenv from "dotenv";
import { ASK_TEXT, ChatMessage } from "../../services/llm.js";
const TAG = "youtube-service";
dotenv.config();

export const extractVideoInfoFromText = async (
  context: string,
  event: any,
  apiKey: string
): Promise<VideoInfoResult> => {
  LOG(TAG).INFO("extractVideoInfoFromText....");
  const PROMPT = `Extract the video title, channel name, and determine if the user wants a summary from the following context.

<context>
${context}
</context>

Your task is to:
1. Extract the video title from the context
2. Extract the channel name from the context  
3. Determine if the user explicity wants a summary based on the context and user's intent dont assume anything default should be false

Return the values in JSON format with generate_summary as a boolean.`;
  const M: ChatMessage[] = [{ role: "user", content: PROMPT }];
  const options = {
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "video_info_extractor_response",
        schema: {
          type: "object",
          properties: {
            videotitle: {
              type: "string",
              description: "Video title extracted from the text",
            },
            channelname: {
              type: "string",
              description: "Channel name extracted from the text",
            },
            generate_summary: {
              type: "boolean",
              description: "Whether the user wants a summary of the video",
            },
          },
          required: ["videotitle", "channelname", "generate_summary"],
          additionalProperties: false,
        },
      },
    },
  };

  const response = ASK_TEXT(apiKey, M, options);
  if (!response) {
    throw new Error("No response content received from LLM");
  }
  let c = "";
  for await (const { content, reasoning } of response) {
    if (content) {
      c += content;
    }
    if (reasoning) {
      event.sender.send("stream-chunk", {
        chunk: reasoning,
        type: "log",
      });
    }
  }

  LOG(TAG).INFO("extractVideoInfoFromText response", JSON_PRINT(c));
  const { videotitle, channelname, generate_summary } = JSON.parse(c);
  return { videotitle, channelname, generate_summary };
};

export const getVideoSummaryById = async (
  videoId: string,
  event: any,
  apiKey: string
): Promise<string> => {
  const transcript = (await getSubtitlesByVideoId(videoId)).slice(0, 80_000);
  const tokenCount = Math.ceil((1.33 * transcript.length) / 5.7);
  if (tokenCount <= 3_000) return transcript;
  const PROMPT = `summarise below transcript in 3000 words or less and give me only summary <transcript>${transcript} </transcript>`;
  const M: ChatMessage[] = [{ role: "user", content: PROMPT }];
  const options = {
    responseFormat: {
      type: "string",
      jsonSchema: {
        name: "video_summary_response",
        schema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Summary of the transcript",
            },
          },
          required: ["summary"],
          additionalProperties: false,
        },
      },
    },
    stream: false,
  };

  const response = ASK_TEXT(apiKey, M, options);
  if (!response) {
    throw new Error("No response content received from LLM");
  }
  let c = "";
  for await (const { content, reasoning } of response) {
    if (content) {
      c += content;
    }
    if (reasoning) {
      event.sender.send("stream-chunk", {
        chunk: reasoning,
        type: "log",
      });
    }
  }
  const { summary } = JSON.parse(c);
  return summary;
};

export const getVideoDetailsById = async ({
  videoId,
  parts = ["snippet", "contentDetails", "statistics"],
}: VideoParams): Promise<VideoDetails> => {
  const youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY,
  });
  const response = await youtube.videos.list({
    part: parts,
    id: [videoId],
  });
  const x = response.data.items?.[0]!;
  return {
    title: x.snippet!.title!,
    description: x.snippet!.description!.replace(/\n/g, " "),
    publishedAt: new Date(x.snippet!.publishedAt!).toLocaleDateString(),
    channelTitle: x.snippet!.channelTitle!,
    channelId: x.snippet!.channelId!,
    videoId: x.id!,
    thumbnail: x.snippet?.thumbnails?.high?.url!,
    duration: x.contentDetails?.duration!,
    viewCount: x.statistics?.viewCount!,
    likeCount: x.statistics?.likeCount!,
    commentCount: x.statistics?.commentCount!,
  };
};

export const getVideoID = async (
  videotitle: string,
  channelname: string
): Promise<string> => {
  const searchQuery = `${videotitle} channel:${channelname}`;
  const encodedQuery = encodeURIComponent(searchQuery);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=2&q=${encodedQuery}&type=video&key=${process.env.YOUTUBE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  const firstItem = data.items[0];
  return firstItem.id.videoId;
};
