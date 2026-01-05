# App Documentation

A powerful AI-powered desktop assistant built with **Electron + React + Python**, featuring LLM chat, vision automation, RAG embeddings, and web search.

---

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, tech stack, and data flow |
| [Getting Started](./docs/GETTING_STARTED.md) | Installation and running the app |
| [Features](./docs/FEATURES.md) | Complete feature overview |
| [API Reference](./docs/API_REFERENCE.md) | Python backend API endpoints |
| [IPC Reference](./docs/IPC_REFERENCE.md) | Electron IPC handlers and preload API |
| [Database Schema](./docs/DATABASE_SCHEMA.md) | SQLite tables and relationships |
| [Development Guide](./docs/DEVELOPMENT.md) | Contributing and extending the app |

---

## 🏗️ Quick Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron Main                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ IPC Handlers │  │   Database   │  │       LLM Tools        │ │
│  │  (stream,    │  │   Service    │  │ (orchestrator, RAG,    │ │
│  │  automation) │  │   (SQLite)   │  │  web-search, terminal) │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                                           │
        │ IPC                                       │ HTTP
        ▼                                           ▼
┌───────────────────┐                    ┌──────────────────────┐
│   React Frontend  │                    │    Python Backend    │
│  ┌─────────────┐  │                    │  ┌────────────────┐  │
│  │ Chat View   │  │                    │  │  Image/Text    │  │
│  │ Vision View │  │                    │  │  Embeddings    │  │
│  │ Settings    │  │                    │  │  (ChromaDB)    │  │
│  └─────────────┘  │                    │  ├────────────────┤  │
│                   │                    │  │  Automation    │  │
│  Zustand Store    │                    │  │  (pyautogui)   │  │
│  React Query      │                    │  ├────────────────┤  │
│  TailwindCSS      │                    │  │  Web Search    │  │
└───────────────────┘                    │  │  (SearXNG)     │  │
                                         └──────────────────────┘
```

---

## 🚀 Key Features

- **🤖 LLM Chat** - Streaming chat with OpenRouter API (text and vision models)
- **👁️ Vision Agent** - Automated UI interactions using screen analysis + pyautogui
- **📚 RAG** - Semantic search over local images and text documents via ChromaDB
- **🔍 Web Search** - SearXNG + Crawl4AI for grounded web responses
- **💾 Sessions** - Full chat history persistence with SQLite
- **🖥️ Terminal Agent** - Execute shell commands with security checks and user confirmation

---

## 📁 Project Structure

```
app/
├── src/
│   ├── electron/           # Electron main process
│   │   ├── main.ts         # App entry point
│   │   ├── ipc/            # IPC handlers (stream, automation, database...)
│   │   ├── services/       # Database, model (OpenRouter), HEIC converter
│   │   ├── tools/          # LLM tools (orchestrator, RAG, web-search, terminal)
│   │   ├── automation/     # Vision automation handlers
│   │   └── embeddingsDB/   # Image/text embedding utilities
│   ├── renderer/           # React frontend (Vite)
│   │   ├── components/     # UI components (chat, vision, settings)
│   │   ├── services/       # Frontend services
│   │   └── utils/          # Zustand stores, helpers
│   └── common/             # Shared types between Electron and renderer
├── python/                 # Python FastAPI backend
│   ├── main.py             # FastAPI entry point
│   ├── routes/             # API routes (image, text, automation, web_search)
│   └── *.py                # Utility modules
├── docs/                   # This documentation
└── package.json            # Bun/npm dependencies
```

---

## 🔧 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, TailwindCSS 4, Zustand, React Query |
| **Desktop** | Electron 36, Vite (Rolldown) |
| **Backend** | Python 3.13, FastAPI, ChromaDB, pyautogui, Crawl4AI |
| **LLM** | OpenRouter API (Kimi K2, Qwen VL, Gemini Flash) |
| **Database** | SQLite (Node native) |
| **Search** | SearXNG (self-hosted) |

---

## 📄 License

MIT License - see LICENSE file for details.
