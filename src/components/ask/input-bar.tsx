"use client";

import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InputBar({
  value,
  disabled,
  placeholder = "Ask anything about your indexed files...",
  onChange,
  onSubmit,
}: {
  value: string;
  disabled: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-2 rounded-2xl border bg-card p-2">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        rows={2}
        className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
      />
      <Button
        type="button"
        size="icon"
        className="mt-auto rounded-xl"
        disabled={disabled || !value.trim()}
        onClick={onSubmit}
        aria-label="Send question"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
