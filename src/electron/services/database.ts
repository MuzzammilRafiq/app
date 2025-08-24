import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { ChatMessageRecord, ChatRole, ChatSessionRecord, ChatType } from "../../common/types.js";
import log from "../../common/log.js";
import { getDirs } from "../get-folder.js";
import path from "path";
// TODO - handle ERRORS
export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: Database;

  private constructor() {
    const { dbDir } = getDirs();
    const dbPath = path.join(dbDir, "database.db");

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
      images TEXT DEFAULT NULL, -- store JSON array (string[]) or NULL
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

  getSessions(): ChatSessionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions ORDER BY updated_at DESC`
      )
      .all();
    return rows as ChatSessionRecord[];
  }

  getSessionById(id: string): ChatSessionRecord | null {
    const row = this.db
      .prepare(`SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions WHERE id = ?`)
      .get(id);
    return (row as ChatSessionRecord) ?? null;
  }

  updateSessionTitle(id: string, title: string): boolean {
    const updatedAt = Date.now();
    const info = this.db
      .prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`)
      .run(title, updatedAt, id);
    return info.changes > 0;
  }

  touchSession(id: string, timestamp: number): boolean {
    const info = this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(timestamp, id);
    return info.changes > 0;
  }

  deleteSession(id: string): boolean {
    const info = this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  addChatMessage(message: ChatMessageRecord): ChatMessageRecord {
    const isError = message.isError ? 1 : 0;
    const serializedImages = message.imagePaths ? JSON.stringify(message.imagePaths) : null;
    const insert = this.db.prepare(
      `INSERT INTO chat_messages (id, session_id, content, role, timestamp, is_error, images, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // Make both the insert and session touch atomic.
    const runAtomic = this.db.transaction(() => {
      insert.run(
        message.id,
        message.sessionId,
        message.content,
        message.role,
        message.timestamp,
        isError,
        serializedImages,
        message.type
      );
      // Update session timestamp to keep it sorted by recency
      this.touchSession(message.sessionId, message.timestamp);
    });

    try {
      runAtomic();
      return {
        id: message.id,
        sessionId: message.sessionId,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        isError: message.isError,
        imagePaths: message.imagePaths,
        type: message.type,
      };
    } catch (err: any) {
      log.RED(err?.message);
      return {
        id: message.id,
        sessionId: message.sessionId,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        isError: err?.message,
        imagePaths: message.imagePaths,
        type: message.type,
      };
    }
  }

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
      imagePaths: string | null;
      type: ChatType;
    }>;
    //@ts-expect-error TODO- here
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      content: row.content,
      role: row.role,
      timestamp: row.timestamp,
      isError: row.isError === 1,
      imagePaths: row.imagePaths,
      type: row.type,
    }));
  }
  deleteChatMessage(id: string): boolean {
    const info = this.db.prepare(`DELETE FROM chat_messages WHERE id = ?`).run(id);
    return info.changes > 0;
  }
  deleteChatMessagesBySession(sessionId: string): number {
    const info = this.db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`).run(sessionId);
    return info.changes;
  }
}
export default DatabaseService.getInstance();
