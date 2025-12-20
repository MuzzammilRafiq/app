import { ToggleRow } from "./ToggleRow";
import type { AppSettings } from "../../services/settingsStorage";

interface SystemBehaviorSectionProps {
  settings: AppSettings;
  onToggle: (key: keyof AppSettings) => void;
}

export function SystemBehaviorSection({
  settings,
  onToggle,
}: SystemBehaviorSectionProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-slate-800">System Behavior</div>
      <div className="space-y-2">
        <ToggleRow
          title="Auto launch"
          description="Start app on system login"
          enabled={settings.autoLaunch}
          onClick={() => onToggle("autoLaunch")}
        />
        <ToggleRow
          title="Compact mode"
          description="Condense spacing in chat"
          enabled={settings.compactMode}
          onClick={() => onToggle("compactMode")}
        />
        <ToggleRow
          title="Confirm clear chat"
          description="Ask before clearing conversations"
          enabled={settings.confirmClearChat}
          onClick={() => onToggle("confirmClearChat")}
        />
      </div>
    </div>
  );
}
