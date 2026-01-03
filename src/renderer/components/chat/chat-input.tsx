import { type ImageData } from "../../services/imageUtils";
import {
  ImageSVG,
  LoadingSVG,
  PauseSVG,
  RAGSVG,
  SearchSVG,
  SendSVG,
  WebSearchSVG,
} from "../icons";
import SearchModal from "../SearchModal";
import {
  handleImageUpload,
  handlePaste,
  handleImageSelect,
} from "../../services/chat-handlers";
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
  handleStopGeneration: () => void;
  isRAGEnabled: boolean;
  setIsRAGEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isWebSearchEnabled: boolean;
  setIsWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
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
  handleStopGeneration,
  isRAGEnabled,
  setIsRAGEnabled,
  isWebSearchEnabled,
  setIsWebSearchEnabled,
}: ChatInputProps) {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200); // Max height limit
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Button styles
  const actionBtnBase =
    "p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const actionBtnGhost = `${actionBtnBase} text-slate-400 hover:text-primary hover:bg-primary-light/20`;
  const actionBtnActive = `${actionBtnBase} text-primary bg-primary-light/30`;
  const sendBtnClass = `ml-2 p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center shadow-md ${
    content.trim() ||
    selectedImage ||
    (imagePaths && imagePaths.length > 0) ||
    isStreaming
      ? "bg-primary text-white hover:bg-primary-hover hover:scale-105"
      : "bg-slate-200 text-slate-400 cursor-not-allowed"
  }`;

  return (
    <div className="shrink-0 px-6 pb-6 pt-2">
      <div className="mx-auto max-w-3xl transition-all duration-300 relative bg-white rounded-3xl shadow-float border border-transparent">
        {/* Selected image preview inside the bubble */}
        {(selectedImage || (imagePaths && imagePaths.length > 0)) && (
          <div className="px-4 pt-4 pb-0">
            <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-100 rounded-xl w-fit animate-fade-in">
              {selectedImage ? (
                <img
                  src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
                  alt={selectedImage.name || "Selected Image"}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm"
                />
              ) : (
                <img
                  src={`file://${imagePaths![0]}`}
                  alt={"Selected Image"}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm"
                />
              )}
              <div className="flex flex-col gap-1 pr-2">
                <span className="text-xs font-medium text-slate-500">
                  Image attached
                </span>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePaths(null);
                  }}
                  className="text-xs text-red-500 hover:text-red-600 hover:underline font-medium text-left"
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(event) =>
              handlePaste({
                event,
                setIsProcessingImage,
                selectedImage,
                setSelectedImage,
              })
            }
            placeholder="Ask anything..."
            disabled={isLoading || isStreaming}
            className="w-full px-5 py-4 bg-transparent border-none text-slate-700 placeholder-slate-400 text-[15px] resize-none focus:ring-0 focus:outline-none max-h-64 min-h-14 leading-relaxed"
            rows={1}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
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

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isProcessingImage}
              className={actionBtnGhost}
              title={selectedImage ? "Replace Image" : "Upload Image"}
              type="button"
            >
              {isProcessingImage ? (
                <span className="animate-spin">{LoadingSVG}</span>
              ) : (
                ImageSVG
              )}
            </button>

            <button
              onClick={() => setIsSearchModalOpen(true)}
              disabled={isLoading}
              className={actionBtnGhost}
              title="Search Images"
              type="button"
            >
              {SearchSVG}
            </button>

            <div className="w-px h-4 bg-slate-200 mx-1"></div>

            <button
              onClick={() => setIsRAGEnabled((prev) => !prev)}
              disabled={isLoading}
              className={isRAGEnabled ? actionBtnActive : actionBtnGhost}
              title={isRAGEnabled ? "Disable RAG" : "Enable RAG"}
              type="button"
            >
              <div className="flex items-center gap-1.5">
                {RAGSVG}
                <span
                  className={`text-xs font-medium ${isRAGEnabled ? "text-primary" : "hidden"}`}
                >
                  RAG
                </span>
              </div>
            </button>

            <button
              onClick={() => setIsWebSearchEnabled((prev) => !prev)}
              disabled={isLoading}
              className={isWebSearchEnabled ? actionBtnActive : actionBtnGhost}
              title={
                isWebSearchEnabled ? "Disable Web Search" : "Enable Web Search"
              }
              type="button"
            >
              <div className="flex items-center gap-1.5">
                {WebSearchSVG}
                <span
                  className={`text-xs font-medium ${isWebSearchEnabled ? "text-primary" : "hidden"}`}
                >
                  Web
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center">
            <button
              onClick={isStreaming ? handleStopGeneration : handleSendMessage}
              disabled={
                !isStreaming &&
                ((!content.trim() &&
                  !selectedImage &&
                  !(imagePaths && imagePaths.length > 0)) ||
                  isLoading)
              }
              className={sendBtnClass}
              type="button"
            >
              {isStreaming ? (
                PauseSVG
              ) : isLoading ? (
                <span className="animate-spin">{LoadingSVG}</span>
              ) : (
                SendSVG
              )}
            </button>
          </div>
        </div>

        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectImage={(imagePath: string) =>
            handleImageSelect({
              imagePath,
              setIsProcessingImage,
              setImagePaths,
              setSelectedImage,
            })
          }
        />
      </div>
      <div className="text-center mt-3">
        <p className="text-[10px] text-slate-400 font-medium">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
