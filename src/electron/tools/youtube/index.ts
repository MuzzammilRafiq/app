import { google, youtube_v3 } from "googleapis";
import { SearchParams, VideoParams } from "./types.js";
import { getSubtitles } from "./yt-dlp.js";
import chalk from "chalk";
import dotenv from "dotenv";
dotenv.config();
class VideoService {
  private static instance: VideoService;
  private youtube: youtube_v3.Youtube;
  private constructor() {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY environment variable is not set.");
    }
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });
  }
  //just for calling the constructor only once
  public static getInstance() {
    if (!VideoService.instance) {
      VideoService.instance = new VideoService();
    }
    return VideoService.instance;
  }
  public getYoutube(): youtube_v3.Youtube {
    return this.youtube;
  }

  async getVideoById({ videoId, parts = ["snippet", "contentDetails", "statistics"] }: VideoParams): Promise<any> {
    try {
      const response = await this.youtube.videos.list({
        part: parts,
        id: [videoId],
      });
      const x = response.data.items?.[0];
      if (x) {
        return {
          title: x.snippet?.title,
          description: x.snippet?.description?.replace(/\n/g, " "),
          publishedAt: new Date(x.snippet?.publishedAt!).toLocaleDateString(),
          channelTitle: x.snippet?.channelTitle,
          duration: x.contentDetails?.duration,
          viewCount: x.statistics?.viewCount,
          likeCount: x.statistics?.likeCount,
          commentCount: x.statistics?.commentCount,
        };
      } else {
        return null;
      }
    } catch (error) {
      throw new Error(`Failed to get video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getVideosBySearch({ query, maxResults = 10 }: SearchParams): Promise<any[]> {
    try {
      const response = await this.youtube.search.list({
        part: ["snippet"],
        q: query,
        maxResults,
        type: ["video"],
      });

      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to search videos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTranscriptByVideoId(videoId: string): Promise<any> {
    try {
      const transcript = await getSubtitles(videoId);
      return transcript;
    } catch (error) {
      throw new Error(`Failed to get transcript: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const videoService = VideoService.getInstance();
if (require.main === module) {
  console.log(chalk.green(JSON.stringify(await videoService.getVideoById({ videoId: "izTre_7g1XU" }), null, 2)));
}
