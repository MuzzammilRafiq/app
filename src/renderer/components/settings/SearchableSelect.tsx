import { useState, useRef, useEffect } from "react";
import type { OpenRouterModel } from "../../../common/types";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: OpenRouterModel[];
  placeholder?: string;
  searchPlaceholder?: string;
  groups?: { label: string; filter: (model: OpenRouterModel) => boolean }[];
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  groups,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) ||
      opt.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-lg bg-white text-sm text-left text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border border-gray-300 transition-all duration-200 hover:border-gray-400 flex items-center justify-between"
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? "transform rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <polyline points="6 9 12 15 18 9" strokeWidth={2} />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No models found
              </div>
            ) : groups ? (
              groups.map((group) => {
                const groupOptions = filteredOptions.filter(group.filter);
                if (groupOptions.length === 0) return null;

                return (
                  <div key={group.label}>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                      {group.label}
                    </div>
                    {groupOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={`w-full px-4 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${
                          option.id === value
                            ? "bg-blue-100 text-blue-900 font-medium"
                            : "text-gray-900"
                        }`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                );
              })
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-4 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${
                    option.id === value
                      ? "bg-blue-100 text-blue-900 font-medium"
                      : "text-gray-900"
                  }`}
                >
                  {option.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
