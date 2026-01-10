import { MousePointer2, Keyboard, Eye, Zap } from "lucide-react";
import VisionInput from "./VisionInput";
import VisionLogPanel from "./VisionLogPanel";
import { useVisionLogStore } from "./VisionLogStore";

export default function VisionContainer() {
  const logs = useVisionLogStore((s) => s.logs);
  const hasLogs = logs.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-bg-chat">
      {hasLogs ? (
        <>
          {/* Log Panel */}
          <VisionLogPanel />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl text-center space-y-6">
            <div className="space-y-3">
              <div className="flex justify-center">
                <Zap size={64} style={{ color: '#3e2723' }} strokeWidth={1.5} />
              </div>
              <h1 className="text-4xl font-semibold" style={{ color: '#3e2723' }}>
                Vision Agent
              </h1>
              <p className="text-lg" style={{ color: '#5d4037', opacity: 0.8 }}>
                Automate tasks on your screen with AI-powered vision
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
              <div className="p-4 rounded-lg shadow-premium" style={{ 
                backgroundColor: '#fefefe',
                border: '1px solid rgba(62, 39, 35, 0.08)'
              }}>
                <div className="mb-2">
                  <MousePointer2 size={28} style={{ color: '#3e2723' }} strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1" style={{ color: '#3e2723' }}>Click Elements</h3>
                <p className="text-sm" style={{ color: '#5d4037', opacity: 0.7 }}>Automatically click buttons, links, and UI elements</p>
              </div>
              
              <div className="p-4 rounded-lg shadow-premium" style={{ 
                backgroundColor: '#fefefe',
                border: '1px solid rgba(62, 39, 35, 0.08)'
              }}>
                <div className="mb-2">
                  <Keyboard size={28} style={{ color: '#3e2723' }} strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1" style={{ color: '#3e2723' }}>Type Text</h3>
                <p className="text-sm" style={{ color: '#5d4037', opacity: 0.7 }}>Fill forms and input fields automatically</p>
              </div>
              
              <div className="p-4 rounded-lg shadow-premium" style={{ 
                backgroundColor: '#fefefe',
                border: '1px solid rgba(62, 39, 35, 0.08)'
              }}>
                <div className="mb-2">
                  <Eye size={28} style={{ color: '#3e2723' }} strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1" style={{ color: '#3e2723' }}>Visual Detection</h3>
                <p className="text-sm" style={{ color: '#5d4037', opacity: 0.7 }}>Find and interact with UI elements by vision</p>
              </div>
              
              <div className="p-4 rounded-lg shadow-premium" style={{ 
                backgroundColor: '#fefefe',
                border: '1px solid rgba(62, 39, 35, 0.08)'
              }}>
                <div className="mb-2">
                  <Zap size={28} style={{ color: '#3e2723' }} strokeWidth={1.5} />
                </div>
                <h3 className="font-medium mb-1" style={{ color: '#3e2723' }}>Multi-Step Tasks</h3>
                <p className="text-sm" style={{ color: '#5d4037', opacity: 0.7 }}>Complete complex workflows automatically</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <VisionInput />
    </div>
  );
}
