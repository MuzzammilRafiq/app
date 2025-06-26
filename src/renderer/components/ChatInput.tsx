import { useState, useRef, useEffect } from "react";
import { fileToBase64, validateImageFile, type ImageData } from "../services/geminiService";
import toast from "react-hot-toast";

interface ChatInputProps {
  onSendMessage: (message: string, images?: ImageData[]) => void;
  isLoading: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onScreenshot?: () => void;
}

export default function ChatInput({
  onSendMessage,
  isLoading,
  isStreaming = false,
  disabled = false,
  onScreenshot,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<ImageData[]>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if ((trimmedMessage || selectedImages.length > 0) && !isLoading && !isStreaming && !disabled) {
      onSendMessage(trimmedMessage, selectedImages.length > 0 ? selectedImages : undefined);
      setMessage("");
      setSelectedImages([]);
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
      const newImages: ImageData[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue; // Skip if file is undefined

        // Validate the file
        const validation = validateImageFile(file);
        if (!validation.isValid) {
          toast.error(validation.error || "Invalid image file");
          continue;
        }

        // Convert to base64
        const base64Data = await fileToBase64(file);

        newImages.push({
          data: base64Data,
          mimeType: file.type,
          name: file.name,
        });
      }

      if (newImages.length > 0) {
        setSelectedImages((prev) => [...prev, ...newImages]);
        toast.success(`Added ${newImages.length} image${newImages.length > 1 ? "s" : ""}`);
      }
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error("Failed to process image(s)");
    } finally {
      setIsProcessingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
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
      const newImages: ImageData[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // Only process image files
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        // Validate the file
        const validation = validateImageFile(file);
        if (!validation.isValid) {
          toast.error(validation.error || "Invalid image file");
          continue;
        }

        // Convert to base64
        const base64Data = await fileToBase64(file);

        newImages.push({
          data: base64Data,
          mimeType: file.type,
          name: file.name,
        });
      }

      if (newImages.length > 0) {
        setSelectedImages((prev) => [...prev, ...newImages]);
        toast.success(`Added ${newImages.length} image${newImages.length > 1 ? "s" : ""}`);
      }
    } catch (error) {
      console.error("Error processing dropped images:", error);
      toast.error("Failed to process dropped image(s)");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    let hasImages = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      if (item.type.startsWith("image/")) {
        hasImages = true;
        break;
      }
    }

    if (!hasImages) return;

    event.preventDefault();
    setIsProcessingImage(true);

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;

        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          // Validate the file
          const validation = validateImageFile(file);
          if (!validation.isValid) {
            toast.error(validation.error || "Invalid image file");
            continue;
          }

          // Convert to base64
          const base64Data = await fileToBase64(file);

          const newImage: ImageData = {
            data: base64Data,
            mimeType: file.type,
            name: "Pasted Image",
          };

          setSelectedImages((prev) => [...prev, newImage]);
          toast.success("Image pasted successfully");
        }
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

  return (
    <div className="border-t border-gray-200 p-6 bg-white shadow-lg" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Image preview section */}
      {selectedImages.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedImages.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={`data:${image.mimeType};base64,${image.data}`}
                alt={image.name || `Image ${index + 1}`}
                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end space-x-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Image upload button */}
        <button
          onClick={triggerImageUpload}
          disabled={isLoading || disabled || isProcessingImage}
          className="p-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Upload Images"
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
            placeholder="Type your message or upload images..."
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
          disabled={(!message.trim() && selectedImages.length === 0) || isLoading || isStreaming || disabled}
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
}
