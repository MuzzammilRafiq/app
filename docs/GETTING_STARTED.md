# Getting Started

This guide walks you through setting up and running the application.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Bun** | 1.x | Package manager and runtime |
| **Node.js** | 20+ | Electron compatibility |
| **Python** | 3.11+ | Backend server |
| **uv** | Latest | Python package manager |

### Optional (for full functionality)

| Software | Purpose |
|----------|---------|
| **SearXNG** | Web search (Docker recommended) |
| **Playwright** | Crawl4AI web scraping |

---

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd app

# Install Node.js dependencies
bun install

# Install Python dependencies
cd python
uv sync
cd ..
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```env
# Optional: Override the Python backend URL (default: http://localhost:8000)
EMBEDDING_SERVICE_URL=http://localhost:8000
```

### 3. Set Up OpenRouter API Key

After launching the app:
1. Click the **Settings** icon in the sidebar
2. Enter your OpenRouter API key
3. Optionally configure custom models for text/vision

---

## Running the Application

### Development Mode

Start both Electron and the Python backend:

```bash
# Terminal 1: Start the Python backend
cd python
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Start Electron + Vite dev server
bun run dev
```

### What Gets Started

- **Vite dev server**: `http://localhost:5173` (React frontend)
- **Electron app**: Opens automatically
- **Python backend**: `http://localhost:8000`

---

## Optional: Web Search Setup

For web search functionality, you need a SearXNG instance:

### Using Docker (Recommended)

```bash
# Start SearXNG from the project's searxng folder
cd searxng
docker compose up -d
```

SearXNG will be available at `http://localhost:8888`.

### Verify Web Search

```bash
curl "http://localhost:8888/search?q=test&format=json"
```

---

## Building for Production

### Build the App

```bash
# Build all (Vite + Electron)
bun run build

# Build macOS ARM64 distribution
bun run dist:mac
```

### Output

- Development build: `dist-electron/` and `dist-renderer/`
- Distribution: `dist/` (electron-builder output)

---

## Project Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development mode (Electron + Vite) |
| `bun run build` | Build for production |
| `bun run dist:mac` | Build macOS distribution |
| `bun run lint` | Run OxLint |
| `bun run lint:fix` | Fix lint issues |
| `bun run test` | Run Vitest tests |
| `bun run typecheck:react` | TypeScript check (tsgo) |

---

## Troubleshooting

### Python Backend Not Starting

```bash
# Ensure uv is installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
cd python && uv sync
```

### Electron Crashes on Start

```bash
# Rebuild native modules
bun run rebuild
```

### SearXNG Connection Refused

```bash
# Check if container is running
docker ps | grep searxng

# Start it if not
cd searxng && docker compose up -d
```

### ChromaDB Errors

The Python backend creates ChromaDB collections on first run. If you see errors:

```bash
# Clear ChromaDB data
rm -rf python/user_data/chroma

# Restart Python backend
cd python && uv run uvicorn main:app --reload
```

---

## First Steps After Setup

1. **Test Chat**: Type a message in the chat view
2. **Enable RAG**: Add a folder in Settings → Text Embeddings
3. **Try Vision Mode**: Switch to Vision view and describe an action
4. **Enable Web Search**: Toggle the web search option in the chat input

---

## macOS Permissions

For Vision automation to work, you need to grant:

1. **Accessibility**: System Settings → Privacy & Security → Accessibility → Add your terminal/Electron app
2. **Screen Recording**: System Settings → Privacy & Security → Screen Recording → Add your terminal/Electron app

Without these, pyautogui cannot control the mouse/keyboard or take screenshots.
