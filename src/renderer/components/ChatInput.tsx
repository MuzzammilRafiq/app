import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { fileToBase64, validateImageFile, type ImageData } from "../services/geminiService";
import toast from "react-hot-toast";

interface ChatInputProps {
  onSendMessage: (message: string, images?: ImageData[]) => void;
  isLoading: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onScreenshot?: () => void;
}

export interface ChatInputHandle {
  addImage: (image: ImageData) => void;
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSendMessage, isLoading, isStreaming = false, disabled = false, onScreenshot },
  ref
) {
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if ((trimmedMessage || selectedImage) && !isLoading && !isStreaming && !disabled) {
      onSendMessage(trimmedMessage, selectedImage ? [selectedImage] : undefined);
      setMessage("");
      setSelectedImage(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImage(true);

    try {
      // Only process the first file to ensure single image constraint
      const file = files[0];
      if (!file) return;

      // Validate the file
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid image file");
        return;
      }

      // Convert to base64
      const base64Data = await fileToBase64(file);

      const newImage: ImageData = {
        data: base64Data,
        mimeType: file.type,
        name: file.name,
      };

      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(newImage);

      if (hadPreviousImage) {
        toast.success("Image replaced successfully");
      } else {
        toast.success("Image added successfully");
      }
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image");
    } finally {
      setIsProcessingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsProcessingImage(true);

    try {
      // Only process the first image file to ensure single image constraint
      let processedFile: File | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // Only process image files
        if (file.type.startsWith("image/")) {
          processedFile = file;
          break; // Take the first image file found
        }
      }

      if (!processedFile) {
        toast.error("No image files found in the dropped items");
        return;
      }

      // Validate the file
      const validation = validateImageFile(processedFile);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid image file");
        return;
      }

      // Convert to base64
      const base64Data = await fileToBase64(processedFile);

      const newImage: ImageData = {
        data: base64Data,
        mimeType: processedFile.type,
        name: processedFile.name,
      };

      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(newImage);

      if (hadPreviousImage) {
        toast.success("Image replaced successfully");
      } else {
        toast.success("Image added successfully");
      }
    } catch (error) {
      console.error("Error processing dropped image:", error);
      toast.error("Failed to process dropped image");
    } finally {
      setIsProcessingImage(false);
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
        break; // Take the first image found
      }
    }

    if (!imageItem) return;

    event.preventDefault();
    setIsProcessingImage(true);

    try {
      const file = imageItem.getAsFile();
      if (!file) return;

      // Validate the file
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid image file");
        return;
      }

      // Convert to base64
      const base64Data = await fileToBase64(file);

      const newImage: ImageData = {
        data: base64Data,
        mimeType: file.type,
        name: "Pasted Image",
      };

      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(newImage);

      if (hadPreviousImage) {
        toast.success("Image replaced successfully");
      } else {
        toast.success("Image pasted successfully");
      }
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
  }, [message]);

  useImperativeHandle(ref, () => ({
    addImage: (image: ImageData) => {
      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(image);

      if (hadPreviousImage) {
        toast.success("Image replaced successfully");
      } else {
        toast.success("Image added successfully");
      }
    },
  }));

  return (
    <div className="border-t border-gray-200 p-6 bg-white shadow-lg" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Image preview section */}
      {selectedImage && (
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative group">
            <img
              src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
              alt={selectedImage.name || "Selected Image"}
              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
              title="Remove image"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end space-x-3">
        {/* Hidden file input - removed multiple attribute */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

        {/* Image upload button */}
        <button
          onClick={triggerImageUpload}
          disabled={isLoading || disabled || isProcessingImage}
          className="p-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title={selectedImage ? "Replace Image" : "Upload Image"}
        >
          {isProcessingImage ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyUp={handleKeyPress}
            onPaste={handlePaste}
            placeholder={
              selectedImage ? "Type your message about the image..." : "Type your message or upload an image..."
            }
            disabled={isLoading || disabled}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32 min-h-[48px] disabled:bg-gray-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200 placeholder-gray-400"
            rows={1}
          />
        </div>

        {onScreenshot && (
          <button
            onClick={onScreenshot}
            className="p-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300"
            title="Take Screenshot"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        <button
          onClick={handleSend}
          disabled={(!message.trim() && !selectedImage) || isLoading || isStreaming || disabled}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
        >
          {isLoading ? (
            // Loading state with spinner animation
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Sending...</span>
            </>
          ) : isStreaming ? (
            // Streaming state with typing indicator
            <>
              <div className="w-4 h-4 flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                  <div
                    className="w-1 h-1 bg-white rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-1 h-1 bg-white rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
              <span>Streaming...</span>
            </>
          ) : (
            // Normal send button state
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span>Send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});

export default ChatInput;
