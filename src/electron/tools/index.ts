import { getCurrentDateTime, getCurrentDateTimeFunctionDeclaration } from "./time/index.js";
import {
  getYoutubeVideoDetailsByVideoInfo,
  getYoutubeVideoDetailsByVideoInfoFunctionDeclaration,
} from "./youtube/index.js";

export default {
  default: () => "No function found",
  getCurrentDateTime: [getCurrentDateTime, getCurrentDateTimeFunctionDeclaration],
  getYoutubeVideoDetailsByVideoInfo: [
    getYoutubeVideoDetailsByVideoInfo,
    getYoutubeVideoDetailsByVideoInfoFunctionDeclaration,
  ],
};
