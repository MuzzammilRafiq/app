import { streamMessageWithHistory, type ChatMessage } from "../services/llm";
import type { ImageData } from "../services/imageUtils";
import { createNewSession, type ChatSession } from "../services/chatStorage";
interface HandleSendMessageProps {
  content: string;
  images?: ImageData[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
}

export async function handleSendMessage({
  content,
  images,
  currentSessionId,
  messages,
  setSessions,
  setCurrentSessionId,
  setIsLoading,
  setIsStreaming,
}: HandleSendMessageProps) {
  let sessionId = currentSessionId;

  // Create new session if none exists
  if (!sessionId) {
    const newSession = createNewSession();
    sessionId = newSession.id;
    setSessions((prev) => [newSession, ...prev]); //sidebar
    setCurrentSessionId(sessionId); //current
  }

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    content,
    role: "user",
    timestamp: new Date(),
    images: images,
    type: "stream",
  };

  setSessions((prev) =>
    prev.map((session) => {
      if (session.id === sessionId) {
        const updatedSession = {
          ...session,
          messages: [...session.messages, userMessage],
        };
        // Find the first user message to use as session title
        const firstUserMessage = updatedSession.messages.find((msg) => msg.role === "user" && msg.content.trim());
        if (firstUserMessage) {
          const title =
            firstUserMessage.content.length > 50
              ? firstUserMessage.content.substring(0, 47) + "..."
              : firstUserMessage.content;
          return {
            ...updatedSession,
            title: title || "New Chat",
            updatedAt: new Date(),
          };
        }
        return { ...updatedSession, updatedAt: new Date() };
      }
      return session;
    })
  );

  setIsLoading(true);

  // Create placeholder messages for different types
  const baseTimestamp = new Date();
  const planMessageId = (Date.now() + 1).toString();
  const logMessageId = (Date.now() + 2).toString();
  const streamMessageId = (Date.now() + 3).toString();

  // Track which message types we've seen
  const messageTypes = new Set<string>();

  let streamingCompleted = false;
  let streamingStarted = false;

  try {
    const response = await streamMessageWithHistory([...messages, userMessage], (chunk) => {
      if (!streamingStarted) {
        streamingStarted = true;
        setIsLoading(false);
        setIsStreaming(true);
      }
      console.log(JSON.stringify(chunk, null, 2));

      // Create or update message based on chunk type
      const getMessageId = (type: string) => {
        switch (type) {
          case "plan":
            return planMessageId;
          case "log":
            return logMessageId;
          case "stream":
            return streamMessageId;
          default:
            return streamMessageId;
        }
      };

      const messageId = getMessageId(chunk.type);

      // Add message if it's the first time we see this type
      if (!messageTypes.has(chunk.type)) {
        messageTypes.add(chunk.type);
        const newMessage: ChatMessage = {
          id: messageId,
          content: "",
          role: "assistant",
          timestamp: baseTimestamp,
          type: chunk.type as "stream" | "log" | "plan",
        };

        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === sessionId) {
              return {
                ...session,
                messages: [...session.messages, newMessage],
                updatedAt: new Date(),
              };
            }
            return session;
          })
        );
      }

      // Update the message with the new chunk for real-time display
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === sessionId) {
            return {
              ...session,
              messages: session.messages.map((msg: ChatMessage) =>
                msg.id === messageId ? { ...msg, content: msg.content + chunk.chunk } : msg
              ),
              updatedAt: new Date(),
            };
          }
          return session;
        })
      );
    });

    // Streaming completed when the promise resolves
    streamingCompleted = true;
    setIsStreaming(false);

    // Only handle error if streaming didn't complete successfully
    // This prevents overwriting successful responses with error messages
    if (response.error && !streamingCompleted) {
      let errorContent = "An error occurred";

      try {
        // Try to parse as JSON first for structured error responses
        const parsedError = JSON.parse(response.error);
        errorContent = parsedError.error?.message || parsedError.message || response.error;
      } catch {
        // If JSON parsing fails, treat as plain string error
        errorContent = response.error;
      }

      // Add error message as a separate stream message
      const errorMessageId = (Date.now() + 10).toString();
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        content: errorContent,
        role: "assistant",
        timestamp: new Date(),
        type: "stream",
        isError: true,
      };

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === sessionId) {
            return {
              ...session,
              messages: [...session.messages, errorMessage],
              updatedAt: new Date(),
            };
          }
          return session;
        })
      );
    }
  } catch (err) {
    console.log(err);
    if (!streamingCompleted) {
      // Add error message as a separate stream message
      const errorMessageId = (Date.now() + 11).toString();
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        content: "Failed to send message. Please try again.",
        role: "assistant",
        timestamp: new Date(),
        type: "stream",
        isError: true,
      };

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === sessionId) {
            return {
              ...session,
              messages: [...session.messages, errorMessage],
              updatedAt: new Date(),
            };
          }
          return session;
        })
      );
    }
  } finally {
    setIsLoading(false);
    if (!streamingCompleted) {
      setIsStreaming(false);
    }
  }
}
