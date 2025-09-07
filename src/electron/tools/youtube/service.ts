import { google } from "googleapis";
import { VideoDetails, VideoInfoResult, VideoParams } from "../../../common/types.js";
import { getSubtitlesByVideoId } from "./yt-dlp.js";
import { groq } from "../../services/groq.js";
import log from "../../../common/log.js";

import dotenv from "dotenv";
dotenv.config();

export const extractVideoInfoFromText = async (context: string): Promise<VideoInfoResult> => {
  log.BG_BLUE("___________extractVideoInfoFromText___________");
  const PROMPT = `Extract the video title, channel name, and determine if the user wants a summary from the following context.

<context>
${context}
</context>

Your task is to:
1. Extract the video title from the context
2. Extract the channel name from the context  
3. Determine if the user explicity wants a summary based on the context and user's intent dont assume anything default should be false

Return the values in JSON format with generate_summary as a boolean.`;
  const options = {
    temperature: 0.5,
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: PROMPT }],
    response_format: {
      type: "json_schema",
      json_schema: {
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
    stream: false,
  };

  const response = await groq.chat("moonshotai/kimi-k2-instruct", options);
  log.CYAN(response);
  const { videotitle, channelname, generate_summary } = JSON.parse(response!);
  log.GREEN(
    `[extractVideoInfoFromText]\nvideotitle:${videotitle}\nchannelname:${channelname}\ngenerate_summary:${generate_summary}\n`
  );
  return { videotitle, channelname, generate_summary };
};

export const getVideoSummaryById = async (videoId: string): Promise<string> => {
  const transcript = (await getSubtitlesByVideoId(videoId)).slice(0, 80_000);
  const tokenCount = Math.ceil((1.33 * transcript.length) / 5.7);
  if (tokenCount <= 3_000) return transcript;
  const PROMPT = `summarise below transcript in 3000 words or less and give me only summary <transcript>${transcript} </transcript>`;
  const options = {
    temperature: 0.5,
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: PROMPT }],
    response_format: {
      type: "string",
      json_schema: {
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
  const response = await groq.chat("moonshotai/kimi-k2-instruct", options);
  const { summary } = JSON.parse(response!);
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

export const getVideoID = async (videotitle: string, channelname: string): Promise<string> => {
  const searchQuery = `${videotitle} channel:${channelname}`;
  const encodedQuery = encodeURIComponent(searchQuery);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=2&q=${encodedQuery}&type=video&key=${process.env.YOUTUBE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  const firstItem = data.items[0];
  return firstItem.id.videoId;
};
