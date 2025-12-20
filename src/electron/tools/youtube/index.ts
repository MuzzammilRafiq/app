import {
  extractVideoInfoFromText,
  getVideoDetailsById,
  getVideoID,
  getVideoSummaryById,
} from "./service.js";
import log from "../../../common/log.js";

export const youtubeTool = async (
  context: string,
): Promise<{ output: string }> => {
  try {
    log.BLUE("Processing video info...");
    const { videotitle, channelname, generate_summary } =
      await extractVideoInfoFromText(context);
    if (!videotitle || !channelname) {
      throw new Error("Failed to extract video title and channel name");
    }

    log.BLUE("Searching for video....");
    const videoId = await getVideoID(videotitle, channelname);
    log.BLUE(`[youtubeTool] Found video ID: ${videoId}`);
    const videoDetails = await getVideoDetailsById({ videoId });
    log.BLUE(
      `[youtubeTool] Video details: ${JSON.stringify(videoDetails, null, 2)}`,
    );
    if (!videoId) {
      throw new Error("Video not found");
    }
    if (generate_summary) {
      log.BLUE("Getting summary...");
      const summary = await getVideoSummaryById(videoId);
      return {
        output: `<videoInfo>${JSON.stringify(videoDetails, null, 2)}</videoInfo><summary>${summary}</summary>`,
      };
    } else {
      return {
        output: `<videoInfo>${JSON.stringify(videoDetails, null, 2)}</videoInfo>`,
      };
    }
  } catch (error) {
    log.RED(`[youtubeTool] Error: ${error}`);
    return { output: "" };
  }
};
export const youtubeToolFunctionDeclaration = {
  name: "youtubeTool",
  description:
    "Extract video details from text extracted from screenshot of YouTube video and optionally generate summary",
  parameters: {
    type: "object",
    properties: {
      videoInfo: {
        type: "string",
        description:
          "Video info extracted from screenshot of YouTube video or user context about the video",
      },
    },
  },
};

// if (require.main === module) {
//   youtubeTool(
//     `The image shows a YouTube video screen capture.
// ___________
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
// The overall image suggests a video from the "xkcd's What If?" series, exploring a hypothetical scenario involving the moon transforming into a black hole.
// _________`
//   ).then((res) => {
//     log.GREEN(res.output);
//   });
// }
