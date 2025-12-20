import toast from "react-hot-toast";
import { fileToBase64, validateImageFile, type ImageData } from "./imageUtils";

interface ImageUploadHandlerProps {
  event: React.ChangeEvent<HTMLInputElement>;
  selectedImage: ImageData | null;
  setSelectedImage: React.Dispatch<React.SetStateAction<ImageData | null>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setIsProcessingImage: React.Dispatch<React.SetStateAction<boolean>>;
}

export const handleImageUpload = async ({
  event,
  selectedImage,
  setSelectedImage,
  fileInputRef,
  setIsProcessingImage,
}: ImageUploadHandlerProps) => {
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

    toast.success(
      hadPreviousImage
        ? "Image replaced successfully"
        : "Image added successfully",
    );
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

interface PasteHandlerProps {
  event: React.ClipboardEvent;
  setIsProcessingImage: React.Dispatch<React.SetStateAction<boolean>>;
  selectedImage: ImageData | null;
  setSelectedImage: React.Dispatch<React.SetStateAction<ImageData | null>>;
}
export const handlePaste = async ({
  event,
  setIsProcessingImage,
  selectedImage,
  setSelectedImage,
}: PasteHandlerProps) => {
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

    toast.success(
      hadPreviousImage
        ? "Image replaced successfully"
        : "Image pasted successfully",
    );
  } catch (error) {
    console.error("Error processing pasted image:", error);
    toast.error("Failed to process pasted image");
  } finally {
    setIsProcessingImage(false);
  }
};

interface ImageSelectHandlerProps {
  imagePath: string;
  setIsProcessingImage: React.Dispatch<React.SetStateAction<boolean>>;
  setImagePaths: React.Dispatch<React.SetStateAction<string[] | null>>;
  setSelectedImage: React.Dispatch<React.SetStateAction<ImageData | null>>;
}
export const handleImageSelect = async ({
  imagePath,
  setIsProcessingImage,
  setImagePaths,
  setSelectedImage,
}: ImageSelectHandlerProps) => {
  setIsProcessingImage(true);
  try {
    // Save a thumbnail copy of the selected image into media and use that stored path
    const mediaPath =
      await window.electronAPI.saveImageFromPathToMedia(imagePath);
    setImagePaths([mediaPath]);
    setSelectedImage(null); // clear any base64 selected image to avoid duplicate save
    toast.success("Image selected from search");
  } catch (error) {
    console.error("Error loading selected image:", error);
    toast.error("Failed to load selected image");
  } finally {
    setIsProcessingImage(false);
  }
};
