import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  fileToBase64,
  validateImageFile,
  type ImageData,
} from '../services/geminiService';
import toast from 'react-hot-toast';

interface ChatInputProps {
  onSendMessage: (message: string, images?: ImageData[]) => void;
  isLoading: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onScreenshot?: () => void;
  onStopResponse?: () => void;
}

export interface ChatInputHandle {
  addImage: (image: ImageData) => void;
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      onSendMessage,
      isLoading,
      isStreaming = false,
      disabled = false,
      onScreenshot,
      onStopResponse,
    },
    ref
  ) {
    const [message, setMessage] = useState('');
    const [selectedImages, setSelectedImages] = useState<ImageData[]>([]);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [showTools, setShowTools] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
      const trimmedMessage = message.trim();
      if (
        (trimmedMessage || selectedImages.length > 0) &&
        !isLoading &&
        !isStreaming &&
        !disabled
      ) {
        onSendMessage(
          trimmedMessage,
          selectedImages.length > 0 ? selectedImages : undefined
        );
        setMessage('');
        setSelectedImages([]);
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleImageUpload = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
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
            toast.error(validation.error || 'Invalid image file');
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
          setSelectedImages(prev => [...prev, ...newImages]);
          toast.success(
            `Added ${newImages.length} image${newImages.length > 1 ? 's' : ''}`
          );
        }
      } catch (error) {
        console.error('Error processing images:', error);
        toast.error('Failed to process image(s)');
      } finally {
        setIsProcessingImage(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    const removeImage = (index: number) => {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
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
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} is not an image file`);
            continue;
          }

          // Validate the file
          const validation = validateImageFile(file);
          if (!validation.isValid) {
            toast.error(validation.error || 'Invalid image file');
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
          setSelectedImages(prev => [...prev, ...newImages]);
          toast.success(
            `Added ${newImages.length} image${newImages.length > 1 ? 's' : ''}`
          );
        }
      } catch (error) {
        console.error('Error processing dropped images:', error);
        toast.error('Failed to process dropped image(s)');
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

        if (item.type.startsWith('image/')) {
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

          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;

            // Validate the file
            const validation = validateImageFile(file);
            if (!validation.isValid) {
              toast.error(validation.error || 'Invalid image file');
              continue;
            }

            // Convert to base64
            const base64Data = await fileToBase64(file);

            const newImage: ImageData = {
              data: base64Data,
              mimeType: file.type,
              name: 'Pasted Image',
            };

            setSelectedImages(prev => [...prev, newImage]);
            toast.success('Image pasted successfully');
          }
        }
      } catch (error) {
        console.error('Error processing pasted image:', error);
        toast.error('Failed to process pasted image');
      } finally {
        setIsProcessingImage(false);
      }
    };

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [message]);

    useImperativeHandle(ref, () => ({
      addImage: (image: ImageData) => {
        setSelectedImages(prev => [...prev, image]);
      },
    }));

    return (
      <div
        className='bg-white p-4'
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Image preview section */}
        {selectedImages.length > 0 && (
          <div className='mb-4 flex flex-wrap gap-3'>
            {selectedImages.map((image, index) => (
              <div key={index} className='relative group'>
                <img
                  src={`data:${image.mimeType};base64,${image.data}`}
                  alt={image.name || `Image ${index + 1}`}
                  className='w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors duration-200'
                />
                <button
                  onClick={() => removeImage(index)}
                  className='absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 shadow-md'
                  title='Remove image'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className='flex items-end gap-3 bg-gray-100 rounded-full px-4 py-3 relative'>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            multiple
            onChange={handleImageUpload}
            className='hidden'
          />

          {/* Plus button for images */}
          <button
            onClick={triggerImageUpload}
            disabled={isLoading || disabled || isProcessingImage}
            className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-all duration-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed'
            title='Add attachment'
          >
            {isProcessingImage ? (
              <div className='w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin'></div>
            ) : (
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
            )}
          </button>

          {/* Tools button */}
          <div className='relative'>
            <button
              onClick={() => setShowTools(!showTools)}
              className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-all duration-200 flex items-center justify-center'
              title='Tools'
            >
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
                />
              </svg>
            </button>

            {/* Tools dropdown */}
            {showTools && (
              <div className='absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[150px] z-10'>
                {onScreenshot && (
                  <button
                    onClick={() => {
                      onScreenshot();
                      setShowTools(false);
                    }}
                    className='w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2'
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 13a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                    </svg>
                    Screenshot
                  </button>
                )}
              </div>
            )}
          </div>

          <div className='flex-1 relative'>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyUp={handleKeyPress}
              onPaste={handlePaste}
              placeholder='Ask anything'
              disabled={isLoading || disabled}
              className='w-full bg-transparent px-0 py-0 border-none outline-none resize-none max-h-32 min-h-[24px] disabled:cursor-not-allowed text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:shadow-none focus:border-none'
              rows={1}
            />
          </div>

          {/* Send/Stop button */}
          <button
            onClick={isStreaming ? onStopResponse : handleSend}
            disabled={
              ((!message.trim() && selectedImages.length === 0) ||
                isLoading ||
                disabled) &&
              !isStreaming
            }
            className={`p-2 rounded-full focus:outline-none flex items-center justify-center transition-all duration-200 ${
              isStreaming
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-800 text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500'
            }`}
            title={isStreaming ? 'Stop response' : 'Send message'}
          >
            {isLoading ? (
              <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            ) : isStreaming ? (
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 6h12v12H6z'
                />
              </svg>
            ) : (
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
                />
              </svg>
            )}
          </button>
        </div>

        {/* Click outside to close tools */}
        {showTools && (
          <div
            className='fixed inset-0 z-0'
            onClick={() => setShowTools(false)}
          />
        )}
      </div>
    );
  }
);

export default ChatInput;
