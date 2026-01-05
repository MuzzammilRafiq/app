# Architecture

This document describes the high-level architecture, data flow, and key design decisions of the application.

---

## System Overview

The application follows a **three-tier architecture**:

1. **Renderer Process** (React) - User interface
2. **Main Process** (Electron/Node.js) - Business logic, IPC handling, LLM integration
3. **Python Backend** (FastAPI) - Embeddings, automation, web search

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                │
│                          React + TailwindCSS                               │
│                                                                            │
│   ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐    │
│   │  Chat View   │   │ Vision View  │   │      Settings View         │    │
│   │  - Messages  │   │ - Log Panel  │   │  - API Key                 │    │
│   │  - Sidebar   │   │ - Input      │   │  - Model Selection         │    │
│   │  - Plans     │   │              │   │  - RAG Folder Management   │    │
│   └──────────────┘   └──────────────┘   └────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC (contextBridge)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            ELECTRON MAIN PROCESS                           │
│                                                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                          IPC Handlers                               │  │
│   │  stream.ts │ database.ts │ automation.ts │ imageEmbedding.ts │ ... │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│   ┌─────────────────────┐   ┌────────────────────────────────────────────┐ │
│   │    Services         │   │              Tools                         │ │
│   │  ├─ database.ts     │   │  ├─ orchestrator.ts (task planner)        │ │
│   │  │  (SQLite)        │   │  ├─ terminal/       (shell execution)     │ │
│   │  ├─ model.ts        │   │  ├─ rag/            (document retrieval)  │ │
│   │  │  (OpenRouter)    │   │  ├─ web-search/     (internet search)     │ │
│   │  └─ heicConverter   │   │  └─ general/        (response formatting) │ │
│   └─────────────────────┘   └────────────────────────────────────────────┘ │
│                                                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      Vision Automation                              │  │
│   │  orchestrator-handlers.ts │ vision-handlers.ts │ llm-helpers.ts     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (localhost:8000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            PYTHON BACKEND                                  │
│                            FastAPI Server                                  │
│                                                                            │
│   ┌──────────────────┐   ┌─────────────────┐   ┌────────────────────────┐ │
│   │ Image Embeddings │   │ Text Embeddings │   │      Automation        │ │
│   │  (ChromaDB +     │   │  (ChromaDB +    │   │  - mouse/move/click    │ │
│   │   CLIP model)    │   │   sentence      │   │  - keyboard/type/press │ │
│   │                  │   │   transformers) │   │  - screenshot & grid   │ │
│   └──────────────────┘   └─────────────────┘   └────────────────────────┘ │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                        Web Search                                  │   │
│   │   SearXNG (search engine) + Crawl4AI (web scraper)                │   │
│   └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Chat Flow

```
User types message
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Create/ensure session in SQLite                                 │
│ 2. Persist user message to database                                │
│ 3. Invoke IPC: stream-message-with-history                         │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Electron Main Process                                               │
│                                                                     │
│ 4. Check if RAG enabled → call Python /text/query → augment prompt │
│ 5. Check if Web Search enabled → call Python /web/search → augment │
│ 6. Call OpenRouter API via model.ts (ASK_TEXT or ASK_IMAGE)        │
│ 7. Stream response chunks back via IPC events                      │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ React Frontend                                                      │
│                                                                     │
│ 8. Receive stream-chunk events                                     │
│ 9. Accumulate in Zustand streaming store                           │
│ 10. After stream ends, persist assistant messages to database      │
└─────────────────────────────────────────────────────────────────────┘
```

### Vision Automation Flow

```
User enters natural language command (e.g., "Open Safari and search for cats")
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Capture initial screenshot via Python /screenshot/numbered-grid │
│ 2. Send screenshot to LLM for contextual plan generation           │
│ 3. LLM returns: { valid: bool, plan: string, estimatedSteps: int } │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ EXECUTION LOOP (max 10 steps)                                       │
│                                                                     │
│ 4. Capture fresh screenshot with grid overlay                      │
│ 5. Ask LLM: "What action should I take next?"                      │
│    → Returns: { action: click|type|press|wait|done, target, data } │
│ 6. Execute action:                                                  │
│    - click/type: Two-pass grid refinement (6x6 → sub-grid)         │
│    - press: Keyboard key press                                     │
│    - wait: Simple delay                                            │
│ 7. Verify action via screenshot comparison                         │
│ 8. Record action history and loop                                  │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. LLM determines goal complete → return success                   │
│ 10. Report results to frontend via automation:status events        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. OpenRouter for LLM Access
- Uses OpenRouter SDK for unified access to multiple LLM providers
- Default models:
  - Text: `moonshotai/kimi-k2-0905`
  - Vision: `qwen/qwen3-vl-30b-a3b-thinking`
  - Web extraction: `google/gemini-2.0-flash-lite-001`

### 2. Two-Process Python Backend
The Python backend is separate from Electron for:
- **Isolation**: Heavy ML models (ChromaDB, CLIP) don't block the Electron main process
- **Flexibility**: Can run on a different machine or be containerized
- **Pyautogui**: Requires Python for cross-platform automation

### 3. SQLite for Persistence
- Uses Node.js native `DatabaseSync` (sync API) for simplicity
- WAL mode for better concurrency
- Tables: `sessions`, `chat_messages`, `plan_steps`, `rag_folders`

### 4. Streaming Architecture
- All LLM responses are streamed
- IPC events: `stream-chunk` with types: `stream`, `log`, `plan`, `source`
- Frontend accumulates chunks in Zustand store

### 5. Grid-Based Vision
- Screenshots are divided into numbered grids (default 6x6)
- LLM identifies target cell by number
- Two-pass refinement: coarse grid → sub-grid for precise clicking

---

## Security Considerations

### Terminal Execution
- Commands are analyzed for dangerous patterns
- User confirmation dialog before execution
- Patterns flagged: `rm -rf`, `sudo`, `format`, `mkfs`, etc.

### Context Isolation
- `nodeIntegration: false`
- `contextIsolation: true`
- All Electron APIs exposed through `contextBridge` in preload

### API Keys
- Stored in localStorage (settings)
- Never logged or sent to third parties
- Only sent to OpenRouter API
