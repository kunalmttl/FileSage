import {
  FileSearch,
  MessageSquareText,
  Sparkles,
  Layers,
  Files,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FileMetadataBrowser } from "@/components/shared/file-metadata-browser";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { VaultConnector } from "@/features/file-access/components/vault-connector";

export default function Home() {
  return (
    <div className="space-y-8 animate-fade-up">

      {/* Page header */}
      <PageHeader
        eyebrow="Home"
        title="Dashboard"
        description="Connect vaults, monitor the indexing pipeline, and jump into your FileSage workspaces."
      />

      {/* Quick action cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <QuickActionCard
          href="/search"
          title="Search"
          description="Find files by filename, content, or semantic meaning across your vaults."
          icon={<FileSearch className="size-5" />}
          accent="sage"
        />
        <QuickActionCard
          href="/ask"
          title="Ask"
          description="Chat with your files, grounded in retrieved evidence and local inference."
          icon={<MessageSquareText className="size-5" />}
          accent="dark"
        />
        <QuickActionCard
          href="/organize"
          title="Organize"
          description="Review AI-generated naming, category, and tag suggestions in dry-run mode."
          icon={<Sparkles className="size-5" />}
          accent="warm"
        />
      </section>

      {/* Vault connector */}
      <VaultConnector />
      <div className="flex flex-wrap gap-3">
        {[
          { icon: Files,  label: "Files indexed",    value: "—" },
          { icon: Layers, label: "Chunks",            value: "—" },
          { icon: Cpu,    label: "Vectors (384-dim)", value: "—" },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: "rgba(232,237,229,0.60)",
              border: "1px solid rgba(195,206,188,0.50)",
            }}
          >
            <Icon className="size-3.5 shrink-0" style={{ color: "#909D92" }} />
            <span
              className="text-xs font-medium"
              style={{ color: "#3D4840", fontFamily: "Urbanist, sans-serif" }}
            >
              {value} {label}
            </span>
          </div>
        ))}
      </div>

      {/* File browser */}
      <FileMetadataBrowser />

      {/* Safety status */}
      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4"
        style={{
          background: "rgba(232,237,229,0.45)",
          border: "1px solid rgba(195,206,188,0.40)",
        }}
      >
        <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: "#909D92" }} />
        <p className="text-sm leading-6" style={{ color: "#7A8580" }}>
          <span className="font-medium" style={{ color: "#3D4840" }}>
            Read-only mode.
          </span>{" "}
          FileSage scans and indexes your files locally. Rename and move actions
          remain dry-run only until you approve them.
        </p>
      </div>
    </div>
  );
}
