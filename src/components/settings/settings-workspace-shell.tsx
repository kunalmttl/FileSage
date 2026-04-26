import { Database, HardDrive, Lock, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sections = [
  {
    title: "Vault management",
    description: "Reconnect permissions, rescan vaults, and remove stored vault metadata.",
    icon: HardDrive,
  },
  {
    title: "Indexing preferences",
    description: "File type support, OCR toggle, file size limits, and scan rules.",
    icon: Settings2,
  },
  {
    title: "Storage",
    description: "IndexedDB usage, future chunk/vector counts, clear cache, and rebuild index.",
    icon: Database,
  },
  {
    title: "Privacy",
    description: "Local-only status, disabled cloud APIs, and browser permission notes.",
    icon: Lock,
  },
];

export function SettingsWorkspaceShell() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {sections.map((section) => {
        const Icon = section.icon;

        return (
          <Card key={section.title} className="rounded-3xl shadow-none">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </div>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="rounded-full">
                Placeholder
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
