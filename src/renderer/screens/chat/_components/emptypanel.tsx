import { Lightbulb, Search, Image, BookOpen } from "lucide-react";
export default function EmptyPanel() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-primary">
            How can I help you?
          </h1>
          <p className="text-lg text-text-main">
            Start a conversation by typing a message below
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
          <div className="p-4 rounded-lg shadow-premium bg-surface border border-border transition-colors">
            <div className="mb-2">
              <Lightbulb size={28} className="text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="font-medium mb-1 text-primary">Get Answers</h3>
            <p className="text-sm text-text-main">
              Ask questions and get intelligent responses
            </p>
          </div>

          <div className="p-4 rounded-lg shadow-premium bg-surface border border-border transition-colors">
            <div className="mb-2">
              <Search size={28} className="text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="font-medium mb-1 text-primary">Search the Web</h3>
            <p className="text-sm text-text-main">
              Enable web search for up-to-date information
            </p>
          </div>

          <div className="p-4 rounded-lg shadow-premium bg-surface border border-border transition-colors">
            <div className="mb-2">
              <Image size={28} className="text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="font-medium mb-1 text-primary">Analyze Images</h3>
            <p className="text-sm text-text-main">
              Upload and discuss images in your chat
            </p>
          </div>

          <div className="p-4 rounded-lg shadow-premium bg-surface border border-border transition-colors">
            <div className="mb-2">
              <BookOpen size={28} className="text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="font-medium mb-1 text-primary">RAG Search</h3>
            <p className="text-sm text-text-main">
              Search through your knowledge base
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
