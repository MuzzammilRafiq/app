function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="text-slate-600 text-sm mt-1">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function SettingRow({
  label,
  control,
}: {
  label: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {control}
    </div>
  );
}
export default function GeneralSettings() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="General Settings"
        description="General application settings and preferences."
      >
        <SettingRow label="Auto-save conversations" control={<Toggle />} />
        <SettingRow label="Show timestamps" control={<Toggle />} />
      </SectionCard>
    </div>
  );
}

function Toggle({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer select-none">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="sr-only peer"
      />
      <div className="w-10 h-6 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors duration-200 relative">
        <div className="absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4 shadow-sm" />
      </div>
    </label>
  );
}
