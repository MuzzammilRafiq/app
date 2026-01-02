import { useEffect, useState } from "react";
import { FileSVG, RescanSVG, TrashSVG } from "../icons";
import toast from "react-hot-toast";

interface FolderInfo {
  folderPath: string;
  lastScannedAt: number | null;
}

type ScanningState = {
  folder: string;
  action: "scanning" | "deleting" | "adding";
} | null;

export default function Text() {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [scanningState, setScanningState] = useState<ScanningState>(null);

  // Load folders from database on mount
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const dbFolders = await window.electronAPI.dbGetRagFolders("text");
        setFolders(dbFolders);
      } catch (error) {
        console.error("Failed to load text folders:", error);
        toast.error("Failed to load text folders");
      }
    };
    loadFolders();
  }, []);

  const handleTextSelectFolder = async () => {
    try {
      const result = await window.electronAPI?.selectTextFolder();
      if (result) {
        // Check if folder already exists
        if (folders.some((f) => f.folderPath === result)) {
          toast.error("Folder already added");
          return;
        }
        await handleTextScanFolder(result, true);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      toast.error("Failed to select folder");
    }
  };

  const handleTextScanFolder = async (folder: string, isNewFolder = false) => {
    try {
      setScanningState({ folder, action: isNewFolder ? "adding" : "scanning" });
      console.log("scanning folder", folder);

      // Python-first: scan folder first
      const result = await window.electronAPI?.scanTextFolder(folder);

      if (!result?.success) {
        throw new Error(result?.error || "Failed to scan folder");
      }

      // If Python succeeded, update database
      const now = Date.now();
      if (isNewFolder) {
        await window.electronAPI.dbAddRagFolder(folder, "text", now);
      } else {
        await window.electronAPI.dbUpdateRagFolderScanTime(folder, now);
      }

      // Update local state
      if (isNewFolder) {
        setFolders((prev) => [
          { folderPath: folder, lastScannedAt: now },
          ...prev,
        ]);
      } else {
        setFolders((prev) =>
          prev.map((f) =>
            f.folderPath === folder ? { ...f, lastScannedAt: now } : f
          )
        );
      }

      toast.success(isNewFolder ? "Folder added and indexed" : "Folder rescanned");
    } catch (error: any) {
      console.error("Error scanning folder:", error);
      toast.error(error.message || "Failed to scan folder");
    } finally {
      setScanningState(null);
    }
  };

  const handleTextRemoveFolder = async (folder: string) => {
    try {
      setScanningState({ folder, action: "deleting" });

      // Python-first: delete from ChromaDB first
      const response = await window.electronAPI.deleteTextFolder(folder);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete folder embeddings");
      }

      // If Python succeeded, delete from database
      await window.electronAPI.dbDeleteRagFolder(folder);

      // Update local state
      setFolders((prev) => prev.filter((f) => f.folderPath !== folder));

      toast.success("Folder removed successfully");
    } catch (error: any) {
      toast.error("Error removing folder: " + error.message);
      console.error("Error removing folder:", error);
    } finally {
      setScanningState(null);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const isProcessing = scanningState !== null;
  const isAddingNew = scanningState?.action === "adding";

  return (
    <div className="bg-bg-app px-3 py-6 rounded-xl">
      <h2>Index text files</h2>

      <div className="space-y-2 mb-3">
        {/* Adding new folder animation */}
        {isAddingNew && (
          <div 
            className="bg-surface px-3 py-2 rounded-md animate-pulse"
            style={{ 
              boxShadow: "0 0 0 2px var(--color-primary-light)",
            }}
          >
            <div className="text-sm text-gray-700 mb-2 truncate" title={scanningState.folder}>
              {scanningState.folder}
            </div>
            <div className="flex items-center gap-2 py-1">
              <div className="relative">
                <div 
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
                />
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                Adding folder and indexing files...
              </span>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden ml-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    animation: "progress 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {folders.map((folder) => {
          const isFolderProcessing = scanningState?.folder === folder.folderPath;
          const isScanning = isFolderProcessing && scanningState?.action === "scanning";
          const isDeleting = isFolderProcessing && scanningState?.action === "deleting";

          return (
            <div
              key={folder.folderPath}
              className="bg-surface px-3 py-2 rounded-md transition-all duration-200"
              style={{
                boxShadow: isFolderProcessing ? "0 0 0 2px var(--color-primary-light)" : undefined,
              }}
            >
              <div className="text-sm text-gray-700 mb-2 truncate" title={folder.folderPath}>
                {folder.folderPath}
              </div>

              {isFolderProcessing ? (
                <div className="flex items-center gap-2 py-1">
                  <div className="relative">
                    <div 
                      className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
                    />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                    {isScanning && "Rescanning folder..."}
                    {isDeleting && "Removing folder..."}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden ml-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: "var(--color-primary)",
                        animation: "progress 1.5s ease-in-out infinite",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={isProcessing}
                      onClick={() => handleTextScanFolder(folder.folderPath)}
                      className="hover:bg-primary-light p-1 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ color: "var(--color-primary)" }}
                      title="Rescan folder"
                    >
                      {RescanSVG}
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={() => handleTextRemoveFolder(folder.folderPath)}
                      className="hover:bg-primary-light p-1 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ color: "var(--color-primary)" }}
                      title="Remove folder"
                    >
                      {TrashSVG}
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(folder.lastScannedAt)}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {folders.length === 0 && !isProcessing && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm">No text folders indexed yet</p>
            <p className="text-xs text-gray-400 mt-1">Select a folder to start indexing text files</p>
          </div>
        )}
      </div>

      {/* Add Folder Button */}
      <button
        disabled={isProcessing}
        onClick={handleTextSelectFolder}
        className={`w-full px-3 py-2 border rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
          isProcessing
            ? "border-gray-200 text-gray-400 cursor-not-allowed"
            : "border-gray-300 text-gray-600 hover:bg-primary-light hover:border-primary hover:text-primary"
        }`}
      >
        {FileSVG}
        Select Text Folder
      </button>

      {/* Global CSS for progress animation */}
      <style>{`
        @keyframes progress {
          0% { width: 20%; opacity: 0.7; }
          50% { width: 80%; opacity: 1; }
          100% { width: 20%; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
