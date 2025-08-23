import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { ChatMessageRecord, ChatRole, ChatSessionRecord, ChatType } from "../../common/types.js";

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: Database;

  private constructor() {
    //TODO handle path using electron.app.getPath()
    // Choose a per-user application data path; keep a separate db file for dev.
    const isDev = process.env.NODE_ENV === "development";
    let dbPath = "./db/database.dev.db";
    // if (!isDev) {
    //   dbPath = path.join(app.getPath("userData"), "database.db");
    // }

    this.db = new Database(dbPath);
    // Safer defaults for desktop apps
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.initializeSchema();
  }

  static getInstance(): DatabaseService {
    if (DatabaseService.instance === null) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Creates the `sessions` and `chat_messages` tables and supporting indexes if they don't exist.
   * Runs inside a transaction for atomicity.
   */
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
        is_error INTEGER NOT NULL DEFAULT 0,
        images TEXT,
        type TEXT NOT NULL CHECK(type IN ('stream','log','plan')),
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `;

    const createIdx1 = `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);`;
    const createIdx2 = `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time ON chat_messages(session_id, timestamp);`;

    const stmt = this.db.prepare("SELECT 1");
    const trx = this.db.transaction(() => {
      stmt.run();
      this.db.exec(createSessions);
      this.db.exec(createMessages);
      this.db.exec(createIdx1);
      this.db.exec(createIdx2);
    });
    trx();
  }

  // Session CRUD
  /**
   * Creates a new chat session row.
   * If `id` is not provided, a timestamp-based string id is used.
   */
  createSession(title: string, id: string = randomUUID()): ChatSessionRecord {
    const now = Date.now();
    // NOTE: Use positional parameters because named parameters in bun:sqlite require the prefix
    // to be part of the object key (e.g. {"$id": id}). Previous code passed keys without prefixes
    // causing all placeholders to bind as NULL and triggering NOT NULL constraint errors.
    const insert = this.db.prepare(`INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`);
    const record: ChatSessionRecord = { id, title, createdAt: now, updatedAt: now };
    insert.run(record.id, record.title, record.createdAt, record.updatedAt);
    return record;
  }

  /**
   * Returns all sessions ordered by most recently updated first.
   */
  getSessions(): ChatSessionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions ORDER BY updated_at DESC`
      )
      .all();
    return rows as ChatSessionRecord[];
  }

  /**
   * Retrieves a single session by id, or null if not found.
   */
  getSessionById(id: string): ChatSessionRecord | null {
    const row = this.db
      .prepare(`SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions WHERE id = ?`)
      .get(id);
    return (row as ChatSessionRecord) ?? null;
  }

  /**
   * Updates the session title and bumps its `updatedAt` timestamp.
   */
  updateSessionTitle(id: string, title: string): boolean {
    const updatedAt = Date.now();
    const info = this.db
      .prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`)
      .run(title, updatedAt, id);
    return info.changes > 0;
  }

  /**
   * Touches a session to mark it as recently updated without changing content.
   */
  touchSession(id: string): boolean {
    const updatedAt = Date.now();
    const info = this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(updatedAt, id);
    return info.changes > 0;
  }

  /**
   * Deletes a session; cascades to delete related chat messages via FK.
   */
  deleteSession(id: string): boolean {
    const info = this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  // Message CRUD
  /**
   * Adds a chat message for a session. Serializes `images` as JSON if provided,
   * converts Date timestamps to epoch ms, and touches the parent session for recency.
   */
  addChatMessage(message: {
    id?: string;
    sessionId: string;
    content: string;
    role: ChatRole;
    timestamp?: number | Date;
    isError?: boolean;
    images?: unknown[] | null; // ImageData[] shape from renderer
    type: ChatType;
  }): ChatMessageRecord {
    const id = message.id ?? randomUUID();
    const ts = message.timestamp instanceof Date ? message.timestamp.getTime() : (message.timestamp ?? Date.now());
    const imagesJson = message.images == null ? null : JSON.stringify(message.images);
    const isError = message.isError ? 1 : 0;
    const insert = this.db.prepare(
      `INSERT INTO chat_messages (id, session_id, content, role, timestamp, is_error, images, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insert.run(id, message.sessionId, message.content, message.role, ts, isError, imagesJson, message.type);

    // Update session timestamp to keep it sorted by recency
    this.touchSession(message.sessionId);

    return {
      id,
      sessionId: message.sessionId,
      content: message.content,
      role: message.role,
      timestamp: ts,
      isError: Boolean(isError),
      images: imagesJson,
      type: message.type,
    };
  }

  /**
   * Returns all messages for a session ordered by ascending time.
   * Note: `images` remains a JSON string; deserialize at call site if needed.
   */
  getChatMessagesBySession(sessionId: string): ChatMessageRecord[] {
    const rows = this.db
      .prepare(
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
         ORDER BY timestamp ASC`
      )
      .all(sessionId) as Array<{
      id: string;
      sessionId: string;
      content: string;
      role: ChatRole;
      timestamp: number;
      isError: 0 | 1;
      images: string | null;
      type: ChatType;
    }>;
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      content: row.content,
      role: row.role,
      timestamp: row.timestamp,
      isError: row.isError === 1,
      images: row.images,
      type: row.type,
    }));
  }

  /**
   * Deletes a single message by id.
   */
  deleteChatMessage(id: string): boolean {
    const info = this.db.prepare(`DELETE FROM chat_messages WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  /**
   * Deletes all messages under a given session id.
   * Returns number of rows removed.
   */
  deleteChatMessagesBySession(sessionId: string): number {
    const info = this.db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`).run(sessionId);
    return info.changes;
  }
}

// Export a shared singleton to reuse the same connection across the app.
const dbService = DatabaseService.getInstance();
export default dbService;

if (require.main === module) {
  // console.log(dbService.createSession("test"));
  console.log(dbService.getSessions());
}
