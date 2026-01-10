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
import { useEffect, useRef, useState, memo } from "react";

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

function ChatInput({
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
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [content]);

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachMenu]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const hasContent = content.trim() || selectedImage || (imagePaths && imagePaths.length > 0);
  const hasImage = selectedImage || (imagePaths && imagePaths.length > 0);

  // Chip toggle styles
  const chipBase = "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer";
  const chipActive = `${chipBase} text-primary bg-primary-light/30`;

  return (
    <div className="shrink-0 px-6 pb-6 pt-2">
      {/* Feature toggles - shown above input when active */}
      {(isRAGEnabled || isWebSearchEnabled) && (
        <div className="mx-auto max-w-3xl mb-2 flex items-center gap-2 animate-fade-in">
          {isRAGEnabled && (
            <button
              onClick={() => setIsRAGEnabled(false)}
              className={chipActive}
              type="button"
            >
              {RAGSVG}
              <span>RAG</span>
              <span className="text-primary/60 hover:text-primary ml-0.5">×</span>
            </button>
          )}
          {isWebSearchEnabled && (
            <button
              onClick={() => setIsWebSearchEnabled(false)}
              className={chipActive}
              type="button"
            >
              {WebSearchSVG}
              <span>Web</span>
              <span className="text-primary/60 hover:text-primary ml-0.5">×</span>
            </button>
          )}
        </div>
      )}

      <div className="mx-auto max-w-3xl transition-all duration-300 relative bg-white rounded-2xl shadow-float border border-slate-200/60">
        {/* Compact image preview */}
        {hasImage && (
          <div className="px-4 pt-3 pb-0">
            <div className="relative inline-block animate-fade-in">
              {selectedImage ? (
                <img
                  src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
                  alt={selectedImage.name || "Selected"}
                  className="h-14 w-14 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <img
                  src={`file://${imagePaths![0]}`}
                  alt="Selected"
                  className="h-14 w-14 object-cover rounded-lg border border-slate-200"
                />
              )}
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePaths(null);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-600 hover:bg-slate-700 text-white rounded-full flex items-center justify-center text-xs shadow-sm transition-colors"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Textarea with inline send */}
        <div className="flex items-end gap-2 p-3">
          {/* Attach button with dropdown */}
          <div className="relative" ref={attachMenuRef}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                handleImageUpload({
                  event,
                  selectedImage,
                  setSelectedImage,
                  fileInputRef,
                  setIsProcessingImage,
                });
                setShowAttachMenu(false);
              }}
              className="hidden"
            />
            <button
              onClick={() => setShowAttachMenu((prev) => !prev)}
              disabled={isLoading || isProcessingImage}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
              title="Attach"
              type="button"
            >
              {isProcessingImage ? (
                <span className="animate-spin">{LoadingSVG}</span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </button>

            {/* Dropdown menu */}
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-40 animate-fade-in z-10">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  type="button"
                >
                  {ImageSVG}
                  Upload image
                </button>
                <button
                  onClick={() => {
                    setIsSearchModalOpen(true);
                    setShowAttachMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  type="button"
                >
                  {SearchSVG}
                  Search images
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    setIsRAGEnabled((prev) => !prev);
                    setShowAttachMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors ${isRAGEnabled ? 'text-primary bg-primary-light/20' : 'text-slate-600 hover:bg-slate-50'}`}
                  type="button"
                >
                  {RAGSVG}
                  {isRAGEnabled ? 'Disable RAG' : 'Enable RAG'}
                </button>
                <button
                  onClick={() => {
                    setIsWebSearchEnabled((prev) => !prev);
                    setShowAttachMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors ${isWebSearchEnabled ? 'text-primary bg-primary-light/20' : 'text-slate-600 hover:bg-slate-50'}`}
                  type="button"
                >
                  {WebSearchSVG}
                  {isWebSearchEnabled ? 'Disable Web' : 'Enable Web'}
                </button>
              </div>
            )}
          </div>

          {/* Textarea */}
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
            className="flex-1 bg-transparent border-none text-slate-700 placeholder-slate-400 text-[15px] resize-none focus:ring-0 focus:outline-none max-h-48 min-h-6 leading-relaxed py-2"
            rows={1}
          />

          {/* Send button */}
          <button
            onClick={isStreaming ? handleStopGeneration : handleSendMessage}
            disabled={!isStreaming && (!hasContent || isLoading)}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
              hasContent || isStreaming
                ? "bg-primary text-white hover:bg-primary-hover"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
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
        <p className="text-[10px] text-slate-400">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}

export default memo(ChatInput);
