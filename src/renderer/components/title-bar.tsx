export default function TitleBar() {
  return (
    <div
      className="h-12 flex items-center justify-between shrink-0 select-none border-b border-slate-200"
      style={
        {
          backgroundColor: "var(--bg-app)",
          WebkitAppRegion: "drag",
        } as React.CSSProperties
      }
    >
      {/* Left side - Space for macOS traffic lights */}
      <div className="w-20 h-full" />

      {/* Center - App title */}
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-sm font-semibold text-slate-600">Open Desktop</h1>
      </div>

      {/* Right side - Spacing for symmetry */}
      <div className="w-4" />
    </div>
  );
}
