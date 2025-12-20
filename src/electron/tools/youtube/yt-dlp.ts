import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import fs from "fs/promises";

const extractTextFromSubtitlesFile = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const subtitlesFile = join(dirname(__filename), `sub.en.vtt`);
  const subtitles = await fs.readFile(subtitlesFile, "utf8");

  // Extract clean text from VTT content
  const lines = subtitles.split("\n");
  const cleanLines: string[] = [];
  let lastCleanText = "";

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines, timestamps, and VTT headers
    if (
      !trimmedLine ||
      /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/.test(
        trimmedLine,
      ) ||
      /^(WEBVTT|Kind:|Language:)/.test(trimmedLine)
    ) {
      continue;
    }

    // Remove timing tags like <00:00:03.679><c>text</c>
    const cleanText = trimmedLine.replace(/<[^>]*>/g, "").trim();

    // Only add if it's not the same as the previous line
    if (cleanText && cleanText !== lastCleanText) {
      lastCleanText = cleanText;
      cleanLines.push(cleanText);
    }
  }

  return cleanLines.join(" ");
};

export const getSubtitlesByVideoId = async (
  videoId: string,
): Promise<string> => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const outputPath = join(__dirname, "sub");
  console.log(chalk.green("getting subtitles using ytdlp ..."));
  return new Promise((resolve, reject) => {
    const command = spawn("yt-dlp", [
      "--write-subs",
      "--write-auto-subs",
      "--skip-download",
      "--quiet",
      "--sub-format",
      "vtt",
      "-o",
      outputPath,
      videoId,
    ]);
    let stdout = "";
    command.stdout.on("data", (data) => {
      console.log(chalk.green(data.toString()));
      stdout += data.toString();
    });

    command.on("close", async (code) => {
      if (code === 0) {
        if (stdout.includes("no subtitles")) {
          resolve("");
        } else {
          resolve(await extractTextFromSubtitlesFile());
        }
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    command.on("error", (error) => {
      reject(error);
    });
  });
};

// if (require.main === module) {
//   (async () => {
//     console.log(chalk.green(await getSubtitlesByVideoId("Nfg36QM6txM")));
//   })();
// }
