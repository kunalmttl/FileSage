import type { ContextChunk } from "@/features/ask/context-builder";
import type { ResolvedCitation } from "@/features/ask/citation-resolver";

export type AskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  contextChunks?: ContextChunk[];
  citations?: ResolvedCitation[];
  isStreaming?: boolean;
  interrupted?: boolean;
  error?: string;
  timestamp: number;
};

export type Conversation = {
  messages: AskMessage[];
  vaultScope: string | null;
};

export function createMessage(
  role: AskMessage["role"],
  content: string,
  overrides: Partial<AskMessage> = {}
): AskMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function lastConversationMessages(messages: AskMessage[], limit = 6) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => !message.error && !message.isStreaming)
    .filter((message) => !isUngroundedRefusal(message.content))
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function isUngroundedRefusal(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("i don't have access to your local files") ||
    lower.includes("i don’t have access to your local files") ||
    lower.includes("i don't have enough information in your indexed files") ||
    lower.includes("i don’t have enough information in your indexed files")
  );
}
