"use client";

const SUGGESTIONS = [
  "Summarize the most important points in my recent notes",
  "What project deadlines appear across my documents?",
  "Find key findings in my research PDFs",
  "What action items are mentioned in these files?",
];

export function SuggestedQueries({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="rounded-2xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-foreground/20 hover:bg-secondary/40"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
