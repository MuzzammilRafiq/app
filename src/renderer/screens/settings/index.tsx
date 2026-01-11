import { useState } from "react";
import SettingsSidebar from "./_components/sidebar";
import Images from "./_components/image";
import Text from "./_components/text";
import GeneralSettings from "./_components/general";
import AdvancedSettings from "./_components/advanced";
export default function SettingsScreen() {
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
          <h1 className="text-2xl font-semibold text-text-main capitalize">
            {currentSection}
          </h1>
        </div>
        {renderSection()}
      </div>
    </div>
  );
}
