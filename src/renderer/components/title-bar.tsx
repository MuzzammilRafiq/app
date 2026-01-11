import { SmartDesktopIcon } from "./icons";
import CustomTrafficLights from "./custom-traffic-lights";

export default function TitleBar() {
  return (
    <div
      className="h-12 flex items-center justify-between shrink-0 select-none border-b border-border"
      style={
        {
          backgroundColor: "var(--bg-app)",
          WebkitAppRegion: "drag",
        } as React.CSSProperties
      }
    >
      {/* Left side - Custom macOS traffic lights */}
      <div className="flex items-center h-full pl-4">
        <CustomTrafficLights />
      </div>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right side - App title */}
      <div className="flex items-center justify-end pr-4 ">
        <SmartDesktopIcon />
      </div>
    </div>
  );
}
