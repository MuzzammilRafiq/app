import { useEffect, useState } from "react";
import { getItem, setOrUpdateItem, type LastScanned } from "../utils/localstore";
import { LoadingSVG, RescanSVG, TrashSVG } from "./icons";

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [selectedFolders, setSelectedFolders] = useState<Map<string, LastScanned>>(new Map());
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const folders = getItem<Record<string, LastScanned>>("folders");
    if (folders) {
      const foldersMap = new Map(Object.entries(folders));
      setSelectedFolders(foldersMap);
    }
  }, []);

  const handleSave = () => {
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.electronAPI?.selectFolder();
      if (result) {
        if (selectedFolders.has(result)) return;
        handleScanFolder(result);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    } finally {
      setIsScanning(false);
    }
  };
  const handleScanFolder = async (folder: string) => {
    setIsScanning(true);
    console.log("scanning folder", folder);
    const result = await window.electronAPI?.scanFolder(folder);
    const newFolders = new Map(selectedFolders);
    let date = result ? new Date() : null;
    newFolders.set(folder, date);
    setSelectedFolders(newFolders);
    setOrUpdateItem("folders", Object.fromEntries(newFolders));
  };

  const handleRemoveFolder = (folder: string) => {
    const folders = new Map(selectedFolders);
    folders.delete(folder);
    setSelectedFolders(folders);
    const foldersObject = Object.fromEntries(folders);
    setOrUpdateItem("folders", foldersObject);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors flex items-center"
          >
            <span className="mr-2">←</span>
            Back to Chat
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Index images </label>

            <div className="space-y-2 mb-3">
              {selectedFolders &&
                Array.from(selectedFolders.entries()).map(([folder, lastScanned]) => (
                  <div key={folder} className="bg-gray-50 px-3 py-2 rounded-md">
                    <div className="text-sm text-gray-700 mb-2">{folder}</div>
                    {isScanning ? (
                      LoadingSVG
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            disabled={isScanning}
                            onClick={() => handleScanFolder(folder)}
                            className="text-blue-700 hover:text-blue-500 text-sm font-medium hover:bg-blue-100 p-1 rounded-md cursor-pointer"
                          >
                            {RescanSVG}
                          </button>
                          <button
                            disabled={isScanning}
                            onClick={() => handleRemoveFolder(folder)}
                            className="text-red-700 hover:text-red-500 text-sm font-medium hover:bg-red-100 p-1 rounded-md cursor-pointer"
                          >
                            {TrashSVG}
                          </button>
                        </div>
                        {lastScanned && <span className="text-sm text-gray-700">{lastScanned.toLocaleString()}</span>}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Add Folder Button */}
            <button
              disabled={isScanning}
              onClick={handleSelectFolder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <span className="mr-2">📁</span>
              Select Folder
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-8 mt-8 border-t border-gray-200">
          <button
            onClick={() => {}}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-md"
          >
            Reset to Defaults
          </button>
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
