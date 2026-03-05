interface AudioLevelMeterProps {
  level: number;
  isActive: boolean;
  bars?: number;
  className?: string;
}

export default function AudioLevelMeter({
  level,
  isActive,
  bars = 18,
  className = "",
}: AudioLevelMeterProps) {
  const safeLevel = Math.max(0, Math.min(1, level));

  return (
    <div
      className={`flex items-end gap-1 rounded-xl border border-border/70 bg-white/60 px-3 py-3 shadow-[0_16px_40px_-24px_rgba(62,39,35,0.45)] backdrop-blur-sm dark:bg-black/10 ${className}`}
    >
      {Array.from({ length: bars }, (_, index) => {
        const normalizedIndex = bars === 1 ? 0 : index / (bars - 1);
        const centerDistance = Math.abs(normalizedIndex - 0.5) * 2;
        const archWeight = 1 - centerDistance * 0.45;
        const ripple = 0.88 + Math.sin(index * 0.9 + safeLevel * 9) * 0.12;
        const liveBaseline = isActive ? 0.14 : 0.07;
        const heightRatio = Math.max(
          liveBaseline,
          Math.min(1, liveBaseline + safeLevel * archWeight * ripple),
        );
        const opacity = isActive ? 0.52 + heightRatio * 0.48 : 0.26;

        return (
          <span
            key={index}
            className="w-1.5 origin-bottom rounded-sm transition-all duration-100 ease-out"
            style={{
              height: `${16 + heightRatio * 72}px`,
              opacity,
              background:
                "linear-gradient(180deg, rgba(62,39,35,0.95) 0%, rgba(93,64,55,0.72) 55%, rgba(215,204,200,0.58) 100%)",
              boxShadow: isActive
                ? "0 0 18px rgba(93,64,55,0.12)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}
