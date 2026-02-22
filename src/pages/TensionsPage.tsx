import { GitFork } from "lucide-react";

export default function TensionsPage() {
  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <GitFork className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tensions</h1>
          <p className="text-sm text-muted-foreground">
            Explore where reports diverge — contradictions, tradeoffs, and scope differences
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          No tensions loaded yet. Upload your YAML taxonomy from the Admin page to get started.
        </p>
      </div>
    </div>
  );
}
