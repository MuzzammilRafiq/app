export enum Labels {
  TODO = "todo",
  DONE = "done",
  SOURCE = "source",
  LOG = "log",
  ERROR = "error",
  SUCCESS = "success",
  PLAN = "plan",
  STREAM = "stream",
  CHAT = "chat",
  USER = "user",
}

export enum EventChannels {
  // Stream
  STREAM_MESSAGE_WITH_HISTORY = "stream-message-with-history",
  STREAM_CHUNK = "stream-chunk",
  
  // Image Embeddings
  IMAGE_EMBEDDINGS_SEARCH_BY_TEXT = "image-embeddings:search-by-text",
  IMAGE_EMBEDDINGS_DELETE_ALL = "image-embeddings:delete-all",
  IMAGE_EMBEDDINGS_SELECT_FOLDER = "image-embeddings:select-folder",
  IMAGE_EMBEDDINGS_SCAN_FOLDER = "image-embeddings:scan-folder",
  IMAGE_EMBEDDINGS_DELETE_FOLDER = "image-embeddings:delete-folder",
  
  // Text Embeddings
  TEXT_EMBEDDINGS_SEARCH_BY_TEXT = "text-embeddings:search-by-text",
  TEXT_EMBEDDINGS_DELETE_ALL = "text-embeddings:delete-all",
  TEXT_EMBEDDINGS_SELECT_FOLDER = "text-embeddings:select-folder",
  TEXT_EMBEDDINGS_SCAN_FOLDER = "text-embeddings:scan-folder",
  TEXT_EMBEDDINGS_DELETE_FOLDER = "text-embeddings:delete-folder",
  
  // File Operations
  READ_FILE_AS_BUFFER = "read-file-as-buffer",
  GET_CONVERTED_HEIC_PATH = "get-converted-heic-path",
  GET_HEIC_CACHE_STATS = "get-heic-cache-stats",
  CLEANUP_HEIC_CACHE = "cleanup-heic-cache",
  
  // Media
  MEDIA_SAVE_IMAGE = "media:save-image",
  
  // Database
  DB_CREATE_SESSION = "db:create-session",
  DB_GET_SESSIONS = "db:get-sessions",
  DB_GET_SESSION = "db:get-session",
  DB_UPDATE_SESSION_TITLE = "db:update-session-title",
  DB_TOUCH_SESSION = "db:touch-session",
  DB_DELETE_SESSION = "db:delete-session",
  DB_ADD_CHAT_MESSAGE = "db:add-chat-message",
  DB_GET_CHAT_MESSAGES = "db:get-chat-messages",
  DB_DELETE_CHAT_MESSAGE = "db:delete-chat-message",
  DB_DELETE_CHAT_MESSAGES_BY_SESSION = "db:delete-chat-messages-by-session",
  DB_GET_ALL_SESSIONS_WITH_MESSAGES = "db:get-all-sessions-with-messages",
}

export enum MODLES{
  GEMINI_2_5_FLASH = "gemini-2.5-flash",
  KIMI_K2_INSTRUCT = "moonshotai/kimi-k2-instruct",
}