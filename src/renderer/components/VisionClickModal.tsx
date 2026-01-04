import { useState, useCallback, useEffect } from "react";
import { LoadingSVG, CrosshairSVG } from "./icons";
import { loadSettings } from "../services/settingsStorage";

type VisionClickStep =
  | "idle"
  | "capturing"
  | "analyzing-1"
  | "refining"
  | "analyzing-2"
  | "clicking"
  | "done"
  | "error";


type ClickType = "left" | "right" | "double";

interface VisionClickModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDescription: string;
}

const DEBUG_MODE = true; // Toggle this to save intermediate images for debugging



export default function VisionClickModal({
  isOpen,
  onClose,
  targetDescription,
}: VisionClickModalProps) {
  const [step, setStep] = useState<VisionClickStep>("idle");
  const [clickType, setClickType] = useState<ClickType>("left");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  // Store intermediate data for display
  const [firstCell, setFirstCell] = useState<{
    cell: number;
    reason: string;
  } | null>(null);
  const [secondCell, setSecondCell] = useState<{
    cell: number;
    reason: string;
  } | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setProgress("");
    setFirstCell(null);
    setSecondCell(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    // Listen for progress updates from main process
    const handleStatus = (data: { step: string; message: string }) => {
      setStep(data.step as VisionClickStep);
      setProgress(data.message);
    };

    window.electronAPI.onAutomationStatus(handleStatus);

    return () => {
      window.electronAPI.removeAutomationStatusListener();
    };
  }, []);

  const executeVisionClick = useCallback(async () => {
    try {
      const settings = loadSettings();
      if (!settings.openrouterApiKey) {
        throw new Error("OpenRouter API key not found");
      }

      setStep("capturing");
      setError(null);
      setProgress("Starting vision automation...");

      const result = await window.electronAPI.automationExecuteVisionClick(
        settings.openrouterApiKey,
        targetDescription,
        clickType,
        settings.imageModel || undefined,
        DEBUG_MODE
      );

      if (!result.success) {
        throw new Error(result.error || "Vision automation failed");
      }

      // Update intermediate results if available in success response
      if (result.data) {
        if (result.data.firstCell) {
          setFirstCell({
            cell: result.data.firstCell.cell,
            reason: result.data.firstCell.reason,
          });
        }
        if (result.data.secondCell) {
          setSecondCell({
            cell: result.data.secondCell.cell,
            reason: result.data.secondCell.reason,
          });
        }
      }

      setStep("done");
      setProgress("Action completed successfully!");

    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  }, [targetDescription, clickType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-primary-light/20 rounded-xl text-primary">
            {CrosshairSVG}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Vision Click
            </h2>
            <p className="text-sm text-slate-500">
              Click on screen elements using AI vision
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Target description */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Target
            </label>
            <p className="mt-1 text-slate-800 font-medium">
              "{targetDescription}"
            </p>
          </div>

          {/* Click type selector */}
          {step === "idle" && (
            <div className="mb-5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Click Type
              </label>
              <div className="mt-2 flex gap-2">
                {(["left", "right", "double"] as ClickType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setClickType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      clickType === type
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {type === "double" ? "Double Click" : `${type} Click`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Progress indicator */}
          {step !== "idle" && step !== "error" && (
            <div className="mb-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                {step !== "done" && (
                  <span className="animate-spin text-primary">
                    {LoadingSVG}
                  </span>
                )}
                {step === "done" && (
                  <span className="text-green-500 text-xl">✓</span>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {step === "capturing" && "Capturing Screen"}
                    {step === "analyzing-1" && "Analyzing Screenshot"}
                    {step === "refining" && "Refining Target"}
                    {step === "analyzing-2" && "Precise Location"}
                    {step === "clicking" && "Clicking"}
                    {step === "done" && "Complete!"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{progress}</p>
                </div>
              </div>
            </div>
          )}

          {/* Analysis results */}
          {firstCell && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-medium text-blue-700">
                First Pass: Cell {firstCell.cell}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">{firstCell.reason}</p>
            </div>
          )}

          {secondCell && (
            <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs font-medium text-green-700">
                Refined: Sub-cell {secondCell.cell}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                {secondCell.reason}
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className={`mb-4 p-4 rounded-xl border ${
              error.includes("Element not found") 
                ? "bg-amber-50 border-amber-100" 
                : "bg-red-50 border-red-100"
            }`}>
              <div className="flex items-start gap-2">
                {error.includes("Element not found") ? (
                  <span className="text-xl">🔍</span>
                ) : (
                  <span className="text-xl">❌</span>
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    error.includes("Element not found") 
                      ? "text-amber-700" 
                      : "text-red-700"
                  }`}>
                    {error.includes("Element not found") ? "Not Found" : "Error"}
                  </p>
                  <p className={`text-xs mt-1 ${
                    error.includes("Element not found") 
                      ? "text-amber-600" 
                      : "text-red-600"
                  }`}>
                    {error}
                  </p>
                  {error.includes("Element not found") && (
                    <p className="text-xs text-amber-500 mt-2">
                      💡 Try describing the element differently or check if it's visible on screen
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            {step === "done" || step === "error" ? "Close" : "Cancel"}
          </button>

          {step === "idle" && (
            <button
              onClick={executeVisionClick}
              disabled={!targetDescription.trim()}
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Vision Click
            </button>
          )}

          {(step === "error" || step === "done") && (
            <button
              onClick={reset}
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
