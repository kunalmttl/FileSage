"use client";

import { MessageSquareText } from "lucide-react";
import type { AskMessage } from "@/features/ask/conversation-store";
import { MessageBubble } from "@/components/ask/message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatThread({ messages }: { messages: AskMessage[] }) {
  if (!messages.length) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-card">
          <MessageSquareText className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Ask your indexed files</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          FileSage retrieves local snippets first, then uses the local model to compose a cited answer.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[520px] rounded-2xl border bg-background p-4">
      <div className="space-y-4 pr-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  );
}
