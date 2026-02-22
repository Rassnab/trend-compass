import { Layers } from "lucide-react";

export default function ThemesPage() {
  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Layers className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Themes</h1>
          <p className="text-sm text-muted-foreground">
            Browse and explore themes extracted from your report corpus
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          No themes loaded yet. Upload your YAML taxonomy from the Admin page to get started.
        </p>
      </div>
    </div>
  );
}
