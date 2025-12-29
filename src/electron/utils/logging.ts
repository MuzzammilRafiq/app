import chalk from "chalk";

// Log levels for filtering
export const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
} as const;

// Current log level - in production, suppress DEBUG
const currentLevel =
  process.env.NODE_ENV === "production" ? LOG_LEVEL.INFO : LOG_LEVEL.DEBUG;

/**
 * Truncate a string to prevent terminal pollution
 */
export const truncate = (str: string, maxLen = 200): string => {
  if (typeof str !== "string") {
    str = String(str);
  }
  return str.length > maxLen ? str.slice(0, maxLen) + "...[truncated]" : str;
};

/**
 * Smart JSON print - truncates large objects
 */
export const JSON_PRINT = (obj: unknown, maxLen = 500): string => {
  try {
    const str = JSON.stringify(obj, null, 2);
    if (str.length > maxLen) {
      return (
        "\n" +
        str.slice(0, maxLen) +
        "\n...[truncated " +
        (str.length - maxLen) +
        " chars]\n"
      );
    }
    return "\n" + str + "\n";
  } catch {
    return "[JSON serialization failed]";
  }
};

/**
 * Summarize an array for logging
 */
export const summarizeArray = <T>(arr: T[], maxItems = 3): string => {
  if (!Array.isArray(arr)) return String(arr);
  if (arr.length <= maxItems) {
    return `[${arr.length} items]`;
  }
  return `[${arr.length} items, showing first ${maxItems}]`;
};

/**
 * Format timestamp for logs
 */
const timestamp = (): string => new Date().toISOString();

/**
 * Create a tagged logger with log level support
 */
export const LOG = (TAG: string) => {
  return {
    DEBUG: (...args: unknown[]) => {
      if (currentLevel <= LOG_LEVEL.DEBUG) {
        console.log(
          chalk.dim(timestamp() + "\t"),
          chalk.bgGray("DEBUG"),
          "   ",
          chalk.gray(TAG),
          ...args.map((arg) =>
            chalk.dim(typeof arg === "string" ? arg : JSON.stringify(arg))
          )
        );
      }
    },
    INFO: (...args: unknown[]) => {
      if (currentLevel <= LOG_LEVEL.INFO) {
        console.log(
          chalk.magenta(timestamp() + "\t"),
          chalk.bgBlue("INFO"),
          "    ",
          chalk.bgGray(TAG),
          ...args.map((arg) =>
            chalk.blue(typeof arg === "string" ? arg : JSON.stringify(arg))
          )
        );
      }
    },
    SUCCESS: (...args: unknown[]) => {
      if (currentLevel <= LOG_LEVEL.SUCCESS) {
        console.log(
          chalk.magenta(timestamp() + "\t"),
          chalk.bgGreen("SUCCESS"),
          " ",
          chalk.bgGray(TAG),
          ...args.map((arg) =>
            chalk.green(typeof arg === "string" ? arg : JSON.stringify(arg))
          )
        );
      }
    },
    WARN: (...args: unknown[]) => {
      if (currentLevel <= LOG_LEVEL.WARN) {
        console.log(
          chalk.magenta(timestamp() + "\t"),
          chalk.bgYellow("WARN"),
          "    ",
          chalk.bgGray(TAG),
          ...args.map((arg) =>
            chalk.yellow(typeof arg === "string" ? arg : JSON.stringify(arg))
          )
        );
      }
    },
    ERROR: (...args: unknown[]) => {
      if (currentLevel <= LOG_LEVEL.ERROR) {
        console.log(
          chalk.magenta(timestamp() + "\t"),
          chalk.bgRed("ERROR"),
          "   ",
          chalk.bgGray(TAG),
          ...args.map((arg) =>
            chalk.red(typeof arg === "string" ? arg : JSON.stringify(arg))
          )
        );
      }
    },
  };
};
