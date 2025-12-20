import { app } from "electron";
import fs from "fs";
import path from "path";

export function getDirs(): {
  baseDir: string;
  mediaDir: string;
  dbDir: string;
  aiDir: string;
} {
  const isDEV = process.env.NODE_ENV === "development";
  const baseDir = isDEV
    ? path.join(process.cwd(), "user_data")
    : path.join(app.getPath("userData"), "user_data");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const mediaDir = path.join(baseDir, "media");
  const dbDir = path.join(baseDir, "db");
  const aiDir = path.join(baseDir, "ai");
  if (!fs.existsSync(aiDir)) {
    fs.mkdirSync(aiDir, { recursive: true });
  }
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return { baseDir, mediaDir, dbDir, aiDir };
}
