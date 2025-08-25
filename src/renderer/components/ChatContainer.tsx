import { useRef, useState, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import toast from "react-hot-toast";
import { useStore } from "../utils/store";
import { fileToBase64, validateImageFile, type ImageData } from "../services/imageUtils";
import { ImageSVG, LoadingSVG, PauseSVG, RemoveSVG, SearchSVG, SendSVG } from "./icons";
import SearchModal from "./SearchModal";

export default function ChatContainer() {
  const currentSession = useStore((s) => s.currentSession);
  const addMessage = useStore((s) => s.addMessage);
  // const chatInputRef = useRef<{ addImage: (image: ImageData) => void }>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming] = useState(false); // streaming state placeholder
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async () => {
    if (!currentSession) return;
    const trimmedContent = content.trim();
    console.log("Sending message with content:", { trimmedContent, selectedImage, imagePaths, isLoading, isStreaming });
    // Clear the input field immediately to improve responsiveness
    setContent("");
    console.log((trimmedContent || selectedImage) && (isLoading || isStreaming));
    if ((trimmedContent || selectedImage) && !isLoading && !isStreaming) {
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
          sessionId: currentSession.id,
          content,
          role: "user" as const,
          timestamp: Date.now(),
          isError: "",
          imagePaths: storedImagePaths,
          type: "user" as const,
        };

        const newMessage = await window.electronAPI.dbAddChatMessage(messageRecord);
        const updatedSession = await window.electronAPI.dbTouchSession(currentSession.id, Date.now())!;
        if (!updatedSession) {
          throw new Error("Failed to update session timestamp");
        }
        addMessage(newMessage, updatedSession);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  return (
    <div className="flex-1 flex flex-col h-full">
      {currentSession && currentSession.messages.length > 0 ? (
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 pb-8 space-y-4 hide-scrollbar max-w-[80%] mx-auto">
            {currentSession.messages.map((message) => (
              <ChatMessage key={message.id} {...message} />
            ))}
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
              onKeyUp={handleKeyPress}
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
              {/* Left group: image, screenshot, and clear chat buttons */}
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
                {/* {onScreenshot && (
                      <button
                        onClick={onScreenshot}
                        disabled={isLoading}
                        className={iconClass + " shadow-sm bg-white border border-gray-200"}
                        title="Take Screenshot"
                        type="button"
                      >
                        {ScreenshotSVG}
                      </button>
                    )} */}
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
