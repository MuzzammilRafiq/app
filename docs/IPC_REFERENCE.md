# IPC Reference

Electron IPC handlers and preload API documentation.

---

## Overview

The application uses Electron's context-isolated IPC for communication between the renderer (React) and main process. All APIs are exposed through `window.electronAPI` via the preload script.

---

## Streaming & Chat

### streamMessageWithHistory
Stream a chat response with full conversation history.

```typescript
window.electronAPI.streamMessageWithHistory(
  messages: ChatMessageRecord[],
  config: {
    rag?: boolean,
    webSearch?: boolean,
    textModelOverride?: string,
    imageModelOverride?: string
  },
  apiKey: string
): Promise<{ text: string, error?: string }>
```

### cancelStream
Cancel an active stream.

```typescript
window.electronAPI.cancelStream(sessionId: string): Promise<boolean>
```

### onStreamChunk
Listen for streaming chunks.

```typescript
window.electronAPI.onStreamChunk(
  callback: (data: { chunk: string, type: 'stream' | 'log' | 'plan' | 'source' }) => void
): void
```

### removeStreamChunkListener
Clean up stream chunk listener.

```typescript
window.electronAPI.removeStreamChunkListener(): void
```

---

## Vision Automation

### automationExecuteOrchestrated
Execute a multi-step automated workflow.

```typescript
window.electronAPI.automationExecuteOrchestrated(
  apiKey: string,
  userPrompt: string,
  imageModelOverride?: string,
  debug?: boolean
): Promise<{
  success: boolean,
  stepsCompleted: number,
  totalSteps: number,
  error?: string,
  results?: ActionHistoryEntry[]
}>
```

### onAutomationStatus
Listen for automation progress updates.

```typescript
window.electronAPI.onAutomationStatus(
  callback: (data: { step: string, message: string }) => void
): void
```

### onAutomationLog
Listen for detailed automation logs.

```typescript
window.electronAPI.onAutomationLog(
  callback: (data: {
    type: 'server' | 'llm-request' | 'llm-response' | 'thinking' | 'error',
    title: string,
    content: string
  }) => void
): void
```

### onAutomationImagePreview
Listen for screenshot previews during automation.

```typescript
window.electronAPI.onAutomationImagePreview(
  callback: (data: { title: string, imageBase64: string }) => void
): void
```

---

## Image Embeddings

### searchImagesByText
Search images by text query.

```typescript
window.electronAPI.searchImagesByText(
  query: string,
  limit?: number
): Promise<string[]>
```

### selectFolder
Open folder selection dialog.

```typescript
window.electronAPI.selectFolder(): Promise<string | null>
```

### scanFolder
Scan and index a folder for image embeddings.

```typescript
window.electronAPI.scanFolder(folder: string): Promise<{
  total_found: number,
  total_added: number,
  errors: string[]
}>
```

### deleteFolder
Delete a folder from image embeddings.

```typescript
window.electronAPI.deleteFolder(folder: string): Promise<{ deleted_count: number }>
```

### deleteAllImageEmbeddings
Delete all image embeddings.

```typescript
window.electronAPI.deleteAllImageEmbeddings(): Promise<void>
```

---

## Text Embeddings

### searchTextsByText
Search text documents by query.

```typescript
window.electronAPI.searchTextsByText(
  query: string,
  limit?: number
): Promise<{ results: any[], count: number }>
```

### selectTextFolder
Open folder selection dialog for text.

```typescript
window.electronAPI.selectTextFolder(): Promise<string | null>
```

### scanTextFolder
Scan and index a folder for text embeddings.

```typescript
window.electronAPI.scanTextFolder(folder: string): Promise<{
  total_found: number,
  total_added: number,
  errors: string[]
}>
```

### deleteTextFolder
Delete a folder from text embeddings.

```typescript
window.electronAPI.deleteTextFolder(folder: string): Promise<{ deleted_count: number }>
```

### deleteAllTextEmbeddings
Delete all text embeddings.

```typescript
window.electronAPI.deleteAllTextEmbeddings(): Promise<void>
```

---

## Database (Sessions & Messages)

### dbCreateSession
Create a new chat session.

```typescript
window.electronAPI.dbCreateSession(
  title: string,
  id?: string
): Promise<ChatSessionRecord>
```

### dbGetSessions
Get all sessions (sorted by updated_at desc).

```typescript
window.electronAPI.dbGetSessions(): Promise<ChatSessionRecord[]>
```

### dbGetSession
Get a single session by ID.

```typescript
window.electronAPI.dbGetSession(id: string): Promise<ChatSessionRecord | null>
```

### dbUpdateSessionTitle
Update session title.

```typescript
window.electronAPI.dbUpdateSessionTitle(
  id: string,
  title: string
): Promise<boolean>
```

### dbTouchSession
Update session's updated_at timestamp.

```typescript
window.electronAPI.dbTouchSession(
  id: string,
  timestamp: number
): Promise<ChatSessionRecord>
```

### dbDeleteSession
Delete a session and all its messages.

```typescript
window.electronAPI.dbDeleteSession(id: string): Promise<boolean>
```

### dbAddChatMessage
Add a message to a session.

```typescript
window.electronAPI.dbAddChatMessage(
  message: ChatMessageRecord
): Promise<ChatMessageRecord>
```

### dbGetChatMessages
Get all messages for a session.

```typescript
window.electronAPI.dbGetChatMessages(
  sessionId: string
): Promise<ChatMessageRecord[]>
```

### dbDeleteChatMessage
Delete a single message.

```typescript
window.electronAPI.dbDeleteChatMessage(id: string): Promise<boolean>
```

### dbDeleteChatMessagesBySession
Delete all messages in a session.

```typescript
window.electronAPI.dbDeleteChatMessagesBySession(
  sessionId: string
): Promise<number>
```

### dbGetAllSessionsWithMessages
Get all sessions with their messages (optimized single query).

```typescript
window.electronAPI.dbGetAllSessionsWithMessages(
  limit: number
): Promise<ChatSessionWithMessages[]>
```

---

## Database (Plan Steps)

### dbUpsertPlanSteps
Insert or update plan steps.

```typescript
window.electronAPI.dbUpsertPlanSteps(
  sessionId: string,
  planHash: string,
  steps: MakePlanResponse[]
): Promise<void>
```

### dbMarkPlanStepDone
Mark a plan step as completed.

```typescript
window.electronAPI.dbMarkPlanStepDone(
  sessionId: string,
  planHash: string,
  stepNumber: number
): Promise<boolean>
```

### dbGetPlanSteps
Get plan steps for a session/plan.

```typescript
window.electronAPI.dbGetPlanSteps(
  sessionId: string,
  planHash: string
): Promise<MakePlanResponse[]>
```

---

## Database (RAG Folders)

### dbGetRagFolders
Get all RAG folders of a type.

```typescript
window.electronAPI.dbGetRagFolders(
  type: 'image' | 'text'
): Promise<{ folderPath: string, lastScannedAt: number | null }[]>
```

### dbAddRagFolder
Add a RAG folder.

```typescript
window.electronAPI.dbAddRagFolder(
  folderPath: string,
  type: 'image' | 'text',
  lastScannedAt?: number
): Promise<{ folderPath: string, lastScannedAt: number | null }>
```

### dbUpdateRagFolderScanTime
Update folder's last scanned timestamp.

```typescript
window.electronAPI.dbUpdateRagFolderScanTime(
  folderPath: string,
  lastScannedAt: number
): Promise<boolean>
```

### dbDeleteRagFolder
Remove a RAG folder.

```typescript
window.electronAPI.dbDeleteRagFolder(folderPath: string): Promise<boolean>
```

---

## Window Controls

### windowMinimize / windowMaximize / windowClose

```typescript
window.electronAPI.windowMinimize(): Promise<void>
window.electronAPI.windowMaximize(): Promise<void>
window.electronAPI.windowClose(): Promise<void>
```

### windowIsMaximized

```typescript
window.electronAPI.windowIsMaximized(): Promise<boolean>
```

### windowGetPlatform

```typescript
window.electronAPI.windowGetPlatform(): Promise<string>
```

### windowHide / windowShow

```typescript
window.electronAPI.windowHide(): Promise<void>
window.electronAPI.windowShow(): Promise<void>
```

---

## File Operations

### readFileAsBuffer
Read a file as a Buffer.

```typescript
window.electronAPI.readFileAsBuffer(filePath: string): Promise<Buffer>
```

### getConvertedHeicPath
Convert HEIC to JPEG and return path.

```typescript
window.electronAPI.getConvertedHeicPath(heicPath: string): Promise<string>
```

### getHeicCacheStats
Get HEIC cache statistics.

```typescript
window.electronAPI.getHeicCacheStats(): Promise<{ count: number, size: number }>
```

### cleanupHeicCache
Clean up HEIC cache.

```typescript
window.electronAPI.cleanupHeicCache(): Promise<void>
```

### saveImageToMedia
Save a base64 image to the media folder.

```typescript
window.electronAPI.saveImageToMedia(image: {
  data: string,
  mimeType: string,
  name?: string
}): Promise<string>
```

### saveImageFromPathToMedia
Copy an image file to the media folder.

```typescript
window.electronAPI.saveImageFromPathToMedia(filePath: string): Promise<string>
```

---

## Terminal Command Confirmation

### onCommandConfirmation
Listen for terminal command confirmation requests.

```typescript
window.electronAPI.onCommandConfirmation(
  callback: (data: { command: string, requestId: string, cwd: string }) => void
): void
```

### respondToCommandConfirmation
Respond to a command confirmation request.

```typescript
window.electronAPI.respondToCommandConfirmation(
  requestId: string,
  allowed: boolean
): Promise<void>
```

### removeCommandConfirmationListener
Clean up confirmation listener.

```typescript
window.electronAPI.removeCommandConfirmationListener(): void
```

---

## OpenRouter Models

### getOpenRouterModels
Fetch available models from OpenRouter.

```typescript
window.electronAPI.getOpenRouterModels(
  apiKey: string
): Promise<Model[]>
```
