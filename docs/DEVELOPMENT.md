# Development Guide

Guide for contributing to and extending the application.

---

## Development Setup

### Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Quick Start

```bash
# Install dependencies
bun install
cd python && uv sync && cd ..

# Start development
# Terminal 1: Python backend
cd python && uv run uvicorn main:app --reload --port 8000

# Terminal 2: Electron + Vite
bun run dev
```

---

## Project Structure

```
app/
├── src/
│   ├── electron/                   # Electron main process
│   │   ├── main.ts                 # Entry point
│   │   ├── ipc/                    # IPC handlers
│   │   │   ├── preload.ts          # Context bridge (renderer API)
│   │   │   ├── stream.ts           # Chat streaming
│   │   │   ├── automation.ts       # Vision automation
│   │   │   ├── database.ts         # Database operations
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── database.ts         # SQLite service
│   │   │   ├── model.ts            # OpenRouter integration
│   │   │   └── heicConverter.ts    # HEIC → JPEG conversion
│   │   ├── tools/                  # LLM tools
│   │   │   ├── orchestrator.ts     # Task planner/executor
│   │   │   ├── terminal/           # Shell command execution
│   │   │   ├── rag/                # RAG retrieval
│   │   │   ├── web-search/         # Web search
│   │   │   └── general/            # Response formatting
│   │   ├── automation/             # Vision automation
│   │   │   ├── orchestrator-handlers.ts
│   │   │   ├── vision-handlers.ts
│   │   │   └── llm-helpers.ts
│   │   └── utils/
│   │       └── logging.ts          # Logging utilities
│   │
│   ├── renderer/                   # React frontend
│   │   ├── App.tsx                 # Root component
│   │   ├── main.tsx                # Entry point
│   │   ├── index.css               # Global styles
│   │   ├── components/
│   │   │   ├── chat/               # Chat components
│   │   │   ├── vision/             # Vision components
│   │   │   └── settings/           # Settings components
│   │   ├── services/               # Frontend services
│   │   └── utils/
│   │       └── store.ts            # Zustand stores
│   │
│   └── common/
│       └── types.ts                # Shared TypeScript types
│
├── python/                         # Python backend
│   ├── main.py                     # FastAPI entry
│   ├── routes/
│   │   ├── image_route.py          # Image embeddings
│   │   ├── text_route.py           # Text embeddings
│   │   ├── automation_route.py     # Mouse/keyboard/screenshot
│   │   └── web_search_route.py     # Web search
│   ├── web_search.py               # SearXNG + Crawl4AI
│   ├── image.py                    # Image processing
│   ├── text.py                     # Text chunking
│   └── chroma.py                   # ChromaDB setup
│
└── docs/                           # Documentation
```

---

## Adding a New Feature

### 1. Adding an IPC Handler

**Electron side** (`src/electron/ipc/`):

```typescript
// src/electron/ipc/myFeature.ts
import { ipcMain } from 'electron';

export function setupMyFeatureHandlers() {
  ipcMain.handle('my-feature:action', async (event, arg1, arg2) => {
    // Implementation
    return { success: true };
  });
}
```

Register in `main.ts`:
```typescript
import { setupMyFeatureHandlers } from './ipc/myFeature.js';

app.whenReady().then(() => {
  // ... existing handlers
  setupMyFeatureHandlers();
});
```

**Preload** (`src/electron/ipc/preload.ts`):

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  myFeatureAction: (arg1: string, arg2: number) =>
    ipcRenderer.invoke('my-feature:action', arg1, arg2),
});
```

**Type declaration** (`src/renderer/vite-env.d.ts`):

```typescript
interface ElectronAPI {
  // ... existing types
  myFeatureAction: (arg1: string, arg2: number) => Promise<{ success: boolean }>;
}
```

### 2. Adding a Python Endpoint

Create a new route file or add to existing:

```python
# python/routes/my_feature_route.py
from fastapi import APIRouter

my_feature_router = APIRouter()

@my_feature_router.post("/my-feature/action")
async def my_action(data: dict):
    # Implementation
    return {"result": "success"}
```

Register in `main.py`:
```python
from routes import my_feature_router
app.include_router(my_feature_router)
```

### 3. Adding a React Component

```typescript
// src/renderer/components/MyComponent.tsx
import { useState } from 'react';

export default function MyComponent() {
  const [data, setData] = useState<string>('');

  const handleAction = async () => {
    const result = await window.electronAPI.myFeatureAction('arg1', 42);
    console.log(result);
  };

  return (
    <div>
      <button onClick={handleAction}>Do Action</button>
    </div>
  );
}
```

---

## Code Style

### TypeScript/React

- Use functional components with hooks
- Prefer `const` over `let`
- Use explicit types for function parameters
- Run `bun run lint` before committing

### Python

- Follow PEP 8
- Use type hints
- Run `ruff check python/` for linting

### Logging

**Electron (main process):**
```typescript
import { LOG } from '../utils/logging.js';

const TAG = 'my-feature';
LOG(TAG).INFO('Message');
LOG(TAG).ERROR('Error message', error);
LOG(TAG).SUCCESS('Success!');
LOG(TAG).WARN('Warning');
```

**Python:**
```python
from logger import log_info, log_error, log_success, log_warning

log_info("Message")
log_error("Error message")
```

**React (renderer):**
```typescript
console.log('Message');  // Console.log is fine in frontend
```

---

## Testing

### Run Tests

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# With UI
bun run test:ui
```

### Writing Tests

Tests use Vitest. Example:

```typescript
// src/electron/services/database.test.ts
import { describe, it, expect } from 'vitest';
import { DatabaseService } from './database';

describe('DatabaseService', () => {
  it('creates a session', () => {
    const db = DatabaseService.getInstance();
    const session = db.createSession('Test');
    expect(session.title).toBe('Test');
  });
});
```

---

## Building

### Development Build

```bash
bun run build
```

### Production Distribution (macOS)

```bash
bun run dist:mac
```

Output: `dist/` directory with `.dmg` installer

---

## Common Tasks

### Adding a New LLM Tool

1. Create tool in `src/electron/tools/myTool/index.ts`
2. Export the tool function
3. Call from orchestrator or stream handler
4. Add to chat config if user-toggleable

### Modifying the Database Schema

1. Update `src/electron/services/database.ts`
2. Add migration logic in `initializeSchema()`
3. Update TypeScript types in `src/common/types.ts`

### Adding a New View

1. Create component in `src/renderer/components/myView/`
2. Add to `App.tsx` switch statement
3. Update `useCurrentViewStore` if needed

---

## Debugging

### Electron Main Process

```bash
# Enable Node inspector
NODE_OPTIONS='--inspect' bun run dev:electron
```

Open `chrome://inspect` in Chrome.

### React DevTools

The app automatically opens DevTools in development. You can also:
- Press `Cmd+Option+I` in the app window
- Uncomment DevTools code in `main.ts`

### Python Backend

```bash
# Run with auto-reload and debug logging
cd python && uv run uvicorn main:app --reload --log-level debug
```

---

## Architecture Decisions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design decisions and rationale.
