import { PageHeader } from "@/components/layout/page-header";
import { SearchWorkspaceShell } from "@/components/search/search-workspace-shell";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Search"
        title="Search local files"
        description="A retrieval workspace for keyword, semantic, and hybrid search over indexed vault content."
      />
      <SearchWorkspaceShell />
    </div>
  );
}
