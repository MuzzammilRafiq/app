import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { fileToBase64, validateImageFile, type ImageData } from "../services/imageUtils";
import toast from "react-hot-toast";
import { ImageSVG, LoadingSVG, PauseSVG, RemoveSVG, ScreenshotSVG, SearchSVG, SendSVG } from "./icons";
import SearchModal from "./SearchModal";

export interface Status {
  isStreaming: boolean;
  isLoading: boolean;
}
interface ChatInputProps {
  onSendMessage: (selectedImage: ImageData | null, content: string, imagePaths: string[] | null) => Promise<void>;
  status: Status;
  setStatus: React.Dispatch<React.SetStateAction<Status>>;
  onScreenshot?: () => void;
  imagePaths: string[] | null;
  setImagePaths: React.Dispatch<React.SetStateAction<string[] | null>>;
}
export interface ChatInputHandle {
  addImage: (image: ImageData) => void;
}

function ChatInput(props: ChatInputProps, ref: React.Ref<ChatInputHandle>) {
  const { onSendMessage, status, setStatus, onScreenshot, imagePaths, setImagePaths } = props;
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmedContent = content.trim();
    if ((trimmedContent || selectedImage) && !status.isLoading && !status.isStreaming) {
      setStatus({ ...status, isLoading: true });
      onSendMessage(selectedImage, trimmedContent, imagePaths);
      setStatus({ ...status, isLoading: false });
      setContent("");
      setSelectedImage(null);
      setImagePaths(null);
      //TODO - update local images using usestate
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
      // Read the image file and convert to base64
      const response = await fetch(`file://${imagePath}`);
      const blob = await response.blob();

      // Create a File object from the blob
      const fileName = imagePath.split("/").pop() || "selected-image";

      // Determine MIME type for HEIC files if not detected
      let mimeType = blob.type;
      if (!mimeType && (fileName.toLowerCase().endsWith(".heic") || fileName.toLowerCase().endsWith(".heif"))) {
        mimeType = "image/heic";
      }

      const file = new File([blob], fileName, { type: mimeType });

      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid image file");
        return;
      }

      const base64Data = await fileToBase64(file);

      // For HEIC files, the processed file will be JPEG, so update the mime type
      const finalMimeType =
        fileName.toLowerCase().endsWith(".heic") || fileName.toLowerCase().endsWith(".heif") ? "image/jpeg" : mimeType;

      const newImage: ImageData = {
        data: base64Data,
        mimeType: finalMimeType,
        name: fileName,
      };

      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(newImage);
      toast.success(hadPreviousImage ? "Image replaced successfully" : "Image selected from search");
    } catch (error) {
      console.error("Error loading selected image:", error);
      toast.error("Failed to load selected image");
    } finally {
      setIsProcessingImage(false);
    }
  };

  useImperativeHandle(ref, () => ({
    addImage: (image: ImageData) => {
      const hadPreviousImage = selectedImage !== null;
      setSelectedImage(image);
      toast.success(hadPreviousImage ? "Image replaced successfully" : "Image added successfully");
    },
  }));
  const iconClass =
    "p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center justify-center border border-gray-200 cursor-pointer hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600 disabled:hover:bg-transparent disabled:hover:border-gray-200";

  // Remove dropdown logic
  return (
    <div className=" px-2 pt-2 chat-input rounded-b-3xl rounded-t-3xl min-w-3xl border-1 border-gray-300 shadow-lg">
      {/* Selected image preview above textarea */}
      {selectedImage && (
        <div className="w-full flex justify-start mb-2">
          <div className="flex items-center gap-2 bg-gray-50/80 rounded-lg p-2 border border-gray-200/60">
            <img
              src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
              alt={selectedImage.name || "Selected Image"}
              className="w-14 h-14 object-cover rounded-md border border-gray-200/60"
            />
            <button
              onClick={() => setSelectedImage(null)}
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
          disabled={status.isLoading || status.isStreaming}
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
              disabled={status.isLoading || isProcessingImage}
              className={iconClass + " shadow-sm bg-white border border-gray-200"}
              title={selectedImage ? "Replace Image" : "Upload Image"}
              type="button"
            >
              {isProcessingImage ? LoadingSVG : ImageSVG}
            </button>
            {onScreenshot && (
              <button
                onClick={onScreenshot}
                disabled={status.isLoading}
                className={iconClass + " shadow-sm bg-white border border-gray-200"}
                title="Take Screenshot"
                type="button"
              >
                {ScreenshotSVG}
              </button>
            )}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              disabled={status.isLoading}
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
              onClick={handleSend}
              disabled={(!content.trim() && !selectedImage) || status.isLoading || status.isStreaming}
              className={iconClass}
              type="button"
            >
              {status.isLoading ? LoadingSVG : status.isStreaming ? PauseSVG : SendSVG}
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
  );
}
const ChatInputWRef = forwardRef<ChatInputHandle, ChatInputProps>(ChatInput);
export default ChatInputWRef;
