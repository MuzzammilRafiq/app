import { useState, useEffect, useRef } from "react";
import { LoadingSVG, SearchSVG } from "../../../components/icons";

type SearchResult = string;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage?: (imagePath: string) => void;
}

export default function SearchModal({
  isOpen,
  onClose,
  onSelectImage,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [convertedImages, setConvertedImages] = useState<Map<string, string>>(
    new Map()
  );
  const [convertingHeic, setConvertingHeic] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        isOpen
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
      // Clear any pending search timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  // Helper function to check if a file is HEIC
  const isHeicFile = (filePath: string): boolean => {
    return (
      filePath.toLowerCase().endsWith(".heic") ||
      filePath.toLowerCase().endsWith(".heif")
    );
  };

  // Get converted HEIC path using fast native conversion
  const getConvertedHeicPath = async (
    filePath: string
  ): Promise<string | null> => {
    try {
      if (!window.electronAPI?.getConvertedHeicPath) {
        console.error("electronAPI.getConvertedHeicPath not available");
        return null;
      }

      return await window.electronAPI.getConvertedHeicPath(filePath);
    } catch (error) {
      console.error("Error getting converted HEIC path:", error);
      return null;
    }
  };

  // Convert HEIC images when results change using fast native conversion
  useEffect(() => {
    const convertHeicImages = async () => {
      // Clear previous converted images
      setConvertedImages(new Map());
      setConvertingHeic(new Set());

      const newConvertedImages = new Map<string, string>();
      const currentlyConverting = new Set<string>();

      for (const result of results) {
        if (isHeicFile(result)) {
          currentlyConverting.add(result);
          setConvertingHeic((prev) => new Set([...prev, result]));

          const convertedPath = await getConvertedHeicPath(result);
          if (convertedPath) {
            newConvertedImages.set(result, convertedPath);
          }

          currentlyConverting.delete(result);
          setConvertingHeic((prev) => {
            const newSet = new Set(prev);
            newSet.delete(result);
            return newSet;
          });
        }
      }

      setConvertedImages(newConvertedImages);
    };

    if (results.length > 0) {
      convertHeicImages();
    } else {
      // Clear converted images when no results
      setConvertedImages(new Map());
      setConvertingHeic(new Set());
    }
  }, [results]);

  // No cleanup needed since we're using file paths instead of blob URLs

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      setServiceUnavailable(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setServiceUnavailable(false);

    try {
      const response = await window.electronAPI?.searchImagesByText(
        searchQuery.trim(),
        10
      );

      if (response?.success && response.results) {
        const searchResults: SearchResult[] = response.results.filter(
          (path: string) => path && path.trim()
        );
        setResults(searchResults);
      } else {
        setResults([]);
        if (response?.error) {
          console.error("Search failed:", response.error);
          // Check if it's a connection error (service not running)
          if (
            response.error.includes("fetch") ||
            response.error.includes("ECONNREFUSED") ||
            response.error.includes("Service not available")
          ) {
            setServiceUnavailable(true);
            console.warn("Embedding service appears to be offline");
          }
        }
      }
    } catch (error) {
      console.error("Error searching images:", error);
      setResults([]);
      setServiceUnavailable(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce search
    timeoutRef.current = setTimeout(() => {
      performSearch(newQuery);
    }, 300);
  };

  const handleResultClick = (imagePath: string) => {
    if (onSelectImage && imagePath) {
      onSelectImage(imagePath);
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl mx-4 max-h-[70vh] flex flex-col"
      >
        {/* Search Input */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-gray-100">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <div className="text-gray-400">{LoadingSVG}</div>
              ) : (
                <div className="text-gray-400">{SearchSVG}</div>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Search images by description..."
              className="block w-full pl-10 pr-3 py-3 rounded-lg bg-white focus:bg-slate-50 text-slate-900 placeholder-slate-400 transition-all duration-200 text-base"
              style={{ border: "none", outline: "none", boxShadow: "none" }}
            />
          </div>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!hasSearched && !query.trim() && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <div className="mb-2 text-gray-300">{SearchSVG}</div>
                <p className="text-sm">Start typing to search your images</p>
              </div>
            </div>
          )}

          {hasSearched && results.length === 0 && !isSearching && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                {serviceUnavailable ? (
                  <>
                    <p className="text-sm text-red-600">
                      ⚠️ Search service unavailable
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Please start the embedding service and try again
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Run:{" "}
                      <code className="bg-gray-100 px-1 rounded">
                        python src/python/main.py
                      </code>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No images found for "{query}"</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Try different keywords or check if you have indexed images
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleResultClick(result)}
                    className="flex flex-col p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-150 border border-transparent hover:border-gray-200"
                  >
                    <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                      {isHeicFile(result) ? (
                        convertingHeic.has(result) ? (
                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <div className="text-center">
                              <div className="text-gray-400 mb-1">
                                {LoadingSVG}
                              </div>
                              <div className="text-xs text-gray-500">
                                Converting...
                              </div>
                            </div>
                          </div>
                        ) : convertedImages.has(result) ? (
                          <img
                            src={`file://${convertedImages.get(result)}`}
                            alt="Search result"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTI4IDI4TDQ0IDQ0IiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0yOCAzNkwyOCAzNiIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <div className="text-center">
                              <div className="text-gray-400 mb-1">⚠️</div>
                              <div className="text-xs text-gray-500">
                                Failed to convert
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <img
                          src={`file://${result}`}
                          alt="Search result"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTI4IDI4TDQ0IDQ0IiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0yOCAzNkwyOCAzNiIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Rtd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K";
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result?.split("/").pop() || "Unknown file"}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {result || "No path"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Press ESC to close</span>
            <span>Click on an image to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
