import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string) =>
    ipcRenderer.invoke('gemini:send-message', message),

  sendMessageWithHistory: (messages: any[]) =>
    ipcRenderer.invoke('gemini:send-message-with-history', messages),

  streamMessageWithHistory: (messages: any[]) =>
    ipcRenderer.invoke('gemini:stream-message-with-history', messages),

  onStreamChunk: (
    callback: (data: {
      chunk: string;
      isComplete: boolean;
      fullText?: string;
      aborted?: boolean;
    }) => void
  ) => {
    ipcRenderer.on('gemini:stream-chunk', (event, data) => callback(data));
  },

  removeStreamChunkListener: () => {
    ipcRenderer.removeAllListeners('gemini:stream-chunk');
  },

  stopAIResponse: () => ipcRenderer.invoke('gemini:stop-response'),

  captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),

  onGlobalScreenshotTrigger: (callback: () => void) => {
    ipcRenderer.on('global-screenshot-trigger', () => callback());
  },

  removeGlobalScreenshotListener: () => {
    ipcRenderer.removeAllListeners('global-screenshot-trigger');
  },
});
