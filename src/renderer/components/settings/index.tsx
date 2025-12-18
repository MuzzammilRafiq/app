import { useCurrentViewStore } from "../../utils/store";
import { useState } from "react";
import SettingsSidebar from "./sidebar";
import Images from "./image";
import Text from "./text";
import GeneralSettings from "./general";

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

function SelectInput({
  options,
  defaultValue,
}: {
  options: string[];
  defaultValue?: string;
}) {
  return (
    <select
      defaultValue={defaultValue}
      className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-slate-700 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
export default function Settings() {
  const [currentSection, setCurrentSection] = useState("general");

  const renderSection = () => {
    switch (currentSection) {
      case "images":
        return <Images />;
      case "text":
        return <Text />;
      case "general":
        return <GeneralSettings />;
      case "advanced":
        return <div className="space-y-6">boobs</div>;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="h-full flex">
      <SettingsSidebar
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
      />
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-slate-800 capitalize">
            {currentSection}
          </h1>
        </div>
        {renderSection()}
      </div>
    </div>
  );
}
