import { useEffect, useState } from "react";
import {
  getItem,
  setOrUpdateItem,
  type LastScanned,
} from "../../utils/localstore";
import { FileSVG, LoadingSVG, RescanSVG, TrashSVG } from "../icons";
import toast from "react-hot-toast";

export default function Text() {
  const [selectedFolders, setSelectedFolders] = useState<
    Map<string, LastScanned>
  >(new Map());
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const folders = getItem<Record<string, LastScanned>>("text-folders");
    if (folders) {
      const textFoldersMap = new Map(Object.entries(folders));
      setSelectedFolders(textFoldersMap);
    }
  }, []);

  const handleTextSelectFolder = async () => {
    try {
      const result = await window.electronAPI?.selectTextFolder();
      if (result) {
        if (selectedFolders.has(result)) return;
        handleTextScanFolder(result);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTextScanFolder = async (folder: string) => {
    try {
      setIsScanning(true);
      console.log("scanning folder", folder);
      const result = await window.electronAPI?.scanTextFolder(folder);
      const newFolders = new Map(selectedFolders);
      let date = result ? new Date() : null;
      newFolders.set(folder, date);
      setSelectedFolders(newFolders);
      setOrUpdateItem("text-folders", Object.fromEntries(newFolders));
    } catch (error) {
      console.error("Error scanning folder:", error);
      toast.error("Failed to scan folder");
    } finally {
      setIsScanning(false);
    }
  };

  const handleTextRemoveFolder = async (folder: string) => {
    try {
      setIsScanning(true);
      const folders = new Map(selectedFolders);
      folders.delete(folder);
      setSelectedFolders(folders);
      const foldersObject = Object.fromEntries(folders);
      setOrUpdateItem("text-folders", foldersObject);
      const response = await window.electronAPI.deleteTextFolder(folder);
      if (response.success) {
        console.log("Folder deleted successfully", response);
      } else {
        throw new Error(response.error || "Unknown error");
      }
    } catch (error: any) {
      toast.error("Error removing folder: " + error.message);
      console.error("Error removing folder:", error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-gray-100 px-3 py-6 rounded-xl">
      <h2>
        Index text files
      </h2>

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
                      onClick={() => handleTextScanFolder(folder)}
                      className="text-blue-700 hover:text-blue-500 text-sm font-medium hover:bg-blue-100 p-1 rounded-md cursor-pointer"
                    >
                      {RescanSVG}
                    </button>
                    <button
                      disabled={isScanning}
                      onClick={() => handleTextRemoveFolder(folder)}
                      className="text-red-700 hover:text-red-500 text-sm font-medium hover:bg-red-100 p-1 rounded-md cursor-pointer"
                    >
                      {TrashSVG}
                    </button>
                  </div>
                  {lastScanned && (
                    <span className="text-sm text-gray-700">
                      {lastScanned.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>

      <button
        disabled={isScanning}
        onClick={handleTextSelectFolder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
      >
        {FileSVG}
        Select Text Folder
      </button>
    </div>
  );
}