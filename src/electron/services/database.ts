import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { ChatMessageRecord, ChatRole, ChatSessionRecord, ChatType } from "../../common/types.js";
import log from "../../common/log.js";
import { getDirs } from "../get-folder.js";
import path from "node:path";

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
      type TEXT NOT NULL CHECK(type IN ('stream','log','plan','user')),
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `;

    const createIdx1 = `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);`;
    const createIdx2 = `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time ON chat_messages(session_id, timestamp);`;

    // Node's sqlite doesn't have built-in transactions like better-sqlite3
    // We'll use BEGIN/COMMIT for transaction support
    try {
      this.db.exec("BEGIN TRANSACTION");
      this.db.exec(createSessions);
      this.db.exec(createMessages);
      this.db.exec(createIdx1);
      this.db.exec(createIdx2);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      log.RED(`Failed to initialize database schema: ${error}`);
      throw error;
    }
  }

  createSession(title: string, id: string = randomUUID()): ChatSessionRecord {
    const now = Date.now();
    const stmt = this.db.prepare(`INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`);
    const record: ChatSessionRecord = { id, title, createdAt: now, updatedAt: now };

    try {
      stmt.run(record.id, record.title, record.createdAt, record.updatedAt);
      return record;
    } catch (error) {
      log.RED(`Failed to create session: ${error}`);
      throw error;
    }
  }

  getSessions(): ChatSessionRecord[] {
    try {
      const stmt = this.db.prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions ORDER BY updated_at DESC`
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
      log.RED(`Failed to get sessions: ${error}`);
      throw error;
    }
  }

  getSessionById(id: string): ChatSessionRecord | null {
    try {
      const stmt = this.db.prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions WHERE id = ?`
      );
      const row = stmt.get(id) as ChatSessionRecord | undefined;
      return row ?? null;
    } catch (error) {
      log.RED(`Failed to get session by id: ${error}`);
      return null;
    }
  }

  updateSessionTitle(id: string, title: string): boolean {
    try {
      const updatedAt = Date.now();
      const stmt = this.db.prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`);
      const result = stmt.run(title, updatedAt, id);
      return result.changes > 0;
    } catch (error) {
      log.RED(`Failed to update session title: ${error}`);
      return false;
    }
  }

  touchSession(id: string, timestamp: number): boolean {
    try {
      const stmt = this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`);
      const result = stmt.run(timestamp, id);
      return result.changes > 0;
    } catch (error) {
      log.RED(`Failed to touch session: ${error}`);
      return false;
    }
  }

  deleteSession(id: string): boolean {
    try {
      const stmt = this.db.prepare(`DELETE FROM sessions WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      log.RED(`Failed to delete session: ${error}`);
      return false;
    }
  }

  addChatMessage(message: ChatMessageRecord): ChatMessageRecord {
    const serializedImages = message.imagePaths ? JSON.stringify(message.imagePaths) : null;
    const insertStmt = this.db.prepare(
      `INSERT INTO chat_messages (id, session_id, content, role, timestamp, is_error, images, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // Make both the insert and session touch atomic using transaction
    try {
      this.db.exec("BEGIN TRANSACTION");

      insertStmt.run(
        message.id,
        message.sessionId,
        message.content,
        message.role,
        message.timestamp,
        message.isError,
        serializedImages,
        message.type
      );

      // Update session timestamp to keep it sorted by recency
      this.touchSession(message.sessionId, message.timestamp);

      this.db.exec("COMMIT");

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
      this.db.exec("ROLLBACK");
      log.RED(`Failed to add chat message: ${err?.message}`);
      return {
        id: message.id,
        sessionId: message.sessionId,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        isError: err?.message || "Unknown error occurred",
        imagePaths: message.imagePaths,
        type: message.type,
      };
    }
  }

  getChatMessagesBySession(sessionId: string): ChatMessageRecord[] {
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
         ORDER BY timestamp ASC`
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
      log.RED(`Failed to get chat messages by session: ${error}`);
      return [];
    }
  }

  deleteChatMessage(id: string): boolean {
    try {
      const stmt = this.db.prepare(`DELETE FROM chat_messages WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      log.RED(`Failed to delete chat message: ${error}`);
      return false;
    }
  }

  deleteChatMessagesBySession(sessionId: string): number {
    try {
      const stmt = this.db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`);
      const result = stmt.run(sessionId);
      return Number(result.changes);
    } catch (error) {
      log.RED(`Failed to delete chat messages by session: ${error}`);
      return 0;
    }
  }

  // Clean up method to close the database connection
  close(): void {
    try {
      if (this.db) {
        this.db.close();
      }
    } catch (error) {
      log.RED(`Failed to close database: ${error}`);
    }
  }
}

export default DatabaseService.getInstance();
