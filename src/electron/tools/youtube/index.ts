import { videoService } from "./service.js";
import { aiService } from "../../services/gemini.js";
import { Type } from "@google/genai";
import chalk from "chalk";
import { getSubtitlesByVideoId } from "./yt-dlp.js";
export const getVideoDetailsByVideoInfo = async ({
  videoInfo,
  callTranscription,
}: {
  videoInfo: string;
  callTranscription: boolean;
}) => {
  try {
    const ai = aiService.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `below is the extracted text and info from youtube video screenshot.
      <videoInfo>
      ${videoInfo}
      </videoInfo>
      extract the video title, channel name.
      return the response in json format.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videotitle: {
              type: Type.STRING,
              description: "Video title",
            },
            channelname: {
              type: Type.STRING,
              description: "Channel name",
            },
          },
        },
      },
    });
    const json = JSON.parse(response.text!);
    const videoTitle = json.videotitle;
    const channelName = json.channelname;
    const searchQuery = `${videoTitle} channel:${channelName}`;
    const curlResults = await videoService.curlSearch(searchQuery, 1);
    if (!curlResults) {
      throw new Error("Video not found");
    }
    if (callTranscription) {
      const transcript = await getSubtitlesByVideoId(curlResults.videoId);
      return `<videoInfo>
      ${JSON.stringify(curlResults, null, 2)}
      </videoInfo>
      <transcript>
      ${transcript}
      </transcript>`;
    }
    return `<videoInfo>
    ${JSON.stringify(curlResults, null, 2)}
      </videoInfo>`;
  } catch (error) {
    return null;
  }
};
export const getVideoDetailsByTextFunctionDeclaration = {
  name: "getVideoDetailsByVideoInfo",
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

export const getVideoDetailsByTranscriptionFunctionDeclaration = {
  name: "getVideoDetailsByTranscription",
  description: "Extract video details from a video transcription",
  parameters: {
    type: "object",
    properties: {},
  },
};

if (require.main === module) {
  getVideoDetailsByVideoInfo({
    videoInfo: `The image shows a YouTube video screen capture.

Content of the video thumbnail:

The background is a dark space scene with many small white dots representing stars.
In the upper central part of the thumbnail, there is a small, bright white circle with a black dot in its center, which is pointed to by a curved red arrow. This likely represents a black hole.
In the lower right part of the thumbnail, there's a curved gray and white object, which appears to be the Earth or another celestial body seen from space.
In the lower left, there's a circular red logo with "what if?" written in white text below a black silhouette of a dinosaur hanging upside down, suspended by ropes.
Information below the thumbnail:

Video Title: "What if the moon turned into a black hole?"
Channel Name: "xkcd's What If?"
Video Statistics: "72K views • 1 hour ago"
Video Duration: "3:41" (visible in the bottom right corner of the thumbnail)
There are also three vertical dots to the right of the title, indicating more options.
The overall image suggests a video from the "xkcd's What If?" series, exploring a hypothetical scenario involving the moon transforming into a black hole.`,
    callTranscription: true,
  }).then((res) => {
    console.log(chalk.green(JSON.stringify(res, null, 2)));
  });
}
