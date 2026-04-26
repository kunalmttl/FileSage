import { PageHeader } from "@/components/layout/page-header";
import { SettingsWorkspaceShell } from "@/components/settings/settings-workspace-shell";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Control local behavior"
        description="Settings will own vault management, storage, indexing preferences, privacy, and debug controls."
      />
      <SettingsWorkspaceShell />
    </div>
  );
}
