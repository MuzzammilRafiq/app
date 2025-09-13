import { useRef, useState } from "react";
import ChatMessage from "./chat-message";
import PlanRenderer from "./plan-renderer";
import MarkdownRenderer from "./message-renderer";
import toast from "react-hot-toast";
import { useStore } from "../../utils/store";
import { type ImageData } from "../../services/imageUtils";

import type { ChatMessageRecord, ChatType, StreamChunk } from "../../../common/types";
import LogRenderer from "./log-renderer";

import EmptyChat from "./empty-chat";
import ChatInput from "./chat-input";
interface Segment {
  id: string;
  type: ChatType;
  content: string; // accumulated content for this contiguous segment
}
export default function ChatContainer() {
  const currentSession = useStore((s) => s.currentSession);
  const addMessage = useStore((s) => s.addMessage);
  const createNewSession = useStore((s) => s.createNewSession);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [segments, setSegments] = useState<Segment[]>([]);
  const segmentsRef = useRef<Segment[]>([]);
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  const handleSendMessage = async () => {
    // Trim once
    const trimmedContent = content.trim();

    if (!trimmedContent && !selectedImage) {
      // Nothing to send
      return;
    }
    if (isLoading || isStreaming) {
      return; // Prevent concurrent sends
    }

    let session = currentSession;
    if (!session) {
      try {
        const newSessionRecord = await window.electronAPI.dbCreateSession("New Chat");
        createNewSession(newSessionRecord);
        session = { ...newSessionRecord, messages: [] } as any; // fallback local reference
      } catch (e) {
        toast.error("Failed to create chat session");
        return;
      }
    }
    if (!session) return; // TS safety

    console.log("Sending message:", { trimmedContent, hasImage: !!selectedImage, sessionId: session.id });
    // Optimistically clear input for snappy UI
    setContent("");

    if (trimmedContent || selectedImage) {
      setIsLoading(true);
      try {
        let storedImagePaths: string[] | null = null;
        // Save newly selected (unsaved) image if present (base64 in selectedImage)
        if (selectedImage) {
          try {
            const savedPath = await window.electronAPI.saveImageToMedia({
              data: selectedImage.data,
              mimeType: selectedImage.mimeType,
              name: selectedImage.name,
            });
            storedImagePaths = [savedPath];
          } catch (err) {
            console.error("Failed to persist image:", err);
            toast.error("Failed to save image");
          }
        } else if (imagePaths && imagePaths.length > 0) {
          // If imagePaths already provided (e.g., from search) reuse them
          storedImagePaths = imagePaths;
        }

        const messageRecord = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          content: trimmedContent,
          role: "user" as const,
          timestamp: Date.now(),
          isError: "",
          imagePaths: storedImagePaths,
          type: "user" as const,
        };

        const newMessage = await window.electronAPI.dbAddChatMessage(messageRecord);
        const updatedSession = await window.electronAPI.dbTouchSession(session.id, Date.now())!;
        if (!updatedSession) {
          throw new Error("Failed to update session timestamp");
        }
        addMessage(newMessage, updatedSession);

        // Prepare for streaming BEFORE invoking backend so we don't miss early chunks
        setIsStreaming(true);
        segmentsRef.current = [];
        setSegments([]);

        // Attach listener immediately
        const handleStreamChunk = (data: StreamChunk) => {
          setSegments((prev) => {
            const updated = [...prev];
            if (data.type === "plan") {
              // Plan is single; overwrite if exists else insert at end
              const existingIndex = updated.findIndex((s) => s.type === "plan");
              if (existingIndex >= 0) {
                const existing = updated[existingIndex];
                if (existing) {
                  updated[existingIndex] = { id: existing.id, type: existing.type, content: data.chunk };
                }
              } else {
                updated.push({ id: crypto.randomUUID(), type: "plan", content: data.chunk });
              }
            } else {
              const last = updated[updated.length - 1];
              if (last && last.type === data.type) {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.chunk,
                };
                // last.content += data.chunk;
              } else {
                updated.push({ id: crypto.randomUUID(), type: data.type, content: data.chunk });
              }
            }
            segmentsRef.current = updated;
            return updated;
          });
        };

        // Register listener
        window.electronAPI.onStreamChunk(handleStreamChunk);

        try {
          // Build history using messages BEFORE adding new message (currentSession is pre-add) + newMessage
          const existingMessages = currentSession?.messages ? [...currentSession.messages] : [];
          const history = existingMessages.concat([newMessage]);
          await window.electronAPI.streamMessageWithHistory(history);
          // After stream completes, persist each segment in arrival order
          for (const seg of segmentsRef.current) {
            let contentToSave = seg.content;
            if (seg.type === "plan") {
              // Sanitize plan: keep array or object as is; attempt to extract array if contamination
              try {
                const parsed = JSON.parse(contentToSave);
                if (Array.isArray(parsed)) {
                  contentToSave = JSON.stringify(parsed);
                } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).steps)) {
                  // leave as-is (could contain logs in unified object if future change)
                }
              } catch {
                const match = contentToSave.match(/\[[\s\S]*?\]/);
                if (match) contentToSave = match[0];
              }
            }
            const record = {
              id: String(crypto.randomUUID()),
              sessionId: session.id,
              content: contentToSave.trim(),
              role: "assistant" as const,
              timestamp: Date.now(),
              isError: "",
              imagePaths: null as null,
              type: seg.type,
            };
            const saved = await window.electronAPI.dbAddChatMessage(record);
            const touched = await window.electronAPI.dbTouchSession(session.id, Date.now());
            if (touched) {
              addMessage(saved, touched);
            }
          }
        } catch (streamErr) {
          console.error("Streaming error:", streamErr);
          toast.error("Streaming failed");
        } finally {
          window.electronAPI.removeStreamChunkListener();
          setIsStreaming(false);
          segmentsRef.current = [];
          setSegments([]);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        toast.error("Failed to send message");
      } finally {
        setIsLoading(false);
      }
    }
    // Clear image paths after sending
    setImagePaths(null);
    setSelectedImage(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {currentSession && currentSession.messages.length > 0 ? (
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 pb-8 space-y-4 hide-scrollbar max-w-[80%] mx-auto">
            {(() => {
              if (!currentSession?.messages) return null;

              const groupedMessages: Array<{
                userMessage: ChatMessageRecord | null;
                assistantMessages: ChatMessageRecord[];
              }> = [];

              let currentGroup = {
                userMessage: null as ChatMessageRecord | null,
                assistantMessages: [] as ChatMessageRecord[],
              };

              for (const message of currentSession.messages) {
                if (message.role === "user") {
                  // Start new group with user message
                  if (currentGroup.userMessage || currentGroup.assistantMessages.length > 0) {
                    groupedMessages.push(currentGroup);
                  }
                  currentGroup = { userMessage: message, assistantMessages: [] };
                } else {
                  // Add assistant message to current group
                  currentGroup.assistantMessages.push(message);
                }
              }

              // Add final group if it has content
              if (currentGroup.userMessage || currentGroup.assistantMessages.length > 0) {
                groupedMessages.push(currentGroup);
              }

              return groupedMessages.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-4">
                  {/* Render user message */}
                  {group.userMessage && <ChatMessage key={group.userMessage.id} {...group.userMessage} />}

                  {/* Render assistant messages in two sections */}
                  {group.assistantMessages.length > 0 && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] break-words overflow-hidden overflow-wrap-anywhere text-slate-800 px-4 py-2.5 space-y-4">
                        {/* Top section: Plans and Logs */}

                        {group.assistantMessages
                          .filter((msg) => msg.type === "plan")
                          .map((msg) => (
                            <PlanRenderer content={msg.content} />
                          ))}

                        {group.assistantMessages
                          .filter((msg) => msg.type === "log")
                          .map((msg) => (
                            <div key={msg.id}>
                              <LogRenderer content={msg.content} />
                            </div>
                          ))}
                        {/* Bottom section: Stream messages */}
                        {group.assistantMessages
                          .filter((msg) => msg.type === "stream")
                          .map((msg) => (
                            <div key={msg.id} className="prose prose-sm max-w-none">
                              <MarkdownRenderer content={msg.content} isUser={false} />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ));
            })()}
            {/* Live streaming assistant message preview (not yet stored) */}
            {isStreaming && segments.length > 0 && (
              <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/40 animate-pulse space-y-4">
                <div className="max-h-60 overflow-y-auto">
                  {/* Render plan */}
                  {segments.find((seg) => seg.type === "plan") && (
                    <PlanRenderer content={segments.find((seg) => seg.type === "plan")!.content} />
                  )}

                  {/* Render log as simple text */}
                  {segments.find((seg) => seg.type === "log") && (
                    <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {segments.find((seg) => seg.type === "log")!.content}
                    </div>
                  )}
                </div>

                {/* Render other segments (stream) separately */}
                {segments
                  .filter((seg) => seg.type === "stream")
                  .map((seg) => (
                    <div
                      key={seg.id}
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: seg.content.replace(/\n/g, "<br/>") }}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyChat />
      )}
      <ChatInput
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        imagePaths={imagePaths}
        setImagePaths={setImagePaths}
        content={content}
        setContent={setContent}
        isLoading={isLoading}
        isStreaming={isStreaming}
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
}
