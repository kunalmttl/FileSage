import { FileSearch, SlidersHorizontal } from "lucide-react";
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

export function SearchWorkspaceShell() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Search workspace</CardTitle>
            <CardDescription>
              The search input and filters are placed now so retrieval can plug
              in without route changes later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              disabled
              placeholder="Search by meaning, filename, or file content..."
              className="h-11 rounded-2xl"
            />
            <div className="flex flex-wrap gap-2">
              {["Keyword", "Semantic", "Hybrid"].map((mode) => (
                <Badge key={mode} variant="secondary" className="rounded-full">
                  {mode}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <EmptyState
          title="No searchable chunks yet"
          description="Results will appear after extraction, chunking, and retrieval indexing are implemented."
          icon={<FileSearch className="size-5" />}
        />
      </section>

      <aside className="space-y-5">
        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Vault, type, modified date, size, tag, and OCR filters.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["Vault", "Type", "Date", "Size", "Tags"].map((filter) => (
              <Badge key={filter} variant="outline" className="rounded-full">
                <SlidersHorizontal className="size-3" />
                {filter}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-none">
          <CardHeader>
            <CardTitle>Result detail</CardTitle>
            <CardDescription>
              Selected file metadata, snippets, and why-this-result details will
              render here.
            </CardDescription>
          </CardHeader>
        </Card>
      </aside>
    </div>
  );
}
