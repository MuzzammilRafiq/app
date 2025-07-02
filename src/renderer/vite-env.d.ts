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
 * @property {Function} electronAPI.sendMessage - Sends a single message to Gemini AI
 * @property {Function} electronAPI.sendMessageWithHistory - Sends messages with conversation history to Gemini AI
 */
interface Window {
  electronAPI: {
    /**
     * Sends a single message to the Gemini AI service
     *
     * @param {string} message - The message to send to Gemini AI
     * @returns {Promise<{text: string, error?: string}>} Response from Gemini AI or error message
     */
    sendMessage: (message: string) => Promise<{ text: string; error?: string }>;

    /**
     * Sends messages with conversation history to the Gemini AI service
     *
     * @param {any[]} messages - Array of message objects with role and content
     * @returns {Promise<{text: string, error?: string}>} Response from Gemini AI or error message
     */
    sendMessageWithHistory: (
      messages: any[]
    ) => Promise<{ text: string; error?: string }>;

    /**
     * Streams messages with conversation history to the Gemini AI service
     *
     * @param {any[]} messages - Array of message objects with role and content
     * @returns {Promise<{text: string, error?: string}>} Response from Gemini AI or error message
     */
    streamMessageWithHistory: (
      messages: any[]
    ) => Promise<{ text: string; error?: string }>;

    /**
     * Sets up a listener for streaming chunks from Gemini AI
     *
     * @param {Function} callback - Callback function to handle stream chunks
     */
    onStreamChunk: (
      callback: (data: {
        chunk: string;
        isComplete: boolean;
        fullText?: string;
      }) => void
    ) => void;

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
  };
}
