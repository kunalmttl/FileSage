import { FileSearch, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FileMetadataBrowser } from "@/components/shared/file-metadata-browser";
import { PipelineStatus } from "@/components/shared/pipeline-status";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { ReadinessCard } from "@/components/shared/readiness-card";
import { VaultConnector } from "@/features/file-access/components/vault-connector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Home"
        title="Dashboard"
        description="Connect vaults, monitor the local indexing pipeline, and jump into the main FileSage workspaces."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <QuickActionCard
          href="/search"
          title="Search"
          description="Find files by filename, metadata, and later semantic chunks."
          icon={<FileSearch className="size-5" />}
        />
        <QuickActionCard
          href="/ask"
          title="Ask"
          description="Prepare grounded questions over retrieved local evidence."
          icon={<MessageSquareText className="size-5" />}
        />
        <QuickActionCard
          href="/organize"
          title="Organize"
          description="Review dry-run naming and folder suggestions."
          icon={<Sparkles className="size-5" />}
        />
      </section>

      <VaultConnector />

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <PipelineStatus />
        <ReadinessCard />
      </section>

      <FileMetadataBrowser />

      <Card className="rounded-3xl shadow-none">
        <CardHeader>
          <CardTitle>Safety status</CardTitle>
          <CardDescription>
            Current MVP behavior for file operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 rounded-2xl border bg-secondary/60 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
            <p>
              FileSage scans and stores metadata locally. Rename and move
              actions remain dry-run only.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
