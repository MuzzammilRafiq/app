import { useRef, useState, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import PlanRenderer from "./response-renders/plan-renderer";
import MarkdownRenderer from "./response-renders/message-renderer";
import toast from "react-hot-toast";
import { useStore } from "../utils/store";
import { fileToBase64, validateImageFile, type ImageData } from "../services/imageUtils";
import { ImageSVG, LoadingSVG, PauseSVG, RemoveSVG, SearchSVG, SendSVG } from "./icons";
import SearchModal from "./SearchModal";
import type { ChatMessageRecord } from "../../common/types";

export default function ChatContainer() {
  const currentSession = useStore((s) => s.currentSession);
  const addMessage = useStore((s) => s.addMessage);
  const createNewSession = useStore((s) => s.createNewSession);
  // const chatInputRef = useRef<{ addImage: (image: ImageData) => void }>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // Ordered streaming segments as they arrive
  type SegmentType = "plan" | "log" | "stream";
  interface Segment {
    id: string;
    type: SegmentType;
    content: string; // accumulated content for this contiguous segment
  }
  const [segments, setSegments] = useState<Segment[]>([]);
  const segmentsRef = useRef<Segment[]>([]);
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const handleChunk = (data: { chunk: string; type: SegmentType }) => {
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
                last.content += data.chunk;
              } else {
                updated.push({ id: crypto.randomUUID(), type: data.type, content: data.chunk });
              }
            }
            segmentsRef.current = updated;
            return updated;
          });
        };
        window.electronAPI.onStreamChunk(handleChunk);

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
              id: crypto.randomUUID(),
              sessionId: session.id,
              content: contentToSave.trim(),
              role: "assistant" as const,
              timestamp: Date.now(),
              isError: "",
              imagePaths: null as null,
              type: seg.type as SegmentType,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImage(true);

    try {
      const file = files[0];
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid image file");
        return;
      }

      const base64Data = await fileToBase64(file);

      const newImage: ImageData = {
        data: base64Data,
        mimeType: file.type,
        name: file.name,
      };

      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(newImage);

      toast.success(hadPreviousImage ? "Image replaced successfully" : "Image added successfully");
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image");
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    let imageItem: DataTransferItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      if (item.type.startsWith("image/")) {
        imageItem = item;
        break;
      }
    }

    if (!imageItem) return;

    event.preventDefault();
    setIsProcessingImage(true);

    try {
      const file = imageItem.getAsFile();
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid image file");
        return;
      }

      const base64Data = await fileToBase64(file);

      const newImage: ImageData = {
        data: base64Data,
        mimeType: file.type,
        name: "Pasted Image",
      };

      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(newImage);

      toast.success(hadPreviousImage ? "Image replaced successfully" : "Image pasted successfully");
    } catch (error) {
      console.error("Error processing pasted image:", error);
      toast.error("Failed to process pasted image");
    } finally {
      setIsProcessingImage(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleImageSelect = async (imagePath: string) => {
    setIsProcessingImage(true);
    try {
      // Instead of loading into memory, just store the path and display using file protocol via secure rendering
      setImagePaths([imagePath]);
      setSelectedImage(null); // clear any base64 selected image to avoid duplicate save
      toast.success("Image selected from search");
    } catch (error) {
      console.error("Error loading selected image:", error);
      toast.error("Failed to load selected image");
    } finally {
      setIsProcessingImage(false);
    }
  };

  //  useImperativeHandle(ref, () => ({
  //    addImage: (image: ImageData) => {
  //      const hadPreviousImage = selectedImage !== null;
  //      setSelectedImage(image);
  //      toast.success(hadPreviousImage ? "Image replaced successfully" : "Image added successfully");
  //    },
  //  }));

  const iconClass =
    "p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center justify-center border border-gray-200 cursor-pointer hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600 disabled:hover:bg-transparent disabled:hover:border-gray-200";

  // Removed global streaming effect; listener is managed per send to avoid duplicates.

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
                        <div className="max-h-60 overflow-y-auto">
                          {group.assistantMessages
                            .filter((msg) => msg.type === "plan")
                            .map((msg) => (
                              <div key={msg.id}>
                                <PlanRenderer content={msg.content} />
                              </div>
                            ))}

                          {group.assistantMessages
                            .filter((msg) => msg.type === "log")
                            .map((msg) => (
                              <div key={msg.id} className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">
                                {msg.content}
                              </div>
                            ))}
                        </div>

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
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-2xl mb-4 text-blue-700">👋 How can I help you ?</h1>
        </div>
      )}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className=" px-2 pt-2 chat-input rounded-b-3xl rounded-t-3xl min-w-3xl border-1 border-gray-300 shadow-lg">
          {/* Selected image preview above textarea */}
          {(selectedImage || (imagePaths && imagePaths.length > 0)) && (
            <div className="w-full flex justify-start mb-2">
              <div className="flex items-center gap-2 bg-gray-50/80 rounded-lg p-2 border border-gray-200/60">
                {selectedImage ? (
                  <img
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
                    alt={selectedImage.name || "Selected Image"}
                    className="w-14 h-14 object-cover rounded-md border border-gray-200/60"
                  />
                ) : (
                  <img
                    src={`file://${imagePaths![0]}`}
                    alt={"Selected Image"}
                    className="w-14 h-14 object-cover rounded-md border border-gray-200/60"
                  />
                )}
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePaths(null);
                  }}
                  className="p-1.5 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors duration-150"
                  title="Remove image"
                  type="button"
                >
                  {RemoveSVG}
                </button>
              </div>
            </div>
          )}
          {/* textarea */}
          <div className="text-gray-500">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask or Act"
              disabled={isLoading || isStreaming}
              className="w-full px-4 py-3 resize-none max-h-32 min-h-[48px]"
              rows={1}
            />
          </div>
          {/* tools */}
          <div className="flex-1 relative">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <div className="flex items-center justify-between w-full gap-2 relative py-2 px-1">
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isProcessingImage}
                  className={iconClass + " shadow-sm bg-white border border-gray-200"}
                  title={selectedImage ? "Replace Image" : "Upload Image"}
                  type="button"
                >
                  {isProcessingImage ? LoadingSVG : ImageSVG}
                </button>
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  disabled={isLoading}
                  className={iconClass + " shadow-sm bg-white border border-gray-200"}
                  title="Search Images"
                  type="button"
                >
                  {SearchSVG}
                </button>
              </div>
              {/* Right group: send button */}
              <div className="flex items-center ml-auto">
                <button
                  onClick={handleSendMessage}
                  disabled={(!content.trim() && !selectedImage) || isLoading || isStreaming}
                  className={iconClass}
                  type="button"
                >
                  {isLoading ? LoadingSVG : isStreaming ? PauseSVG : SendSVG}
                </button>
              </div>
            </div>
          </div>
          <SearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            onSelectImage={handleImageSelect}
          />
        </div>
      </div>
    </div>
  );
}
