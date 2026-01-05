# Features

Comprehensive overview of all application features.

---

## 🤖 LLM Chat

### Core Functionality
- **Streaming responses** - Real-time token streaming from LLM
- **Multi-model support** - Text and vision models via OpenRouter
- **Session management** - Persistent chat history with SQLite
- **Image support** - Attach images for vision model analysis
- **HEIC conversion** - Automatic conversion of Apple HEIC images

### Chat Modes

| Mode | Description |
|------|-------------|
| **Standard** | Direct LLM conversation |
| **Agent (Terminal)** | LLM plans and executes shell commands |
| **RAG Augmented** | Retrieves context from indexed documents |
| **Web Search** | Searches the web and includes results |

### Agent Mode (Orchestrator)

When enabled, the LLM becomes a task orchestrator:

1. **Plan Generation**: Breaks down user request into steps (max 15)
2. **Available Agents**:
   - `terminal` - Execute shell commands
   - `general` - Natural language responses
3. **User Confirmation**: All terminal commands require approval
4. **Security Checks**: Flags dangerous commands (rm -rf, sudo, etc.)

Example:
```
User: "What's in my Downloads folder?"
Plan: 
  1. [terminal] ls ~/Downloads
  2. [general] Format the folder contents for the user
```

---

## 👁️ Vision Automation

### Overview
Automate UI interactions using natural language. The system:
1. Takes screenshots with numbered grid overlay
2. Uses vision LLM to identify target elements
3. Executes mouse/keyboard actions via pyautogui

### Supported Actions

| Action | Description |
|--------|-------------|
| `click` | Click on a UI element |
| `type` | Type text into a field |
| `press` | Press a keyboard key |
| `wait` | Wait for UI updates |

### How It Works

```
1. Capture screenshot → overlay 6x6 numbered grid
2. Send to vision LLM: "Find the search bar" → "Cell 4"
3. Crop cell 4 → overlay sub-grid (6x6)
4. Send to LLM: "Find exact click point" → "Sub-cell 22"
5. Calculate coordinates → move mouse → click
6. Verify action via new screenshot
```

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Max Steps | 10 | Maximum actions per workflow |
| Max Retries | 3 | Retry failed actions |
| Max Consecutive Failures | 3 | Abort after N failures |

---

## 📚 RAG (Retrieval-Augmented Generation)

### Text Embeddings

Index text documents for semantic search:

- **Supported formats**: `.txt`, `.md`, `.pdf`, `.json`, etc.
- **Chunking**: Automatic text splitting
- **Embeddings**: Sentence transformers via ChromaDB
- **Search**: Top-K retrieval with query expansion

### Image Embeddings

Index images for visual search:

- **Supported formats**: `.png`, `.jpg`, `.jpeg`, `.heic`, `.webp`, `.gif`
- **Embeddings**: CLIP model via ChromaDB
- **Search**: Text-to-image semantic search

### Usage

1. Go to **Settings** → **Text/Image Embeddings**
2. Click **Add Folder** and select a directory
3. Click **Scan** to index contents
4. Enable **RAG** toggle in chat input
5. Your queries will be augmented with relevant documents

---

## 🔍 Web Search

### How It Works

1. **Query Generation**: LLM generates 3-4 optimized search queries
2. **Search**: SearXNG searches the web
3. **Crawl**: Crawl4AI scrapes and converts to markdown
4. **Extract**: LLM extracts only relevant information
5. **Augment**: Results added to chat context

### Requirements

- SearXNG instance running at `localhost:8888`
- Internet connection for web crawling

### Usage

1. Toggle **Web Search** in chat input
2. Ask a question that requires current information
3. View sources in the sidebar

---

## 💾 Session Management

### Features

- **Auto-save**: Messages saved immediately
- **Session history**: View and restore past conversations
- **Title generation**: Auto-generated from first message
- **Delete sessions**: Clean up old conversations

### Sidebar

- Lists all sessions (newest first)
- Click to switch sessions
- Search sessions (modal)
- Create new session

---

## ⚙️ Settings

### API Configuration

| Setting | Description |
|---------|-------------|
| OpenRouter API Key | Required for all LLM features |
| Text Model | Override default text model |
| Image Model | Override default vision model |

### RAG Folders

| Setting | Description |
|---------|-------------|
| Text Folders | Directories to index for text RAG |
| Image Folders | Directories to index for image RAG |
| Scan Status | When each folder was last indexed |

### Actions

| Action | Description |
|--------|-------------|
| Scan Folder | Re-index a folder's contents |
| Delete Folder | Remove from index |
| Delete All | Clear entire embedding database |

---

## 🖥️ Window Controls

### Custom Title Bar

- macOS traffic lights (close, minimize, maximize)
- Collapsible sidebar
- View switching (Chat, Vision, Settings)

### Shortcuts

| Shortcut | Action |
|----------|--------|
| (Custom) | Defined in app |

---

## 📊 Message Details Sidebar

When an LLM response includes structured data, a sidebar shows:

### Plan View
- Step-by-step execution plan
- Status indicators (todo, running, done, failed)

### Log View
- Detailed execution logs
- Terminal output
- Warnings and errors

### Sources View
- RAG document sources
- Web search sources with URLs
