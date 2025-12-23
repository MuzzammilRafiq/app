import { useState } from "react";
import SettingsSidebar from "./sidebar";
import Images from "./image";
import Text from "./text";
import GeneralSettings from "./general";
import AdvancedSettings from "./advanced";
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
        return <AdvancedSettings />;
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
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6">
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
