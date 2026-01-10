import { useEffect, useState } from "react";
import { RescanSVG, TrashSVG } from "../../../components/icons";
import toast from "react-hot-toast";
import { Folder, File, FolderPlus, FilePlus } from "lucide-react";

interface PathInfo {
  path: string;
  isFile: boolean;
  lastScannedAt: number | null;
}

type ScanningState = {
  folder: string;
  action: "scanning" | "deleting" | "adding";
} | null;

export default function Text() {
  const [paths, setPaths] = useState<PathInfo[]>([]);
  const [scanningState, setScanningState] = useState<ScanningState>(null);

  // Load paths from database on mount
  useEffect(() => {
    const loadPaths = async () => {
      try {
        const dbFolders = await window.electronAPI.dbGetRagFolders("text");
        // All entries from DB are treated as folder paths (for now, we store files with their path in folder_path)
        setPaths(
          dbFolders.map((f) => ({
            path: f.folderPath,
            isFile: !f.folderPath.includes(".") ? false : true, // Heuristic: files have extensions
            lastScannedAt: f.lastScannedAt,
          }))
        );
      } catch (error) {
        console.error("Failed to load text paths:", error);
        toast.error("Failed to load indexed paths");
      }
    };
    loadPaths();
  }, []);

  const handleTextSelectFolder = async () => {
    try {
      const result = await window.electronAPI?.selectTextFolder();
      if (result) {
        // Check if path already exists
        if (paths.some((p) => p.path === result)) {
          toast.error("Folder already added");
          return;
        }
        await handleTextScanPath(result, true, false);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      toast.error("Failed to select folder");
    }
  };

  const handleTextSelectFiles = async () => {
    try {
      const result = await window.electronAPI?.selectTextFiles();
      if (result && result.length > 0) {
        // Process each file
        for (const filePath of result) {
          if (paths.some((p) => p.path === filePath)) {
            toast.error(`File already added: ${filePath.split("/").pop()}`);
            continue;
          }
          await handleTextScanPath(filePath, true, true);
        }
      }
    } catch (error) {
      console.error("Failed to select files:", error);
      toast.error("Failed to select files");
    }
  };

  const handleTextScanPath = async (
    pathStr: string,
    isNew = false,
    isFile = false
  ) => {
    try {
      setScanningState({
        folder: pathStr,
        action: isNew ? "adding" : "scanning",
      });
      console.log(isFile ? "scanning file" : "scanning folder", pathStr);

      // Python-first: scan path first
      let result;
      if (isFile) {
        result = await window.electronAPI?.scanTextFile(pathStr);
      } else {
        result = await window.electronAPI?.scanTextFolder(pathStr);
      }

      if (!result?.success) {
        throw new Error(
          result?.error || `Failed to scan ${isFile ? "file" : "folder"}`
        );
      }

      // If Python succeeded, update database
      const now = Date.now();
      if (isNew) {
        await window.electronAPI.dbAddRagFolder(pathStr, "text", now);
      } else {
        await window.electronAPI.dbUpdateRagFolderScanTime(pathStr, now);
      }

      // Update local state
      if (isNew) {
        setPaths((prev) => [
          { path: pathStr, isFile, lastScannedAt: now },
          ...prev,
        ]);
      } else {
        setPaths((prev) =>
          prev.map((p) =>
            p.path === pathStr ? { ...p, lastScannedAt: now } : p
          )
        );
      }

      toast.success(
        isNew
          ? `${isFile ? "File" : "Folder"} added and indexed`
          : `${isFile ? "File" : "Folder"} rescanned`
      );
    } catch (error: any) {
      console.error("Error scanning path:", error);
      toast.error(
        error.message || `Failed to scan ${isFile ? "file" : "folder"}`
      );
    } finally {
      setScanningState(null);
    }
  };

  const handleTextRemovePath = async (pathStr: string) => {
    try {
      setScanningState({ folder: pathStr, action: "deleting" });

      // Python-first: delete from ChromaDB first
      const response = await window.electronAPI.deleteTextFolder(pathStr);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete embeddings");
      }

      // If Python succeeded, delete from database
      await window.electronAPI.dbDeleteRagFolder(pathStr);

      // Update local state
      setPaths((prev) => prev.filter((p) => p.path !== pathStr));

      toast.success("Removed successfully");
    } catch (error: any) {
      toast.error("Error removing: " + error.message);
      console.error("Error removing path:", error);
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
            <div
              className="text-sm text-gray-700 mb-2 truncate"
              title={scanningState.folder}
            >
              {scanningState.folder}
            </div>
            <div className="flex items-center gap-2 py-1">
              <div className="relative">
                <div
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{
                    borderColor: "var(--color-primary)",
                    borderTopColor: "transparent",
                  }}
                />
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--color-primary)" }}
              >
                Adding and indexing...
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

        {paths.map((pathInfo) => {
          const isPathProcessing = scanningState?.folder === pathInfo.path;
          const isScanning =
            isPathProcessing && scanningState?.action === "scanning";
          const isDeleting =
            isPathProcessing && scanningState?.action === "deleting";

          return (
            <div
              key={pathInfo.path}
              className="bg-surface px-3 py-2 rounded-md transition-all duration-200"
              style={{
                boxShadow: isPathProcessing
                  ? "0 0 0 2px var(--color-primary-light)"
                  : undefined,
              }}
            >
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                {pathInfo.isFile ? <File className="w-4 h-4 flex-shrink-0" /> : <Folder className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate" title={pathInfo.path}>
                  {pathInfo.path}
                </span>
              </div>

              {isPathProcessing ? (
                <div className="flex items-center gap-2 py-1">
                  <div className="relative">
                    <div
                      className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{
                        borderColor: "var(--color-primary)",
                        borderTopColor: "transparent",
                      }}
                    />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {isScanning && "Rescanning..."}
                    {isDeleting && "Removing..."}
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
                      onClick={() =>
                        handleTextScanPath(
                          pathInfo.path,
                          false,
                          pathInfo.isFile
                        )
                      }
                      className="hover:bg-primary-light p-1 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ color: "var(--color-primary)" }}
                      title="Rescan"
                    >
                      {RescanSVG}
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={() => handleTextRemovePath(pathInfo.path)}
                      className="hover:bg-primary-light p-1 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ color: "var(--color-primary)" }}
                      title="Remove"
                    >
                      {TrashSVG}
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(pathInfo.lastScannedAt)}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {paths.length === 0 && !isProcessing && (
          <div className="text-center py-8 text-gray-500">
            <File className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">No text files or folders indexed yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Select a folder or files to start indexing
            </p>
          </div>
        )}  
      </div>

      {/* Add Buttons */}
      <div className="flex gap-2">
        <button
          disabled={isProcessing}
          onClick={handleTextSelectFolder}
          className={`flex-1 px-3 py-2 border rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            isProcessing
              ? "border-gray-200 text-gray-400 cursor-not-allowed"
              : "border-gray-300 text-gray-600 hover:bg-primary-light hover:border-primary hover:text-primary"
          }`}
        >
          <FolderPlus className="w-4 h-4" /> Select Folder
        </button>
        <button
          disabled={isProcessing}
          onClick={handleTextSelectFiles}
          className={`flex-1 px-3 py-2 border rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            isProcessing
              ? "border-gray-200 text-gray-400 cursor-not-allowed"
              : "border-gray-300 text-gray-600 hover:bg-primary-light hover:border-primary hover:text-primary"
          }`}
        >
          <FilePlus className="w-4 h-4" /> Select Files
        </button>
      </div>

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
