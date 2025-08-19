import { useEffect, type RefObject } from "react";
import toast from "react-hot-toast";
import type { ChatInputHandle } from "../components/ChatInput";

export function useScreenshot(chatInputRef: RefObject<ChatInputHandle | null>) {
  // Listen for global screenshot trigger
  useEffect(() => {
    const handleGlobalScreenshot = async () => {
      try {
        const result = await window.electronAPI.captureScreenshot();

        if (result.success && result.hasImage && result.imageData) {
          // Add screenshot to chat input instead of chat
          chatInputRef.current?.addImage(result.imageData);
          toast.success("Screenshot added to input");
        } else if (result.success) {
          toast.success(result.message || "Screenshot completed");
        } else {
          // Only show error toast if it's not a cancellation
          if (result.error !== "Screenshot was cancelled") {
            toast.error(`Screenshot failed: ${result.error}`);
          }
        }
      } catch (error) {
        console.log(error);
        toast.error("Failed to take screenshot");
      }
    };

    // Set up the listener
    window.electronAPI.onGlobalScreenshotTrigger(handleGlobalScreenshot);

    // Cleanup function
    return () => {
      window.electronAPI.removeGlobalScreenshotListener();
    };
  }, [chatInputRef]);

  const handleScreenshot = async () => {
    try {
      const result = await window.electronAPI.captureScreenshot();

      if (result.success && result.hasImage && result.imageData) {
        // Add screenshot to chat input instead of chat
        chatInputRef.current?.addImage(result.imageData);
        toast.success("Screenshot added to input");
      } else if (result.success) {
        toast.success(result.message || "Screenshot completed");
      } else {
        // Only show error toast if it's not a cancellation
        if (result.error !== "Screenshot was cancelled") {
          toast.error(`Screenshot failed: ${result.error}`);
        }
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to take screenshot");
    }
  };

  return { handleScreenshot };
}
