/**
 * @fileoverview Vite environment type definitions for the renderer process
 *
 * This file provides TypeScript type definitions for Vite's client-side
 * environment variables and custom type definitions for the Electron API
 * that is exposed through the preload script.
 *
 * The Window interface extension defines the electronAPI object that
 * allows the renderer process to communicate with the main process
 * through IPC (Inter-Process Communication) in a type-safe manner.
 *
 * @author AI Chat Application
 * @version 1.0.0
 */

/// <reference types="vite/client" />

/**
 * Extended Window interface with Electron API
 *
 * This interface extends the global Window object to include the electronAPI
 * that is exposed by the preload script. It provides type safety for
 * communicating with the main process.
 *
 * @interface Window
 * @property {Object} electronAPI - The Electron API object exposed by the preload script
 * @property {Function} electronAPI.streamMessageWithHistory - Streams messages with conversation history to Gemini AI
 * @property {Function} electronAPI.onStreamChunk - Sets up a listener for streaming chunks from Gemini AI
 * @property {Function} electronAPI.removeStreamChunkListener - Removes all stream chunk listeners
 * @property {Function} electronAPI.captureScreenshot - Captures a screenshot using the system's native screenshot tool
 * @property {Function} electronAPI.onGlobalScreenshotTrigger - Sets up a listener for global screenshot trigger
 * @property {Function} electronAPI.removeGlobalScreenshotListener - Removes all global screenshot trigger listeners
 * @property {Function} electronAPI.selectFolder - Opens a dialog to select a folder
 * @property {Function} electronAPI.scanFolder - Scans a folder for images
 * @property {Function} electronAPI.addImageFolder - Adds an image folder to be indexed for search
 * @property {Function} electronAPI.deleteAllImageEmbeddings - Deletes all image embeddings from the index
 * @property {Function} electronAPI.searchImagesByText - Searches indexed images by text description
 * @property {Function} electronAPI.readFileAsBuffer - Reads a file from the file system as a buffer
 * @property {Function} electronAPI.getConvertedHeicPath - Gets the converted JPEG path for a HEIC file
 * @property {Function} electronAPI.getHeicCacheStats - Gets HEIC cache statistics
 * @property {Function} electronAPI.cleanupHeicCache - Cleans up old HEIC cache files
 */
interface Window {
  electronAPI: {
    /**
     * Streams messages with conversation history to the Gemini AI service
     *
     * @param {any[]} messages - Array of message objects with role and content
     * @returns {Promise<{text: string, error?: string}>} Response from Gemini AI or error message
     */
    streamMessageWithHistory: (messages: any[]) => Promise<{ text: string; error?: string }>;

    /**
     * Sets up a listener for streaming chunks from Gemini AI
     *
     * @param {Function} callback - Callback function to handle stream chunks
     */
    onStreamChunk: (callback: (data: { chunk: string; type: "stream" | "log" | "plan" }) => void) => void;

    /**
     * Removes all stream chunk listeners
     */
    removeStreamChunkListener: () => void;

    /**
     * Captures a screenshot using the system's native screenshot tool and saves to clipboard
     *
     * @returns {Promise<{success: boolean, hasImage?: boolean, message?: string, error?: string, imageData?: {data: string, mimeType: string}}>} Screenshot result
     */
    captureScreenshot: () => Promise<{
      success: boolean;
      hasImage?: boolean;
      message?: string;
      error?: string;
      imageData?: {
        data: string;
        mimeType: string;
      };
    }>;

    /**
     * Sets up a listener for global screenshot trigger (Option+Space hotkey)
     *
     * @param {Function} callback - Callback function to handle global screenshot trigger
     */
    onGlobalScreenshotTrigger: (callback: () => void) => void;

    /**
     * Removes all global screenshot trigger listeners
     */
    removeGlobalScreenshotListener: () => void;

    /**
     * Opens a dialog to select a folder
     *
     * @returns {Promise<string | null>} The selected folder path
     */
    selectFolder: () => Promise<string | null>;

    /**
     * Scans a folder for images
     *
     * @param {string} folder - The path to the folder to scan
     * @returns {Promise<{success: boolean, error: string | null, results: any}>} Scan results
     */
    scanFolder: (folder: string) => Promise<{ success: boolean; error: string | null; results: any }>;

    /**
     * Adds an image folder to be indexed for search
     *
     * @param {string} folderPath - The path to the folder to add
     * @returns {Promise<any>} Result of the folder addition
     */
    addImageFolder: (folderPath: string) => Promise<any>;

    /**
     * Deletes all image embeddings from the index
     *
     * @returns {Promise<any>} Result of the deletion operation
     */
    deleteAllImageEmbeddings: () => Promise<any>;

    /**
     * Searches indexed images by text description
     *
     * @param {string} query - The search query text
     * @param {number} limit - Maximum number of results to return
     * @returns {Promise<{success: boolean, error: string | null, results: any[]}>} Search results
     */
    searchImagesByText: (
      query: string,
      limit?: number
    ) => Promise<{ success: boolean; error: string | null; results: any[] }>;

    /**
     * Reads a file from the file system as a buffer
     *
     * @param {string} filePath - The path to the file to read
     * @returns {Promise<Buffer>} The file content as a buffer
     */
    readFileAsBuffer: (filePath: string) => Promise<Buffer>;

    /**
     * Gets the converted JPEG path for a HEIC file (fast native conversion)
     *
     * @param {string} heicPath - The path to the HEIC file
     * @returns {Promise<string | null>} The path to the converted JPEG file or null if conversion failed
     */
    getConvertedHeicPath: (heicPath: string) => Promise<string | null>;

    /**
     * Gets HEIC cache statistics
     *
     * @returns {Promise<{fileCount: number, totalSizeMB: number}>} Cache statistics
     */
    getHeicCacheStats: () => Promise<{ fileCount: number; totalSizeMB: number }>;

    /**
     * Cleans up old HEIC cache files
     *
     * @returns {Promise<{success: boolean, error?: string}>} Cleanup result
     */
    cleanupHeicCache: () => Promise<{ success: boolean; error?: string }>;

  /**
   * Persist a base64 encoded image into the app media directory
   * @param image base64 data (no data URL), mimeType and optional original name
   * @returns absolute filesystem path of the stored image
   */
  saveImageToMedia: (image: { data: string; mimeType: string; name?: string }) => Promise<string>;

    /**
     * Database API: create a new chat session
     */
    dbCreateSession: (title: string, id?: string) => Promise<import("../common/types").ChatSessionRecord>;

    /**
     * Database API: list sessions ordered by recently updated
     */
    dbGetSessions: () => Promise<import("../common/types").ChatSessionRecord[]>;

    /**
     * Database API: get a session by id
     */
    dbGetSession: (id: string) => Promise<import("../common/types").ChatSessionRecord | null>;

    /**
     * Database API: update a session title
     */
    dbUpdateSessionTitle: (id: string, title: string) => Promise<boolean>;

    /**
     * Database API: touch a session to bump updatedAt
     */
    dbTouchSession: (id: string, timestamp: number) => Promise<import("../common/types").ChatSessionRecord | null>;

    /**
     * Database API: delete a session (cascades messages)
     */
    dbDeleteSession: (id: string) => Promise<boolean>;

    /**
     * Database API: add a chat message
     */
    dbAddChatMessage: (
      message: import("../common/types").ChatMessageRecord
    ) => Promise<import("../common/types").ChatMessageRecord>;

    /**
     * Database API: get chat messages for a session
     */
    dbGetChatMessages: (sessionId: string) => Promise<import("../common/types").ChatMessageRecord[]>;

    /**
     * Database API: delete a single chat message by id
     */
    dbDeleteChatMessage: (id: string) => Promise<boolean>;

    /**
     * Database API: delete all messages for a session
     */
    dbDeleteChatMessagesBySession: (sessionId: string) => Promise<number>;
    /**
     * Database API: get all sessions with their messages, limited by number of sessions
     */
    dbGetAllSessionsWithMessages: (limit: number) => Promise<import("../common/types").ChatSessionWithMessages[]>;
  };
}
