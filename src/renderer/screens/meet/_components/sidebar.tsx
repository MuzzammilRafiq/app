import { useState } from "react";
import { SearchSVG, TrashSVG, VideoCameraSVG } from "../../../components/icons";

interface MeetSession {
  id: string;
  meetingId: string;
  title: string;
  createdAt: number;
  duration?: number;
}

// Sample data for demonstration
const sampleSessions: MeetSession[] = [
  {
    id: "1",
    meetingId: "ABC123",
    title: "Team Standup",
    createdAt: Date.now() - 86400000,
    duration: 1800000,
  },
  {
    id: "2",
    meetingId: "DEF456",
    title: "Product Review",
    createdAt: Date.now() - 172800000,
    duration: 3600000,
  },
];

export default function MeetSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sessions, setSessions] = useState<MeetSession[]>(sampleSessions);

  const filteredSessions = sessions.filter(
    (session) =>
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.meetingId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteSession = (id: string) => {
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-text-muted">{SearchSVG}</div>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings..."
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-border bg-surface text-text-main placeholder-text-muted focus:outline-none focus:border-primary transition-colors text-sm"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            {searchQuery ? "No meetings found" : "No recent meetings"}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="group p-3 rounded-xl border border-border bg-surface hover:border-primary/30 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-primary">{VideoCameraSVG}</div>
                    <h4 className="font-medium text-text-main text-sm truncate">
                      {session.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-7">
                    <span className="text-xs text-text-muted">
                      ID: {session.meetingId}
                    </span>
                    <span className="text-xs text-border">•</span>
                    <span className="text-xs text-text-muted">
                      {formatDate(session.createdAt)}
                    </span>
                    {session.duration && (
                      <>
                        <span className="text-xs text-border">•</span>
                        <span className="text-xs text-text-muted">
                          {formatDuration(session.duration)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                  title="Delete"
                >
                  {TrashSVG}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
