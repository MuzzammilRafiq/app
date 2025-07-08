import { google, youtube_v3 } from "googleapis";
import { SearchParams, VideoDetails, VideoParams } from "./types.js";
import { getSubtitlesByVideoId } from "./yt-dlp.js";
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

  async getVideoById({
    videoId,
    parts = ["snippet", "contentDetails", "statistics"],
  }: VideoParams): Promise<VideoDetails | null> {
    try {
      const response = await this.youtube.videos.list({
        part: parts,
        id: [videoId],
      });
      const x = response.data.items?.[0];
      if (x) {
        return {
          title: x.snippet?.title || "",
          description: x.snippet?.description?.replace(/\n/g, " ") || "",
          publishedAt: new Date(x.snippet?.publishedAt!).toLocaleDateString() || "",
          channelTitle: x.snippet?.channelTitle || "",
          channelId: x.snippet?.channelId || "",
          videoId: x.id || "",
          thumbnail: x.snippet?.thumbnails?.high?.url || "",
          duration: x.contentDetails?.duration || "",
          viewCount: x.statistics?.viewCount || "",
          likeCount: x.statistics?.likeCount || "",
          commentCount: x.statistics?.commentCount || "",
        };
      } else {
        return null;
      }
    } catch (error) {
      throw new Error(`Failed to get video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getVideosBySearch({ query, maxResults = 3 }: SearchParams): Promise<any[]> {
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
      const transcript = await getSubtitlesByVideoId(videoId);
      return transcript;
    } catch (error) {
      throw new Error(`Failed to get transcript: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getChannelByChannelId(channelId: string): Promise<any> {
    try {
      const response = await this.youtube.channels.list({
        part: ["snippet", "contentDetails", "statistics"],
        id: [channelId],
      });
      return response.data.items?.[0] || null;
    } catch (error) {
      throw new Error(`Failed to get channel: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Function that replicates the exact curl command using fetch
  async curlSearch(query: string, maxResults: number = 1): Promise<VideoDetails | null> {
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YOUTUBE_API_KEY environment variable is not set.");
      }

      // URL encode the query exactly like the curl command
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodedQuery}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();
      const videoId = data.items[0].id.videoId;
      const videoDetails = await this.getVideoById({ videoId });
      if (!videoDetails) {
        return null;
      }
      return videoDetails;
    } catch (error) {
      throw new Error(`Failed to fetch from YouTube API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const videoService = VideoService.getInstance();
if (require.main === module) {
  // const query = "Music for Deep Intense Focus of Work and Long Hours of Peak Performance channel:Uplifting Brainwaves";

  // const curlResults = await videoService.curlSearch(query, 1);
  console.log(
    chalk.green(JSON.stringify(await videoService.getChannelByChannelId("UC6IxnFzHofFJ5X2PycSMsww"), null, 2))
  );
}

/*
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=2&q=Music+for+Deep+Intense+Focus+of+Work+and+Long+Hours+of+Peak+Performance+channel%3AUplifting+Brainwaves&key=AIzaSyCqWdO51473-lihqoPwOTx0SWweqT6TYE"
*/
