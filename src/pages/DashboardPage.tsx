import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of themes, tensions, and report coverage
          </p>
        </div>
      </div>

      {/* Placeholder panels */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Top Themes</h2>
          <p className="text-sm text-muted-foreground">
            No themes computed yet. Upload reports and run ingestion to see results.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Top Tensions</h2>
          <p className="text-sm text-muted-foreground">
            No tensions computed yet. Upload reports and run ingestion to see results.
          </p>
        </div>
      </div>
    </div>
  );
}
