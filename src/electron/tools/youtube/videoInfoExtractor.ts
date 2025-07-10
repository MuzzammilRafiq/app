import { GoogleGenAI, Type } from "@google/genai";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

export interface VideoInfoResult {
  videotitle: string;
  channelname: string;
}

export const extractVideoInfoFromText = async (videoInfo: string): Promise<VideoInfoResult | null> => {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    // console.log(chalk.green("extracting title and channel name=>", JSON.stringify(videoInfo, null, 2)));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract the video title and channel name from the following YouTube video information.
<videoInfo>
${JSON.stringify(videoInfo, null, 2)}
</videoInfo>

Extract the values and return them in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videotitle: {
              type: Type.STRING,
              description: "Video title extracted from the text",
            },
            channelname: {
              type: Type.STRING,
              description: "Channel name extracted from the text",
            },
          },
          required: ["videotitle", "channelname"],
        },
      },
    });

    console.log(chalk.bgMagenta(`[extractVideoInfoFromText] JSON: ${JSON.stringify(response, null, 2)}`));
    console.log(chalk.bgCyan(`[extractVideoInfoFromText] Response text: ${response.text}`));

    const json = JSON.parse(response.text!);
    console.log(chalk.bgBlue(`[extractVideoInfoFromText] Parsed JSON: ${JSON.stringify(json, null, 2)}`));

    const videoTitle = json.videotitle;
    const channelName = json.channelname;

    if (!videoTitle || !channelName) {
      console.log(chalk.red(`[extractVideoInfoFromText] Missing data - Title: ${videoTitle}, Channel: ${channelName}`));
      return null;
    }

    console.log(chalk.green(`[extractVideoInfoFromText] Extracted - Title: ${videoTitle}, Channel: ${channelName}`));

    return {
      videotitle: videoTitle,
      channelname: channelName,
    };
  } catch (error) {
    console.log(chalk.red(`[extractVideoInfoFromText] Error: ${error}`));
    return null;
  }
};

// Test function that can be run directly
export const testVideoInfoExtraction = async () => {
  const testData = `Video Title: Putting 50 Additional Chapters in JJK
Channel Name: manganimist
Views: 566 views
Upload Time: 17 minutes ago
Video Duration: 8:01`;

  console.log(chalk.yellow("Testing video info extraction with sample data:"));
  console.log(chalk.gray(testData));
  console.log(chalk.yellow("=".repeat(50)));

  const result = await extractVideoInfoFromText(testData);

  if (result) {
    console.log(chalk.green("✅ Extraction successful!"));
    console.log(chalk.green(`Title: ${result.videotitle}`));
    console.log(chalk.green(`Channel: ${result.channelname}`));
  } else {
    console.log(chalk.red("❌ Extraction failed!"));
  }

  return result;
};

// Allow running this file directly for testing (ES module detection)
if (import.meta.url === `file://${process.argv[1]}`) {
  testVideoInfoExtraction()
    .then((result) => {
      console.log(chalk.blue("Final result:"), result);
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red("Test failed:"), error);
      process.exit(1);
    });
}
