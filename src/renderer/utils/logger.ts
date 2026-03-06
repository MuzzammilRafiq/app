const DEFAULT_STRING_MAX_LEN = 400;
const DEFAULT_MULTILINE_MAX_LEN = 2000;
const DEFAULT_MAX_LINES = 30;

export const truncate = (value: string, maxLen = DEFAULT_STRING_MAX_LEN) => {
  const text = typeof value === "string" ? value : String(value);
  return text.length > maxLen
    ? `${text.slice(0, maxLen)}...[truncated ${text.length - maxLen} chars]`
    : text;
};

export const truncateLines = (
  value: string,
  maxLen = DEFAULT_MULTILINE_MAX_LEN,
  maxLines = DEFAULT_MAX_LINES,
) => {
  const text = typeof value === "string" ? value : String(value);
  const lines = text.split(/\r?\n/);
  const visibleLines = lines.slice(0, maxLines);
  let preview = visibleLines.join("\n");

  if (preview.length > maxLen) {
    preview = preview.slice(0, maxLen);
  }

  const hiddenChars = Math.max(0, text.length - preview.length);
  const hiddenLines = Math.max(0, lines.length - visibleLines.length);

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
  stack: truncateLines(error.stack ?? error.message, 3000, 40),
});

const safeStringify = (value: unknown) => {
  const seen = new WeakSet<object>();

  try {
    return truncateLines(
      JSON.stringify(
        value,
        (_key, currentValue: unknown) => {
          if (typeof currentValue === "string") {
            return truncateLines(currentValue, DEFAULT_STRING_MAX_LEN, 10);
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
      ),
      DEFAULT_MULTILINE_MAX_LEN,
      DEFAULT_MAX_LINES,
    );
  } catch {
    return "[JSON serialization failed]";
  }
};

const formatArg = (arg: unknown) => {
  if (arg instanceof Error) {
    return safeStringify(serializeError(arg));
  }
  if (typeof arg === "string") {
    return truncateLines(arg);
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

const timestamp = () => new Date().toISOString();

const emit = (
  method: "debug" | "info" | "warn" | "error",
  level: string,
  tag: string,
  args: unknown[],
) => {
  console[method](`[${timestamp()}] [${level}] [${tag}]`, ...args.map(formatArg));
};

export const createRendererLogger = (tag: string) => ({
  DEBUG: (...args: unknown[]) => emit("debug", "DEBUG", tag, args),
  INFO: (...args: unknown[]) => emit("info", "INFO", tag, args),
  WARN: (...args: unknown[]) => emit("warn", "WARN", tag, args),
  ERROR: (...args: unknown[]) => emit("error", "ERROR", tag, args),
});