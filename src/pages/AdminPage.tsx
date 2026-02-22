import { Settings } from "lucide-react";
import YamlUpload from "@/components/admin/YamlUpload";
import ReportUpload from "@/components/admin/ReportUpload";
import IngestionStatus from "@/components/admin/IngestionStatus";
import { useState } from "react";

export default function AdminPage() {
  const [refreshKey, setRefreshKey] = useState(0);

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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <YamlUpload />
        </div>
        <div className="rounded-lg border bg-card p-6">
          <ReportUpload onUploadComplete={() => setRefreshKey((k) => k + 1)} />
        </div>
        <div className="rounded-lg border bg-card p-6">
          <IngestionStatus key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
