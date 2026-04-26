import { PageHeader } from "@/components/layout/page-header";
import { OrganizeWorkspaceShell } from "@/components/organize/organize-workspace-shell";

export default function OrganizePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organize"
        title="Review dry-run suggestions"
        description="Inspect proposed filenames, folders, tags, reasons, and confidence before any future file action exists."
      />
      <OrganizeWorkspaceShell />
    </div>
  );
}
