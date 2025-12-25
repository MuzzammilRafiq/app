import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  ChatMessageRecord,
  ChatRole,
  ChatSessionRecord,
  ChatType,
  ChatSessionWithMessages,
} from "../../common/types.js";
import { getDirs } from "../get-folder.js";
import path from "node:path";
import { LOG } from "../utils/logging.js";

const TAG = "database";

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: DatabaseSync;

  private constructor() {
    const { dbDir } = getDirs();
    const dbPath = path.join(dbDir, "database.db");

    this.db = new DatabaseSync(dbPath);
    // Safer defaults for desktop apps
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.initializeSchema();
  }

  static getInstance(): DatabaseService {
    if (DatabaseService.instance === null) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initializeSchema(): void {
    const createSessions = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `;

    const createMessages = `
      CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      content TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','execution')),
      timestamp INTEGER NOT NULL,
      is_error TEXT NOT NULL DEFAULT '',
      images TEXT DEFAULT NULL, -- store JSON array (string[]) or NULL
      type TEXT NOT NULL CHECK(type IN ('stream','log','plan','user','source')),
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `;

    const createIdx1 = `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);`;
    const createIdx2 = `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time ON chat_messages(session_id, timestamp);`;

    try {
      this.db.exec("BEGIN TRANSACTION");
      this.db.exec(createSessions);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR("Failed to initialize sessions schema: " + error);
      throw error;
    }

    // Ensure chat_messages table exists with updated CHECK including 'source'
    try {
      const getTableSql = this.db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_messages'",
      );
      const row = getTableSql.get() as { sql: string } | undefined;

      if (!row) {
        // Table doesn't exist; create fresh with updated schema
        this.db.exec("BEGIN TRANSACTION");
        this.db.exec(createMessages);
        this.db.exec(createIdx1);
        this.db.exec(createIdx2);
        this.db.exec("COMMIT");
      } else if (!row.sql.includes("'source'")) {
        // Migrate table to include 'source' in CHECK constraint
        LOG(TAG).WARN(
          "Migrating chat_messages schema to include 'source' type..."
        );
        try {
          this.db.exec("PRAGMA foreign_keys = OFF");
          this.db.exec("BEGIN TRANSACTION");

          // Create new table with correct schema
          this.db.exec(
            `CREATE TABLE chat_messages_new (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              content TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('user','assistant','execution')),
              timestamp INTEGER NOT NULL,
              is_error TEXT NOT NULL DEFAULT '',
              images TEXT DEFAULT NULL,
              type TEXT NOT NULL CHECK(type IN ('stream','log','plan','user','source')),
              FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );`,
          );

          // Copy data
          this.db.exec(
            `INSERT INTO chat_messages_new (id, session_id, content, role, timestamp, is_error, images, type)
             SELECT id, session_id, content, role, timestamp, is_error, images, type FROM chat_messages;`,
          );

          // Drop old and rename new
          this.db.exec(`DROP TABLE chat_messages;`);
          this.db.exec(
            `ALTER TABLE chat_messages_new RENAME TO chat_messages;`,
          );

          // Recreate indexes
          this.db.exec(createIdx1);
          this.db.exec(createIdx2);

          this.db.exec("COMMIT");
        } catch (err) {
          this.db.exec("ROLLBACK");
          LOG(TAG).ERROR(`Failed to migrate chat_messages schema: ${err}`);
          throw err;
        } finally {
          this.db.exec("PRAGMA foreign_keys = ON");
        }
      } else {
        // Table exists and already supports 'source'; ensure indexes
        this.db.exec("BEGIN TRANSACTION");
        this.db.exec(createIdx1);
        this.db.exec(createIdx2);
        this.db.exec("COMMIT");
      }
    } catch (error) {
      LOG(TAG).ERROR(`Failed to ensure chat_messages schema: ${error}`);
      throw error;
    }
  }

  private validateInput(
    value: any,
    name: string,
    allowEmpty: boolean = false,
  ): void {
    if (value === null || value === undefined) {
      throw new Error(`${name} cannot be null or undefined`);
    }
    if (typeof value === "string" && !allowEmpty && value.trim() === "") {
      throw new Error(`${name} cannot be empty`);
    }
  }

  createSession(title: string, id: string = randomUUID()): ChatSessionRecord {
    this.validateInput(title, "title");
    this.validateInput(id, "id");

    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    );
    const record: ChatSessionRecord = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
    };

    try {
      stmt.run(record.id, record.title, record.createdAt, record.updatedAt);
      return record;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to create session: ${error}`);
      throw new Error(`Failed to create session: ${error}`);
    }
  }

  getSessions(): ChatSessionRecord[] {
    try {
      const stmt = this.db.prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions ORDER BY updated_at DESC`,
      );
      const rows = stmt.all() as Array<{
        id: string;
        title: string;
        createdAt: number;
        updatedAt: number;
      }>;
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get sessions: ${error}`);
      throw new Error(`Failed to get sessions: ${error}`);
    }
  }

  getSessionById(id: string): ChatSessionRecord | null {
    this.validateInput(id, "id");

    try {
      const stmt = this.db.prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions WHERE id = ?`,
      );
      const row = stmt.get(id) as ChatSessionRecord | undefined;
      return row ?? null;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get session by id: ${error}`);
      throw new Error(`Failed to get session by id: ${error}`);
    }
  }

  /**
   * Retrieve a single chat session together with all of its messages (ascending by timestamp).
   * Returns null if the session does not exist.
   */
  getSessionWithMessages(sessionId: string): ChatSessionWithMessages | null {
    this.validateInput(sessionId, "sessionId");

    try {
      const session = this.getSessionById(sessionId);
      if (!session) return null;
      const messages = this.getChatMessagesBySession(sessionId);
      return { ...session, messages };
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get session with messages: ${error}`);
      throw new Error(`Failed to get session with messages: ${error}`);
    }
  }

  updateSessionTitle(id: string, title: string): boolean {
    this.validateInput(id, "id");
    this.validateInput(title, "title");

    try {
      const updatedAt = Date.now();
      const stmt = this.db.prepare(
        `UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`,
      );
      const result = stmt.run(title, updatedAt, id);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to update session title: ${error}`);
      throw new Error(`Failed to update session title: ${error}`);
    }
  }

  touchSession(id: string, timestamp: number): ChatSessionRecord {
    this.validateInput(id, "id");
    if (typeof timestamp !== "number" || timestamp <= 0) {
      throw new Error("timestamp must be a positive number");
    }

    try {
      const stmt = this.db.prepare(
        `UPDATE sessions SET updated_at = ? WHERE id = ?`,
      );
      const result = stmt.run(timestamp, id);
      if (result.changes === 0) {
        throw new Error(`Session with id ${id} not found`);
      }
      const session = this.getSessionById(id);
      if (!session) {
        throw new Error(`Session with id ${id} not found after update`);
      }
      return session;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to touch session: ${error}`);
      throw new Error(`Failed to touch session: ${error}`);
    }
  }

  deleteSession(id: string): boolean {
    this.validateInput(id, "id");

    try {
      const stmt = this.db.prepare(`DELETE FROM sessions WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to delete session: ${error}`);
      throw new Error(`Failed to delete session: ${error}`);
    }
  }

  addChatMessage(message: ChatMessageRecord): ChatMessageRecord {
    // Input validation
    this.validateInput(message.id, "message.id");
    this.validateInput(message.sessionId, "message.sessionId");
    this.validateInput(message.content, "message.content", true); // Allow empty content
    this.validateInput(message.role, "message.role");
    this.validateInput(message.type, "message.type");

    if (typeof message.timestamp !== "number" || message.timestamp <= 0) {
      throw new Error("message.timestamp must be a positive number");
    }

    // Validate role and type against allowed values
    const validRoles: ChatRole[] = ["user", "assistant", "execution"];
    const validTypes: ChatType[] = ["stream", "log", "plan", "user", "source"];

    if (!validRoles.includes(message.role)) {
      throw new Error(
        `Invalid role: ${message.role}. Must be one of: ${validRoles.join(", ")}`,
      );
    }

    if (!validTypes.includes(message.type)) {
      throw new Error(
        `Invalid type: ${message.type}. Must be one of: ${validTypes.join(", ")}`,
      );
    }

    const serializedImages = message.imagePaths
      ? JSON.stringify(message.imagePaths)
      : null;
    const insertStmt = this.db.prepare(
      `INSERT INTO chat_messages (id, session_id, content, role, timestamp, is_error, images, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    try {
      this.db.exec("BEGIN TRANSACTION");

      insertStmt.run(
        message.id,
        message.sessionId,
        message.content,
        message.role,
        message.timestamp,
        message.isError || "",
        serializedImages,
        message.type,
      );

      // Update session timestamp to keep it sorted by recency
      // If this fails, we want to rollback the entire transaction
      this.touchSession(message.sessionId, message.timestamp);

      this.db.exec("COMMIT");

      return {
        id: message.id,
        sessionId: message.sessionId,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        isError: message.isError || "",
        imagePaths: message.imagePaths,
        type: message.type,
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR(`Failed to add chat message: ${error}`);
      throw new Error(`Failed to add chat message: ${error}`);
    }
  }

  getChatMessagesBySession(sessionId: string): ChatMessageRecord[] {
    this.validateInput(sessionId, "sessionId");

    try {
      const stmt = this.db.prepare(
        `SELECT id,
                session_id as sessionId,
                content,
                role,
                timestamp,
                is_error as isError,
                images,
                type
         FROM chat_messages
         WHERE session_id = ?
         ORDER BY timestamp ASC`,
      );

      const rows = stmt.all(sessionId) as Array<{
        id: string;
        sessionId: string;
        content: string;
        role: ChatRole;
        timestamp: number;
        isError: string;
        images: string | null;
        type: ChatType;
      }>;

      return rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        content: row.content,
        role: row.role,
        timestamp: row.timestamp,
        isError: row.isError,
        imagePaths: row.images ? JSON.parse(row.images) : null,
        type: row.type,
      }));
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get chat messages by session: ${error}`);
      throw new Error(`Failed to get chat messages by session: ${error}`);
    }
  }

  /**
   * Retrieve sessions with their messages using a single optimized SQL query.
   * Sessions are ordered by updatedAt descending and limited by the provided limit (number of sessions, NOT messages).
   * Messages within each session are ordered ascending by timestamp.
   * If limit = -1 (default) all sessions are returned.
   */
  getAllSessionsWithMessages(limit: number = -1): ChatSessionWithMessages[] {
    if (limit !== -1 && (typeof limit !== "number" || limit <= 0)) {
      throw new Error("limit must be -1 or a positive number");
    }

    try {
      // Single query with JOIN to get sessions and their messages
      // Using a subquery to limit sessions first, then join with messages
      const baseSessionQuery = `SELECT id FROM sessions ORDER BY updated_at DESC`;
      const sessionQuery =
        limit === -1 ? baseSessionQuery : `${baseSessionQuery} LIMIT ?`;

      const query = `
        SELECT 
          s.id as sessionId,
          s.title,
          s.created_at as sessionCreatedAt,
          s.updated_at as sessionUpdatedAt,
          m.id as messageId,
          m.content,
          m.role,
          m.timestamp,
          m.is_error as isError,
          m.images,
          m.type
        FROM (${sessionQuery}) limited_sessions
        JOIN sessions s ON s.id = limited_sessions.id
        LEFT JOIN chat_messages m ON s.id = m.session_id
        ORDER BY s.updated_at DESC, m.timestamp ASC
      `;

      const stmt = this.db.prepare(query);
      const rows = (limit === -1 ? stmt.all() : stmt.all(limit)) as Array<{
        sessionId: string;
        title: string;
        sessionCreatedAt: number;
        sessionUpdatedAt: number;
        messageId: string | null;
        content: string | null;
        role: ChatRole | null;
        timestamp: number | null;
        isError: string | null;
        images: string | null;
        type: ChatType | null;
      }>;

      // Group the results by session
      const sessionsMap = new Map<string, ChatSessionWithMessages>();

      for (const row of rows) {
        if (!sessionsMap.has(row.sessionId)) {
          sessionsMap.set(row.sessionId, {
            id: row.sessionId,
            title: row.title,
            createdAt: row.sessionCreatedAt,
            updatedAt: row.sessionUpdatedAt,
            messages: [],
          });
        }

        // Add message if it exists (LEFT JOIN can produce null messages for sessions without messages)
        if (row.messageId) {
          const session = sessionsMap.get(row.sessionId)!;
          session.messages.push({
            id: row.messageId,
            sessionId: row.sessionId,
            content: row.content!,
            role: row.role!,
            timestamp: row.timestamp!,
            isError: row.isError || "",
            imagePaths: row.images ? JSON.parse(row.images) : null,
            type: row.type!,
          });
        }
      }

      return Array.from(sessionsMap.values());
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get all sessions with messages: ${error}`);
      throw new Error(`Failed to get all sessions with messages: ${error}`);
    }
  }

  deleteChatMessage(id: string): boolean {
    this.validateInput(id, "id");

    try {
      const stmt = this.db.prepare(`DELETE FROM chat_messages WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to delete chat message: ${error}`);
      throw new Error(`Failed to delete chat message: ${error}`);
    }
  }

  deleteChatMessagesBySession(sessionId: string): number {
    this.validateInput(sessionId, "sessionId");

    try {
      const stmt = this.db.prepare(
        `DELETE FROM chat_messages WHERE session_id = ?`,
      );
      const result = stmt.run(sessionId);
      return Number(result.changes);
    } catch (error) {
      LOG(TAG).ERROR(`Failed to delete chat messages by session: ${error}`);
      throw new Error(`Failed to delete chat messages by session: ${error}`);
    }
  }

  // Clean up method to close the database connection
  close(): void {
    try {
      if (this.db) {
        this.db.close();
      }
    } catch (error) {
      LOG(TAG).ERROR(`Failed to close database: ${error}`);
    }
  }
}

export default DatabaseService.getInstance();
