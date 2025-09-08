import { useEffect, useState } from "react";
import {
  getItem,
  setOrUpdateItem,
  type LastScanned,
} from "../../utils/localstore";
import { FileSVG, LoadingSVG, RescanSVG, TrashSVG } from "../icons";
import toast from "react-hot-toast";

export default function Images() {
  const [selectedFolders, setSelectedFolders] = useState<
    Map<string, LastScanned>
  >(new Map());
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const folders = getItem<Record<string, LastScanned>>("image-folders");
    if (folders) {
      const imageFoldersMap = new Map(Object.entries(folders));
      setSelectedFolders(imageFoldersMap);
    }
  }, []);

  const handleImageSelectFolder = async () => {
    try {
      const result = await window.electronAPI?.selectFolder();
      if (result) {
        if (selectedFolders.has(result)) return;
        handleImageScanFolder(result);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    } finally {
      setIsScanning(false);
    }
  };
  const handleImageScanFolder = async (folder: string) => {
    try {
      setIsScanning(true);
      console.log("scanning folder", folder);
      const result = await window.electronAPI?.scanFolder(folder);
      const newFolders = new Map(selectedFolders);
      let date = result ? new Date() : null;
      newFolders.set(folder, date);
      setSelectedFolders(newFolders);
      setOrUpdateItem("image-folders", Object.fromEntries(newFolders));
    } catch (error) {
      console.error("Error scanning folder:", error);
      toast.error("Failed to scan folder");
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageRemoveFolder = async (folder: string) => {
    try {
      setIsScanning(true)
      const folders = new Map(selectedFolders);
      folders.delete(folder);
      setSelectedFolders(folders);
      const foldersObject = Object.fromEntries(folders);
      setOrUpdateItem("image-folders", foldersObject);
      const response = await window.electronAPI.deleteFolder(folder);
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
        Index images
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
                      onClick={() => handleImageScanFolder(folder)}
                      className="text-blue-700 hover:text-blue-500 text-sm font-medium hover:bg-blue-100 p-1 rounded-md cursor-pointer"
                    >
                      {RescanSVG}
                    </button>
                    <button
                      disabled={isScanning}
                      onClick={() => handleImageRemoveFolder(folder)}
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

      {/* Add Folder Button */}
      <button
        disabled={isScanning}
        onClick={handleImageSelectFolder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
      >
        {FileSVG}
        Select Image Folder
      </button>
    </div>
  );
}
