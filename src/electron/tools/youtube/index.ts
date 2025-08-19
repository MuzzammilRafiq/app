import { videoService } from "./service.js";
import chalk from "chalk";
import { getSubtitlesByVideoId } from "./yt-dlp.js";
import { extractVideoInfoFromText } from "./videoInfoExtractor.js";

export const youtubeTool = async (videoInfo: string): Promise<{output:string}> => {
  try {
    console.log(chalk.green("Processing video info..."));

    // Extract video title and channel name using the dedicated function
    const extractedInfo = await extractVideoInfoFromText(videoInfo);

    if (!extractedInfo) {
      throw new Error("Failed to extract video title and channel name");
    }

    const { videotitle: videoTitle, channelname: channelName } = extractedInfo;
    const searchQuery = `${videoTitle} channel:${channelName}`;

    console.log(chalk.green("searching for video...."));
    const curlResults = await videoService.curlSearch(searchQuery, 1);
    console.log(chalk.bgMagenta(`[youtubeTool] Curl results: ${JSON.stringify(curlResults, null, 2)}`));

    if (!curlResults) {
      throw new Error("Video not found");
    }

    console.log(chalk.green("getting transcript..."));
    const transcript = await getSubtitlesByVideoId(curlResults.videoId);

    const summary = await videoService.summarizeTranscript(transcript);
    return {output:`<videoInfo>${JSON.stringify(curlResults, null, 2)}</videoInfo><transcript>${summary}</transcript>`};
  } catch (error) {
    console.log(chalk.red(`[youtubeTool] Error: ${error}`));
    return {output:""};
  }
};
export const youtubeToolFunctionDeclaration = {
  name: "youtubeTool",
  description: "Extract video details from a video info extracted from secreenshot of youtube video",
  parameters: {
    type: "object",
    properties: {
      videoInfo: {
        type: "string",
        description: "Video info extracted from secreenshot of youtube video",
      },
    },
  },
};

// if (require.main === module) {
//   getVideoDetailsByVideoInfo(
//     `The image shows a YouTube video screen capture.

// Content of the video thumbnail:

// The background is a dark space scene with many small white dots representing stars.
// In the upper central part of the thumbnail, there is a small, bright white circle with a black dot in its center, which is pointed to by a curved red arrow. This likely represents a black hole.
// In the lower right part of the thumbnail, there's a curved gray and white object, which appears to be the Earth or another celestial body seen from space.
// In the lower left, there's a circular red logo with "what if?" written in white text below a black silhouette of a dinosaur hanging upside down, suspended by ropes.
// Information below the thumbnail:

// Video Title: "What if the moon turned into a black hole?"
// Channel Name: "xkcd's What If?"
// Video Statistics: "72K views • 1 hour ago"
// Video Duration: "3:41" (visible in the bottom right corner of the thumbnail)
// There are also three vertical dots to the right of the title, indicating more options.
// The overall image suggests a video from the "xkcd's What If?" series, exploring a hypothetical scenario involving the moon transforming into a black hole.`
//   ).then((res) => {
//     console.log(chalk.green(JSON.stringify(res, null, 2)));
//   });
// }
