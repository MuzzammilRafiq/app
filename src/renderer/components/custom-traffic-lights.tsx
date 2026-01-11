
import { useEffect, useState } from "react";

export default function CustomTrafficLights() {
  const [hoveredButton, setHoveredButton] = useState<
    "close" | "minimize" | "maximize" | null
  >(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleClose = () => {
    window.electronAPI.windowClose();
  };

  const handleMinimize = () => {
    window.electronAPI.windowMinimize();
  };

  useEffect(() => {
    window.electronAPI.windowIsFullscreen?.().then((value) => {
      if (typeof value === "boolean") {
        setIsFullscreen(value);
      }
    });
  }, []);

  const handleMaximize = async () => {
    if (window.electronAPI.windowToggleFullscreen) {
      const fullscreen = await window.electronAPI.windowToggleFullscreen();
      setIsFullscreen(fullscreen ?? false);
    } else {
      await window.electronAPI.windowMaximize();
      const isMax = await window.electronAPI.windowIsMaximized();
      setIsFullscreen(isMax);
    }
  };

  // Customizable size - can be adjusted later
  const buttonSize = 16; // Default macOS traffic light size is ~12px, this is 1.33x bigger
  const spacing = 8;

  return (
    <div
      className="flex items-center gap-2"
      style={
        {
          WebkitAppRegion: "no-drag",
          gap: `${spacing}px`,
        } as React.CSSProperties
      }
    >
      {/* Close Button - Red */}
      <button
        onClick={handleClose}
        onMouseEnter={() => setHoveredButton("close")}
        onMouseLeave={() => setHoveredButton(null)}
        className="rounded-full transition-all duration-200 flex items-center justify-center relative group"
        style={{
          width: `${buttonSize}px`,
          height: `${buttonSize}px`,
          backgroundColor: hoveredButton === "close" ? "#ED6A5E" : "#FF5F56",
          border: "0.5px solid rgba(0, 0, 0, 0.1)",
        }}
        title="Close"
      >
        {hoveredButton === "close" && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1L7 7M7 1L1 7"
              stroke="#4A0000"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Minimize Button - Yellow */}
      <button
        onClick={handleMinimize}
        onMouseEnter={() => setHoveredButton("minimize")}
        onMouseLeave={() => setHoveredButton(null)}
        className="rounded-full transition-all duration-200 flex items-center justify-center relative group"
        style={{
          width: `${buttonSize}px`,
          height: `${buttonSize}px`,
          backgroundColor: hoveredButton === "minimize" ? "#E6C029" : "#FFBD2E",
          border: "0.5px solid rgba(0, 0, 0, 0.1)",
        }}
        title="Minimize"
      >
        {hoveredButton === "minimize" && (
          <svg
            width="8"
            height="2"
            viewBox="0 0 8 2"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1H7"
              stroke="#6B4A00"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Maximize Button - Green */}
      <button
        onClick={handleMaximize}
        onMouseEnter={() => setHoveredButton("maximize")}
        onMouseLeave={() => setHoveredButton(null)}
        className="rounded-full transition-all duration-200 flex items-center justify-center relative group"
        style={{
          width: `${buttonSize}px`,
          height: `${buttonSize}px`,
          backgroundColor:
            hoveredButton === "maximize"
              ? isFullscreen
                ? "#1F8E34"
                : "#52C038"
              : isFullscreen
                ? "#0FA533"
                : "#27C93F",
          border: "0.5px solid rgba(0, 0, 0, 0.1)",
        }}
        title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
      >
        {hoveredButton === "maximize" && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4L4 1L7 4M7 4L4 7L1 4"
              stroke="#005A00"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
