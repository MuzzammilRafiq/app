import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, isLoading, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isLoading && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyUp={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading || disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 min-h-[40px] disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={1}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!message.trim() || isLoading || disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isLoading ? (
            // Loading state with spinner animation
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>...</span>
            </>
          ) : (
            // Normal send button state
            <span>Send</span>
          )}
        </button>
      </div>
    </div>
  );
}
