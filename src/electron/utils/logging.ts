import chalk from "chalk";

// Log levels for filtering
export const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
} as const;

type LogLevelName = keyof typeof LOG_LEVEL;

const DEFAULT_STRING_MAX_LEN = 400;
const DEFAULT_MULTILINE_MAX_LEN = 2500;
const DEFAULT_MAX_LINES = 40;

const parseLogLevel = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase() as LogLevelName;
  if (normalized in LOG_LEVEL) {
    return LOG_LEVEL[normalized];
  }

  return undefined;
};

// Current log level - in production, suppress DEBUG unless explicitly overridden
const currentLevel =
  parseLogLevel(process.env.OPEN_DESKTOP_LOG_LEVEL) ??
  parseLogLevel(process.env.LOG_LEVEL) ??
  (process.env.NODE_ENV === "production"
    ? LOG_LEVEL.INFO
    : LOG_LEVEL.DEBUG);

/**
 * Truncate a string to prevent terminal pollution
 */
export const truncate = (str: string, maxLen = 200): string => {
  if (typeof str !== "string") {
    str = String(str);
  }
  return str.length > maxLen
    ? str.slice(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`
    : str;
};

export const truncateLines = (
  value: string,
  maxLen = DEFAULT_MULTILINE_MAX_LEN,
  maxLines = DEFAULT_MAX_LINES,
): string => {
  const text = typeof value === "string" ? value : String(value);
  const allLines = text.split(/\r?\n/);
  const visibleLines = allLines.slice(0, maxLines);
  let preview = visibleLines.join("\n");

  if (preview.length > maxLen) {
    preview = preview.slice(0, maxLen);
  }

  const hiddenChars = Math.max(0, text.length - preview.length);
  const hiddenLines = Math.max(0, allLines.length - visibleLines.length);

  if (hiddenChars === 0 && hiddenLines === 0) {
    return preview;
  }

  const markers: string[] = [];
  if (hiddenLines > 0) {
    markers.push(`${hiddenLines} lines`);
  }
  if (hiddenChars > 0) {
    markers.push(`${hiddenChars} chars`);
  }

  return `${preview}\n...[truncated ${markers.join(", ")}]`;
};

const serializeError = (error: Error) => ({
  name: error.name,
  message: error.message,
  stack: truncateLines(error.stack ?? error.message, 4000, 60),
});

const safeStringify = (value: unknown, maxLen = DEFAULT_MULTILINE_MAX_LEN) => {
  const seen = new WeakSet<object>();

  try {
    const serialized = JSON.stringify(
      value,
      (_key, currentValue: unknown) => {
        if (typeof currentValue === "string") {
          return truncateLines(currentValue, DEFAULT_STRING_MAX_LEN, 12);
        }

        if (currentValue instanceof Error) {
          return serializeError(currentValue);
        }

        if (
          currentValue &&
          typeof currentValue === "object" &&
          !Array.isArray(currentValue)
        ) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }

        return currentValue;
      },
      2,
    );

    return truncateLines(serialized, maxLen, 60);
  } catch {
    return "[JSON serialization failed]";
  }
};

const formatArg = (arg: unknown): string => {
  if (arg instanceof Error) {
    return safeStringify(serializeError(arg), 4000);
  }

  if (typeof arg === "string") {
    return truncateLines(arg, DEFAULT_MULTILINE_MAX_LEN, DEFAULT_MAX_LINES);
  }

  if (
    typeof arg === "number" ||
    typeof arg === "boolean" ||
    arg === null ||
    arg === undefined
  ) {
    return String(arg);
  }

  return safeStringify(arg);
};

/**
 * Smart JSON print - truncates large objects
 */
export const JSON_PRINT = (obj: unknown, maxLen = 500): string => {
  try {
    return "\n" + safeStringify(obj, maxLen) + "\n";
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
  const formatArgs = (args: unknown[]) => args.map((arg) => formatArg(arg));

  return {
    DEBUG: (...args: unknown[]) => {
      if (currentLevel <= LOG_LEVEL.DEBUG) {
        console.log(
          chalk.dim(timestamp() + "\t"),
          chalk.bgGray("DEBUG"),
          "   ",
          chalk.gray(TAG),
          ...formatArgs(args).map((arg) => chalk.dim(arg)),
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
          ...formatArgs(args).map((arg) => chalk.blue(arg)),
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
          ...formatArgs(args).map((arg) => chalk.green(arg)),
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
          ...formatArgs(args).map((arg) => chalk.yellow(arg)),
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
          ...formatArgs(args).map((arg) => chalk.red(arg)),
        );
      }
    },
  };
};
