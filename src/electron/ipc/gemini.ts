import { ipcMain } from 'electron';
import chalk from 'chalk';
import { ToolHandler } from '../tools/toolHandler.js';
import { aiService } from '../services/aiService.js';

// Get the global AI instance
const ai = aiService.getAI();

// Initialize tool handler
const toolHandler = ToolHandler.getInstance();

// Global AbortController for cancelling streaming requests
let currentStreamAbortController: AbortController | null = null;

// IPC handler for sending single messages to Gemini AI
export function setupGeminiHandlers() {
  ipcMain.handle('gemini:send-message', async (event, message: string) => {
    // Check if AI service is properly initialized
    if (!aiService.isInitialized()) {
      return {
        text: '',
        error:
          'Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.',
      };
    }

    try {
      // Process message through tool handler first
      const { enhancedMessage } = await toolHandler.processMessage(message);

      // Log the enhanced message after tool calling
      console.log(chalk.blue('[Gemini] Enhanced message after tool calling:'));
      console.log(chalk.gray(enhancedMessage));

      // Send enhanced message to Gemini API with specific model and configuration
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Using flash model for faster responses
        contents: enhancedMessage,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking budget for faster response
          },
        },
      });

      return {
        text: response.text || 'No response received',
      };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return {
        text: '',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });

  // IPC handler for sending conversation history to Gemini AI
  ipcMain.handle(
    'gemini:send-message-with-history',
    async (event, messages: any[]) => {
      // Check if AI service is properly initialized
      if (!aiService.isInitialized()) {
        return {
          text: '',
          error:
            'Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.',
        };
      }

      try {
        // Process the last user message through tool handler
        const lastUserMessage = messages
          .filter(msg => msg.role === 'user' && msg.content)
          .pop();
        let processedMessages = [...messages];

        if (lastUserMessage) {
          const { enhancedMessage, toolResults } =
            await toolHandler.processMessage(lastUserMessage.content);

          // Log the enhanced message after tool calling
          console.log(
            chalk.blue('[Gemini History] Enhanced message after tool calling:')
          );
          console.log(chalk.gray(enhancedMessage));

          // Update the last user message with enhanced content
          processedMessages = messages.map(msg => {
            if (msg === lastUserMessage) {
              return {
                ...msg,
                content: enhancedMessage,
              };
            }
            return msg;
          });

          // Log tool results for debugging
          if (toolResults.length > 0) {
            console.log(
              `[Gemini] Applied ${toolResults.length} tool results to message`
            );
          }
        }

        // Transform message history to Gemini API format
        const contents = processedMessages.map(msg => {
          const parts = [];

          // Add text content if present
          if (msg.content) {
            parts.push({ text: msg.content });
          }

          // Add image data if present
          if (msg.images && msg.images.length > 0) {
            for (const image of msg.images) {
              parts.push({
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data,
                },
              });
            }
          }

          return {
            role: msg.role === 'user' ? 'user' : 'model',
            parts: parts,
          };
        });

        // Send conversation history to Gemini API
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });

        return {
          text: response.text || 'No response received',
        };
      } catch (error) {
        console.error('Error calling Gemini API:', error);
        return {
          text: '',
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  // IPC handler for streaming conversation history to Gemini AI
  ipcMain.handle(
    'gemini:stream-message-with-history',
    async (event, messages: any[]) => {
      // Check if AI service is properly initialized
      if (!aiService.isInitialized()) {
        return {
          text: '',
          error:
            'Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.',
        };
      }

      // Cancel any existing streaming request
      if (currentStreamAbortController) {
        currentStreamAbortController.abort();
        currentStreamAbortController = null;
      }

      // Create new AbortController for this request
      currentStreamAbortController = new AbortController();
      const abortController = currentStreamAbortController;

      try {
        // Process the last user message through tool handler
        const lastUserMessage = messages
          .filter(msg => msg.role === 'user' && msg.content)
          .pop();
        let processedMessages = [...messages];

        if (lastUserMessage) {
          const { enhancedMessage, toolResults } =
            await toolHandler.processMessage(lastUserMessage.content);

          // Log the enhanced message after tool calling
          console.log(
            chalk.blue('[Gemini Stream] Enhanced message after tool calling:')
          );
          console.log(chalk.green(enhancedMessage));

          // Update the last user message with enhanced content
          processedMessages = messages.map(msg => {
            if (msg === lastUserMessage) {
              return {
                ...msg,
                content: enhancedMessage,
              };
            }
            return msg;
          });

          // Log tool results for debugging
          if (toolResults.length > 0) {
            console.log(
              `[Gemini Stream] Applied ${toolResults.length} tool results to message`
            );
          }
        }

        // Transform message history to Gemini API format
        const contents = processedMessages.map(msg => {
          const parts = [];

          // Add text content if present
          if (msg.content) {
            parts.push({ text: msg.content });
          }

          // Add image data if present
          if (msg.images && msg.images.length > 0) {
            for (const image of msg.images) {
              parts.push({
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data,
                },
              });
            }
          }

          return {
            role: msg.role === 'user' ? 'user' : 'model',
            parts: parts,
          };
        });

        // Create streaming response
        const result = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });

        let fullText = '';

        // Stream the response chunks
        for await (const chunk of result) {
          // Check if request was aborted
          if (abortController.signal.aborted) {
            console.log(chalk.yellow('[Gemini Stream] Request was aborted'));
            // Send abort signal to renderer
            event.sender.send('gemini:stream-chunk', {
              chunk: '',
              isComplete: true,
              fullText,
              aborted: true,
            });
            return {
              text: fullText,
              aborted: true,
            };
          }

          const chunkText = chunk.text;
          if (chunkText) {
            fullText += chunkText;
            // Send chunk to renderer process
            event.sender.send('gemini:stream-chunk', {
              chunk: chunkText,
              isComplete: false,
            });
          }
        }

        // Send completion signal
        event.sender.send('gemini:stream-chunk', {
          chunk: '',
          isComplete: true,
          fullText,
        });

        // Clear the abort controller since we completed successfully
        if (currentStreamAbortController === abortController) {
          currentStreamAbortController = null;
        }

        return {
          text: fullText,
        };
      } catch (error) {
        console.error('Error calling Gemini API with streaming:', error);

        // Clear the abort controller on error
        if (currentStreamAbortController === abortController) {
          currentStreamAbortController = null;
        }

        // Check if this was due to an abort
        if (error && (error as any).name === 'AbortError') {
          console.log(chalk.yellow('[Gemini Stream] Request was aborted'));
          return {
            text: '',
            aborted: true,
          };
        }

        return {
          text: '',
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );

  // IPC handler for stopping AI response
  ipcMain.handle('gemini:stop-response', async event => {
    try {
      if (currentStreamAbortController) {
        console.log(chalk.yellow('[Gemini] Stopping AI response...'));
        currentStreamAbortController.abort();
        currentStreamAbortController = null;
        return { success: true };
      } else {
        console.log(chalk.gray('[Gemini] No active streaming request to stop'));
        return { success: false, message: 'No active streaming request' };
      }
    } catch (error) {
      console.error('Error stopping AI response:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}
