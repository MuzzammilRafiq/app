import type { UniqueResult } from "../../../common/types";

function parseSources(content: string): UniqueResult[] | null {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      // Basic shape validation
      return data.filter(
        (d: any) =>
          d &&
          typeof d.id === "string" &&
          typeof d.document === "string" &&
          d.metadata &&
          typeof d.metadata.path === "string" &&
          typeof d.metadata.index === "number"
      );
    }
    return null;
  } catch {
    return null;
  }
}

export default function SourceRenderer({ content }: { content: string }) {
  const sources = parseSources(content);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Sources</div>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="group rounded border border-emerald-200/60 bg-white p-2 text-sm shadow-sm">
            <div className="font-medium text-slate-800">
              {s.document.slice(0, 200)}
              {s.document.length > 200 ? "…" : ""}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <span className="truncate">{s.metadata.path}</span>
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              <span>Index: {s.metadata.index}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
