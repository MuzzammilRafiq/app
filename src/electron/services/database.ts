import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  ChatMessageRecord,
  ChatRole,
  ChatSessionRecord,
  ChatType,
  ChatSessionWithMessages,
  MakePlanResponse,
  VisionSessionRecord,
  VisionLogRecord,
  VisionLogType,
  VisionSessionStatus,
  VisionSessionWithLogs,
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
      type TEXT NOT NULL CHECK(type IN ('stream','log','plan','user','source','terminal-confirmation')),
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
      } else if (
        !row.sql.includes("'cancelled'") ||
        !row.sql.includes("'terminal-confirmation'")
      ) {
        // Migrate table to include 'cancelled' and 'terminal-confirmation' in CHECK constraint
        LOG(TAG).WARN(
          "Migrating chat_messages schema to include new message types...",
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
              type TEXT NOT NULL CHECK(type IN ('stream','log','plan','user','source','cancelled','terminal-confirmation')),
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
        // Table exists and already supports 'cancelled'; ensure indexes
        this.db.exec("BEGIN TRANSACTION");
        this.db.exec(createIdx1);
        this.db.exec(createIdx2);
        this.db.exec("COMMIT");
      }
    } catch (error) {
      LOG(TAG).ERROR(`Failed to ensure chat_messages schema: ${error}`);
      throw error;
    }
    // Plan steps table for persistent plan progress
    try {
      this.db.exec("BEGIN TRANSACTION");
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS plan_steps (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          plan_hash TEXT NOT NULL,
          step_number INTEGER NOT NULL,
          tool_name TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('todo','done')),
          updated_at INTEGER NOT NULL,
          UNIQUE(session_id, plan_hash, step_number),
          FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
      `);
      this.db.exec(
        `CREATE INDEX IF NOT EXISTS idx_plan_steps_session_hash ON plan_steps(session_id, plan_hash);`,
      );
      this.db.exec(
        `CREATE INDEX IF NOT EXISTS idx_plan_steps_session ON plan_steps(session_id);`,
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR(`Failed to ensure plan_steps schema: ${error}`);
      throw error;
    }

    // RAG folders table for tracking indexed folders
    try {
      this.db.exec("BEGIN TRANSACTION");
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rag_folders (
          id TEXT PRIMARY KEY,
          folder_path TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL CHECK(type IN ('image','text')),
          last_scanned_at INTEGER,
          created_at INTEGER NOT NULL
        );
      `);
      this.db.exec(
        `CREATE INDEX IF NOT EXISTS idx_rag_folders_type ON rag_folders(type);`,
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR(`Failed to ensure rag_folders schema: ${error}`);
      throw error;
    }

    // Vision sessions table for tracking automation workflows
    try {
      this.db.exec("BEGIN TRANSACTION");
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS vision_sessions (
          id TEXT PRIMARY KEY,
          goal TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('running','completed','failed','cancelled'))
        );
      `);
      this.db.exec(
        `CREATE INDEX IF NOT EXISTS idx_vision_sessions_status ON vision_sessions(status);`,
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR(`Failed to ensure vision_sessions schema: ${error}`);
      throw error;
    }

    // Vision logs table for storing automation step logs
    const createVisionLogs = `
        CREATE TABLE IF NOT EXISTS vision_logs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('server','llm-request','llm-response','thinking','status','vision-status','error','image-preview')),
          title TEXT NOT NULL,
          content TEXT DEFAULT '',
          image_path TEXT DEFAULT NULL,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY(session_id) REFERENCES vision_sessions(id) ON DELETE CASCADE
        );
      `;
    const createVisionIdx1 = `CREATE INDEX IF NOT EXISTS idx_vision_logs_session ON vision_logs(session_id);`;
    const createVisionIdx2 = `CREATE INDEX IF NOT EXISTS idx_vision_logs_session_time ON vision_logs(session_id, timestamp);`;

    try {
      const getTableSql = this.db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='vision_logs'",
      );
      const row = getTableSql.get() as { sql: string } | undefined;

      if (!row) {
        this.db.exec("BEGIN TRANSACTION");
        this.db.exec(createVisionLogs);
        this.db.exec(createVisionIdx1);
        this.db.exec(createVisionIdx2);
        this.db.exec("COMMIT");
      } else if (!row.sql.includes("'vision-status'")) {
        LOG(TAG).WARN(
          "Migrating vision_logs schema to include 'vision-status' type...",
        );
        try {
          this.db.exec("PRAGMA foreign_keys = OFF");
          this.db.exec("BEGIN TRANSACTION");
          this.db.exec(
            `CREATE TABLE vision_logs_new (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              type TEXT NOT NULL CHECK(type IN ('server','llm-request','llm-response','thinking','status','vision-status','error','image-preview')),
              title TEXT NOT NULL,
              content TEXT DEFAULT '',
              image_path TEXT DEFAULT NULL,
              timestamp INTEGER NOT NULL,
              FOREIGN KEY(session_id) REFERENCES vision_sessions(id) ON DELETE CASCADE
            );`,
          );
          this.db.exec(
            `INSERT INTO vision_logs_new (id, session_id, type, title, content, image_path, timestamp)
             SELECT id, session_id, type, title, content, image_path, timestamp FROM vision_logs;`,
          );
          this.db.exec(`DROP TABLE vision_logs;`);
          this.db.exec(`ALTER TABLE vision_logs_new RENAME TO vision_logs;`);
          this.db.exec(createVisionIdx1);
          this.db.exec(createVisionIdx2);
          this.db.exec("COMMIT");
        } catch (err) {
          this.db.exec("ROLLBACK");
          LOG(TAG).ERROR(`Failed to migrate vision_logs schema: ${err}`);
          throw err;
        } finally {
          this.db.exec("PRAGMA foreign_keys = ON");
        }
      } else {
        this.db.exec("BEGIN TRANSACTION");
        this.db.exec(createVisionIdx1);
        this.db.exec(createVisionIdx2);
        this.db.exec("COMMIT");
      }
    } catch (error) {
      LOG(TAG).ERROR(`Failed to ensure vision_logs schema: ${error}`);
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
    const validTypes: ChatType[] = [
      "stream",
      "log",
      "plan",
      "user",
      "source",
      "cancelled",
      "terminal-confirmation",
    ];

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

      const updateStmt = this.db.prepare(
        `UPDATE sessions SET updated_at = ? WHERE id = ?`,
      );
      const updateResult = updateStmt.run(message.timestamp, message.sessionId);
      if (updateResult.changes === 0) {
        throw new Error(`Session with id ${message.sessionId} not found`);
      }

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

  // ---------------- Plan steps APIs ----------------
  upsertPlanSteps(
    sessionId: string,
    planHash: string,
    steps: MakePlanResponse[],
  ): void {
    this.validateInput(sessionId, "sessionId");
    this.validateInput(planHash, "planHash");
    if (!Array.isArray(steps)) {
      throw new Error("steps must be an array");
    }
    try {
      this.db.exec("BEGIN TRANSACTION");
      const stmt = this.db.prepare(`
        INSERT INTO plan_steps (id, session_id, plan_hash, step_number, tool_name, description, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id, plan_hash, step_number)
        DO UPDATE SET status=excluded.status, tool_name=excluded.tool_name, description=excluded.description, updated_at=excluded.updated_at
      `);
      const now = Date.now();
      for (const s of steps) {
        const id = randomUUID();
        stmt.run(
          id,
          sessionId,
          planHash,
          s.step_number,
          s.tool_name,
          s.description,
          s.status ?? "todo",
          now,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR(`Failed to upsert plan steps: ${error}`);
      throw error;
    }
  }

  markPlanStepDone(
    sessionId: string,
    planHash: string,
    stepNumber: number,
  ): boolean {
    this.validateInput(sessionId, "sessionId");
    this.validateInput(planHash, "planHash");
    if (typeof stepNumber !== "number" || stepNumber <= 0) {
      throw new Error("stepNumber must be a positive number");
    }
    try {
      const stmt = this.db.prepare(`
        UPDATE plan_steps SET status='done', updated_at=? 
        WHERE session_id=? AND plan_hash=? AND step_number=?
      `);
      const res = stmt.run(Date.now(), sessionId, planHash, stepNumber);
      return res.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to mark plan step done: ${error}`);
      throw error;
    }
  }

  getPlanSteps(sessionId: string, planHash: string): Array<MakePlanResponse> {
    this.validateInput(sessionId, "sessionId");
    this.validateInput(planHash, "planHash");
    try {
      const stmt = this.db.prepare(`
        SELECT step_number, tool_name, description, status 
        FROM plan_steps 
        WHERE session_id=? AND plan_hash=?
        ORDER BY step_number ASC
      `);
      const rows = stmt.all(sessionId, planHash) as Array<{
        step_number: number;
        tool_name: string;
        description: string;
        status: "todo" | "done";
      }>;
      return rows.map((r) => ({
        step_number: r.step_number,
        tool_name: r.tool_name,
        description: r.description,
        status: r.status,
      }));
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get plan steps: ${error}`);
      throw error;
    }
  }

  // ---------------- RAG Folders APIs ----------------

  /**
   * RAG folder record type
   */
  getRagFolders(
    type: "image" | "text",
  ): Array<{ folderPath: string; lastScannedAt: number | null }> {
    if (type !== "image" && type !== "text") {
      throw new Error("type must be 'image' or 'text'");
    }
    try {
      const stmt = this.db.prepare(`
        SELECT folder_path, last_scanned_at
        FROM rag_folders
        WHERE type = ?
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(type) as Array<{
        folder_path: string;
        last_scanned_at: number | null;
      }>;
      return rows.map((r) => ({
        folderPath: r.folder_path,
        lastScannedAt: r.last_scanned_at,
      }));
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get RAG folders: ${error}`);
      throw error;
    }
  }

  addRagFolder(
    folderPath: string,
    type: "image" | "text",
    lastScannedAt?: number,
  ): { folderPath: string; lastScannedAt: number | null } {
    this.validateInput(folderPath, "folderPath");
    if (type !== "image" && type !== "text") {
      throw new Error("type must be 'image' or 'text'");
    }
    try {
      const id = randomUUID();
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO rag_folders (id, folder_path, type, last_scanned_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(folder_path) DO UPDATE SET last_scanned_at = excluded.last_scanned_at
      `);
      stmt.run(id, folderPath, type, lastScannedAt ?? null, now);
      return {
        folderPath,
        lastScannedAt: lastScannedAt ?? null,
      };
    } catch (error) {
      LOG(TAG).ERROR(`Failed to add RAG folder: ${error}`);
      throw error;
    }
  }

  updateRagFolderScanTime(folderPath: string, lastScannedAt: number): boolean {
    this.validateInput(folderPath, "folderPath");
    if (typeof lastScannedAt !== "number" || lastScannedAt <= 0) {
      throw new Error("lastScannedAt must be a positive number");
    }
    try {
      const stmt = this.db.prepare(`
        UPDATE rag_folders SET last_scanned_at = ? WHERE folder_path = ?
      `);
      const result = stmt.run(lastScannedAt, folderPath);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to update RAG folder scan time: ${error}`);
      throw error;
    }
  }

  deleteRagFolder(folderPath: string): boolean {
    this.validateInput(folderPath, "folderPath");
    try {
      const stmt = this.db.prepare(
        `DELETE FROM rag_folders WHERE folder_path = ?`,
      );
      const result = stmt.run(folderPath);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to delete RAG folder: ${error}`);
      throw error;
    }
  }

  // ---------------- Vision Session APIs ----------------

  createVisionSession(
    goal: string,
    id: string = randomUUID(),
  ): VisionSessionRecord {
    this.validateInput(goal, "goal");
    this.validateInput(id, "id");

    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO vision_sessions (id, goal, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?)`,
    );
    const record: VisionSessionRecord = {
      id,
      goal,
      createdAt: now,
      updatedAt: now,
      status: "running",
    };

    try {
      stmt.run(
        record.id,
        record.goal,
        record.createdAt,
        record.updatedAt,
        record.status,
      );
      return record;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to create vision session: ${error}`);
      throw new Error(`Failed to create vision session: ${error}`);
    }
  }

  getVisionSessions(): VisionSessionRecord[] {
    try {
      const stmt = this.db.prepare(
        `SELECT id, goal, created_at as createdAt, updated_at as updatedAt, status FROM vision_sessions ORDER BY updated_at DESC`,
      );
      const rows = stmt.all() as Array<{
        id: string;
        goal: string;
        createdAt: number;
        updatedAt: number;
        status: VisionSessionStatus;
      }>;
      return rows.map((row) => ({
        id: row.id,
        goal: row.goal,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        status: row.status,
      }));
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get vision sessions: ${error}`);
      throw new Error(`Failed to get vision sessions: ${error}`);
    }
  }

  getVisionSessionById(id: string): VisionSessionRecord | null {
    this.validateInput(id, "id");

    try {
      const stmt = this.db.prepare(
        `SELECT id, goal, created_at as createdAt, updated_at as updatedAt, status FROM vision_sessions WHERE id = ?`,
      );
      const row = stmt.get(id) as VisionSessionRecord | undefined;
      return row ?? null;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get vision session by id: ${error}`);
      throw new Error(`Failed to get vision session by id: ${error}`);
    }
  }

  updateVisionSessionStatus(id: string, status: VisionSessionStatus): boolean {
    this.validateInput(id, "id");
    const validStatuses: VisionSessionStatus[] = [
      "running",
      "completed",
      "failed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    try {
      const updatedAt = Date.now();
      const stmt = this.db.prepare(
        `UPDATE vision_sessions SET status = ?, updated_at = ? WHERE id = ?`,
      );
      const result = stmt.run(status, updatedAt, id);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to update vision session status: ${error}`);
      throw new Error(`Failed to update vision session status: ${error}`);
    }
  }

  deleteVisionSession(id: string): boolean {
    this.validateInput(id, "id");

    try {
      const stmt = this.db.prepare(`DELETE FROM vision_sessions WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      LOG(TAG).ERROR(`Failed to delete vision session: ${error}`);
      throw new Error(`Failed to delete vision session: ${error}`);
    }
  }

  // ---------------- Vision Log APIs ----------------

  addVisionLog(log: VisionLogRecord): VisionLogRecord {
    this.validateInput(log.id, "log.id");
    this.validateInput(log.sessionId, "log.sessionId");
    this.validateInput(log.type, "log.type");
    this.validateInput(log.title, "log.title");

    if (typeof log.timestamp !== "number" || log.timestamp <= 0) {
      throw new Error("log.timestamp must be a positive number");
    }

    const validTypes: VisionLogType[] = [
      "server",
      "llm-request",
      "llm-response",
      "thinking",
      "status",
      "vision-status",
      "error",
      "image-preview",
    ];

    if (!validTypes.includes(log.type)) {
      throw new Error(
        `Invalid type: ${log.type}. Must be one of: ${validTypes.join(", ")}`,
      );
    }

    const stmt = this.db.prepare(
      `INSERT INTO vision_logs (id, session_id, type, title, content, image_path, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    try {
      this.db.exec("BEGIN TRANSACTION");

      stmt.run(
        log.id,
        log.sessionId,
        log.type,
        log.title,
        log.content || "",
        log.imagePath,
        log.timestamp,
      );

      // Update session timestamp
      const updateStmt = this.db.prepare(
        `UPDATE vision_sessions SET updated_at = ? WHERE id = ?`,
      );
      updateStmt.run(log.timestamp, log.sessionId);

      this.db.exec("COMMIT");

      return {
        id: log.id,
        sessionId: log.sessionId,
        type: log.type,
        title: log.title,
        content: log.content || "",
        imagePath: log.imagePath,
        timestamp: log.timestamp,
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      LOG(TAG).ERROR(`Failed to add vision log: ${error}`);
      throw new Error(`Failed to add vision log: ${error}`);
    }
  }

  getVisionLogsBySession(sessionId: string): VisionLogRecord[] {
    this.validateInput(sessionId, "sessionId");

    try {
      const stmt = this.db.prepare(
        `SELECT id,
                session_id as sessionId,
                type,
                title,
                content,
                image_path as imagePath,
                timestamp
         FROM vision_logs
         WHERE session_id = ?
         ORDER BY timestamp ASC`,
      );

      const rows = stmt.all(sessionId) as Array<{
        id: string;
        sessionId: string;
        type: VisionLogType;
        title: string;
        content: string;
        imagePath: string | null;
        timestamp: number;
      }>;

      return rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        type: row.type,
        title: row.title,
        content: row.content,
        imagePath: row.imagePath,
        timestamp: row.timestamp,
      }));
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get vision logs by session: ${error}`);
      throw new Error(`Failed to get vision logs by session: ${error}`);
    }
  }

  /**
   * Retrieve vision sessions with their logs using a single optimized SQL query.
   * Sessions are ordered by updatedAt descending and limited by the provided limit.
   * Logs within each session are ordered ascending by timestamp.
   */
  getVisionSessionsWithLogs(limit: number = -1): VisionSessionWithLogs[] {
    if (limit !== -1 && (typeof limit !== "number" || limit <= 0)) {
      throw new Error("limit must be -1 or a positive number");
    }

    try {
      const baseSessionQuery = `SELECT id FROM vision_sessions ORDER BY updated_at DESC`;
      const sessionQuery =
        limit === -1 ? baseSessionQuery : `${baseSessionQuery} LIMIT ?`;

      const query = `
        SELECT 
          s.id as sessionId,
          s.goal,
          s.created_at as sessionCreatedAt,
          s.updated_at as sessionUpdatedAt,
          s.status,
          l.id as logId,
          l.type as logType,
          l.title as logTitle,
          l.content as logContent,
          l.image_path as imagePath,
          l.timestamp as logTimestamp
        FROM (${sessionQuery}) limited_sessions
        JOIN vision_sessions s ON s.id = limited_sessions.id
        LEFT JOIN vision_logs l ON s.id = l.session_id
        ORDER BY s.updated_at DESC, l.timestamp ASC
      `;

      const stmt = this.db.prepare(query);
      const rows = (limit === -1 ? stmt.all() : stmt.all(limit)) as Array<{
        sessionId: string;
        goal: string;
        sessionCreatedAt: number;
        sessionUpdatedAt: number;
        status: VisionSessionStatus;
        logId: string | null;
        logType: VisionLogType | null;
        logTitle: string | null;
        logContent: string | null;
        imagePath: string | null;
        logTimestamp: number | null;
      }>;

      // Group the results by session
      const sessionsMap = new Map<string, VisionSessionWithLogs>();

      for (const row of rows) {
        if (!sessionsMap.has(row.sessionId)) {
          sessionsMap.set(row.sessionId, {
            id: row.sessionId,
            goal: row.goal,
            createdAt: row.sessionCreatedAt,
            updatedAt: row.sessionUpdatedAt,
            status: row.status,
            logs: [],
          });
        }

        // Add log if it exists
        if (row.logId) {
          const session = sessionsMap.get(row.sessionId)!;
          session.logs.push({
            id: row.logId,
            sessionId: row.sessionId,
            type: row.logType!,
            title: row.logTitle!,
            content: row.logContent || "",
            imagePath: row.imagePath,
            timestamp: row.logTimestamp!,
          });
        }
      }

      return Array.from(sessionsMap.values());
    } catch (error) {
      LOG(TAG).ERROR(`Failed to get vision sessions with logs: ${error}`);
      throw new Error(`Failed to get vision sessions with logs: ${error}`);
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
