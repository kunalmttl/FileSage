import { PageHeader } from "@/components/layout/page-header";
import { AskWorkspaceShell } from "@/components/ask/ask-workspace-shell";

export default function AskPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ask"
        title="Ask with local evidence"
        description="Grounded Q&A will retrieve snippets first, then compose cited answers from local files."
      />
      <AskWorkspaceShell />
    </div>
  );
}
