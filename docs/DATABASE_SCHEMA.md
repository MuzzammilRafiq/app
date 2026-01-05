# Database Schema

SQLite database schema documentation.

---

## Overview

The application uses SQLite with WAL mode for persistence. The database file is located at:
```
<app-data-dir>/data/database.db
```

---

## Tables

### sessions

Stores chat session metadata.

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `title` | TEXT | Session title (auto-generated from first message) |
| `created_at` | INTEGER | Unix timestamp (ms) |
| `updated_at` | INTEGER | Unix timestamp (ms), updated on new messages |

---

### chat_messages

Stores all chat messages.

```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','execution')),
  timestamp INTEGER NOT NULL,
  is_error TEXT NOT NULL DEFAULT '',
  images TEXT DEFAULT NULL,
  type TEXT NOT NULL CHECK(type IN ('stream','log','plan','user','source')),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_session_time ON chat_messages(session_id, timestamp);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `session_id` | TEXT | Foreign key to sessions |
| `content` | TEXT | Message content |
| `role` | TEXT | `user`, `assistant`, or `execution` |
| `timestamp` | INTEGER | Unix timestamp (ms) |
| `is_error` | TEXT | Error message if applicable |
| `images` | TEXT | JSON array of image paths (nullable) |
| `type` | TEXT | Message type for UI rendering |

#### Message Types

| Type | Description |
|------|-------------|
| `user` | User input message |
| `stream` | Streamed LLM response |
| `log` | Execution log (terminal output, etc.) |
| `plan` | Orchestrator plan steps |
| `source` | RAG/web search sources |

---

### plan_steps

Stores orchestrator plan progress for resume capability.

```sql
CREATE TABLE plan_steps (
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

CREATE INDEX idx_plan_steps_session_hash ON plan_steps(session_id, plan_hash);
CREATE INDEX idx_plan_steps_session ON plan_steps(session_id);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `session_id` | TEXT | Foreign key to sessions |
| `plan_hash` | TEXT | Hash of the plan for deduplication |
| `step_number` | INTEGER | Step sequence number |
| `tool_name` | TEXT | `terminal_tool` or `general_tool` |
| `description` | TEXT | Step description/command |
| `status` | TEXT | `todo` or `done` |
| `updated_at` | INTEGER | Unix timestamp (ms) |

---

### rag_folders

Tracks folders indexed for RAG (image and text embeddings).

```sql
CREATE TABLE rag_folders (
  id TEXT PRIMARY KEY,
  folder_path TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('image','text')),
  last_scanned_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_rag_folders_type ON rag_folders(type);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `folder_path` | TEXT | Absolute path to folder (unique) |
| `type` | TEXT | `image` or `text` |
| `last_scanned_at` | INTEGER | Unix timestamp of last scan (nullable) |
| `created_at` | INTEGER | Unix timestamp when added |

---

## Entity Relationships

```
┌─────────────┐       ┌─────────────────┐
│  sessions   │──────<│  chat_messages  │
│             │   1:N │                 │
│  id (PK)    │       │  session_id(FK) │
└─────────────┘       └─────────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐
│ plan_steps  │
│             │
│ session_id  │
│ plan_hash   │
└─────────────┘

┌─────────────┐
│ rag_folders │  (standalone)
│             │
│ folder_path │
│ type        │
└─────────────┘
```

---

## TypeScript Types

```typescript
// Common types used throughout the app

type ChatRole = 'user' | 'assistant' | 'execution';
type ChatType = 'stream' | 'log' | 'plan' | 'user' | 'source';

interface ChatSessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatMessageRecord {
  id: string;
  sessionId: string;
  content: string;
  role: ChatRole;
  timestamp: number;
  isError: string;
  imagePaths: string[] | null;
  type: ChatType;
}

interface ChatSessionWithMessages extends ChatSessionRecord {
  messages: ChatMessageRecord[];
}

interface MakePlanResponse {
  step_number: number;
  tool_name: string;
  description: string;
  status: 'todo' | 'done';
}
```

---

## Cascade Deletes

When a session is deleted:
- All associated `chat_messages` are automatically deleted
- All associated `plan_steps` are automatically deleted

This is enforced by SQLite foreign key constraints with `ON DELETE CASCADE`.

---

## Database Service

The database is accessed through a singleton `DatabaseService` class:

```typescript
import dbService from './services/database';

// Create session
const session = dbService.createSession('New Chat');

// Add message
const message = dbService.addChatMessage({
  id: uuid(),
  sessionId: session.id,
  content: 'Hello!',
  role: 'user',
  timestamp: Date.now(),
  isError: '',
  imagePaths: null,
  type: 'user'
});

// Get all sessions with messages
const sessions = dbService.getAllSessionsWithMessages(10);
```
