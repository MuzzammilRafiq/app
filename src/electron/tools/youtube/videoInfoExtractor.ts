import { groq } from "../../services/groq.js";
import dotenv from "dotenv";
import log from "../../../common/log.js";
dotenv.config();
export interface VideoInfoResult {
  videotitle: string;
  channelname: string;
}
const PROMPT = (context: string) => `Extract the video title and channel name from the following context.
<context>
${context}
</context>
Extract the values and return them in JSON format.`;
export const extractVideoInfoFromText = async (context: string): Promise<VideoInfoResult> => {
  try {
    const options = {
      temperature: 0.5,
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: PROMPT(context) }],
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
            },
            required: ["videotitle", "channelname"],
            additionalProperties: false,
          },
        },
      },
      stream: false,
    };
    const response = await groq.chat("moonshotai/kimi-k2-instruct", options);
    const { videotitle, channelname } = JSON.parse(response || "{}");
    if (!videotitle || !channelname) {
      throw new Error("Failed to extract video title and channel name");
    }
    log.GREEN(`[extractVideoInfoFromText]\nvideotitle:${videotitle}\nchannelname:${channelname}\n`);
    return { videotitle, channelname };
  } catch (error) {
    log.RED(`[extractVideoInfoFromText] Error: ${error}`);
    return { videotitle: "", channelname: "" };
  }
};

// if (require.main === module) {
//   await extractVideoInfoFromText(`The image shows a YouTube video screen capture.

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
// The overall image suggests a video from the "xkcd's What If?" series, exploring a hypothetical scenario involving the moon transforming into a black hole.`).then(
//     (res) => {
//       log.DEFAULT(res.videotitle, res.channelname);
//     }
//   );
// }
