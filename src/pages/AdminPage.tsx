import { Settings } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage taxonomy, upload reports, and trigger ingestion
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 font-semibold">YAML Taxonomy</h2>
          <p className="text-sm text-muted-foreground">
            Upload or update your master-metadata.yaml file
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 font-semibold">Report Upload</h2>
          <p className="text-sm text-muted-foreground">
            Upload PDF reports for processing
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 font-semibold">Ingestion Status</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and trigger the AI processing pipeline
          </p>
        </div>
      </div>
    </div>
  );
}
