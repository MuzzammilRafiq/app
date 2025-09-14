import { type ImageData } from "../../services/imageUtils";
import { iconClass, ImageSVG, LoadingSVG, PauseSVG, RAGSVG, RemoveSVG, SearchSVG, SendSVG } from "../icons";
import SearchModal from "../SearchModal";
import { handleImageUpload, handlePaste, handleImageSelect } from "../../services/chat-handlers";
import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  selectedImage: ImageData | null;
  setSelectedImage: React.Dispatch<React.SetStateAction<ImageData | null>>;
  imagePaths: string[] | null;
  setImagePaths: React.Dispatch<React.SetStateAction<string[] | null>>;
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  isStreaming: boolean;
  handleSendMessage: () => void;
  isRAGEnabled: boolean;
  setIsRAGEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ChatInput({
  selectedImage,
  setSelectedImage,
  imagePaths,
  setImagePaths,
  content,
  setContent,
  isLoading,
  isStreaming,
  handleSendMessage,
  isRAGEnabled,
  setIsRAGEnabled,
}: ChatInputProps) {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  console.log(isRAGEnabled);

  return (
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
            onPaste={(event) => handlePaste({ event, setIsProcessingImage, selectedImage, setSelectedImage })}
            placeholder="Ask or Act"
            disabled={isLoading || isStreaming}
            className="w-full px-4 py-3 resize-none max-h-32 min-h-[48px]"
            rows={1}
          />
        </div>
        {/* tools */}
        <div className="flex-1 relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) =>
              handleImageUpload({
                event,
                selectedImage,
                setSelectedImage,
                fileInputRef,
                setIsProcessingImage,
              })
            }
            className="hidden"
          />
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
              <button
                onClick={() => setIsRAGEnabled((isRAGEnabled) => !isRAGEnabled)}
                disabled={isLoading}
                className={
                  iconClass +
                  " shadow-sm bg-white border border-gray-200" +
                  (isRAGEnabled ? " text-blue-600 bg-blue-50 border-blue-200" : "")
                }
                title="Enable RAG"
                type="button"
              >
                {RAGSVG}
              </button>
            </div>
            {/* Right group: send button */}
            <div className="flex items-center ml-auto">
              <button
                onClick={handleSendMessage}
                disabled={
                  (!content.trim() && !selectedImage && !(imagePaths && imagePaths.length > 0)) ||
                  isLoading ||
                  isStreaming
                }
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
          onSelectImage={(imagePath: string) =>
            handleImageSelect({ imagePath, setIsProcessingImage, setImagePaths, setSelectedImage })
          }
        />
      </div>
    </div>
  );
}
