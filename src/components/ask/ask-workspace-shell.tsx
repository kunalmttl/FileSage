import { MessageSquareText, Quote } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AskWorkspaceShell() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Grounded assistant</CardTitle>
            <CardDescription>
              Ask mode will answer from retrieved local snippets with citations,
              not unsupported free-form responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border bg-background p-5">
              <EmptyState
                title="Connect and index a vault first"
                description="Conversation history and cited answers will render here once retrieval is available."
                icon={<MessageSquareText className="size-5" />}
              />
            </div>
            <Input
              disabled
              placeholder="Ask a question about indexed files..."
              className="h-11 rounded-2xl"
            />
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Vault scope</CardTitle>
            <CardDescription>
              Placeholder for selecting which vaults retrieval should use.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="rounded-full">
              All connected vaults
            </Badge>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>
              Top matched snippets and citations will appear before answer
              composition.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              <Quote className="mt-0.5 size-4 shrink-0" />
              No retrieved evidence yet.
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
