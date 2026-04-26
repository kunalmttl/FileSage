import { SlidersHorizontal, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const queueStats = [
  ["Suggestions", "0"],
  ["High confidence", "0"],
  ["Draft actions", "0"],
];

export function OrganizeWorkspaceShell() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Review queue</CardTitle>
            <CardDescription>
              Dry-run naming, category, tag, and folder suggestions will appear
              here after extraction.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {queueStats.map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <EmptyState
          title="No suggestions yet"
          description="Organizer suggestions will be generated after files are scanned, extracted, and scored."
          icon={<Sparkles className="size-5" />}
        />
      </section>

      <aside className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Placeholder for vault, type, category, and confidence filters.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["Vault", "Category", "Confidence", "Type"].map((filter) => (
              <Badge key={filter} variant="outline" className="rounded-full">
                <SlidersHorizontal className="size-3" />
                {filter}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Dry-run rename and move previews will be shown before any future
              action layer exists.
            </CardDescription>
          </CardHeader>
        </Card>
      </aside>
    </div>
  );
}
