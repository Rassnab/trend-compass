import { useState, useEffect } from "react";
import { Activity, Play, Loader2, CheckCircle, AlertCircle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Batch {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  reports_total: number;
  reports_processed: number;
  claims_extracted: number;
  unmapped_claim_pct: number;
  error_message: string | null;
}

interface Report {
  id: string;
  title: string;
  status: string;
  error_message: string | null;
}

export default function IngestionStatus() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pendingReports, setPendingReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [batchRes, reportRes] = await Promise.all([
      supabase
        .from("ingestion_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("reports")
        .select("id, title, status, error_message")
        .eq("status", "pending"),
    ]);
    if (batchRes.data) setBatches(batchRes.data as Batch[]);
    if (reportRes.data) setPendingReports(reportRes.data as Report[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerIngestion = async () => {
    if (pendingReports.length === 0) {
      toast.error("No pending reports to process");
      return;
    }

    setTriggering(true);
    try {
      // Create a new batch
      const { data: batch, error } = await supabase
        .from("ingestion_batches")
        .insert({
          status: "queued",
          reports_total: pendingReports.length,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Link pending reports to batch
      const { error: updateErr } = await supabase
        .from("reports")
        .update({ batch_id: batch.id })
        .eq("status", "pending");

      if (updateErr) throw updateErr;

      toast.success(`Batch created with ${pendingReports.length} reports. Ingestion pipeline will process them when edge functions are deployed.`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger ingestion");
    }
    setTriggering(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "succeeded": return <CheckCircle className="h-4 w-4 text-accent" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "succeeded": return "default";
      case "failed": return "destructive";
      case "running": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Ingestion Status</h2>
      </div>

      {/* Pending reports */}
      <div className="rounded-md border bg-background p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>
              <strong>{pendingReports.length}</strong> pending report{pendingReports.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            size="sm"
            onClick={triggerIngestion}
            disabled={triggering || pendingReports.length === 0}
          >
            {triggering ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Trigger Ingestion
          </Button>
        </div>
      </div>

      {/* Batch history */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ingestion batches yet.</p>
      ) : (
        <div className="space-y-2">
          {batches.map((batch) => (
            <div key={batch.id} className="rounded-md border bg-background p-3">
              <div className="flex items-center gap-2 text-sm">
                {statusIcon(batch.status)}
                <Badge variant={statusVariant(batch.status)} className="text-xs">
                  {batch.status}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(batch.started_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>Reports: {batch.reports_processed}/{batch.reports_total}</span>
                <span>Claims: {batch.claims_extracted}</span>
                <span>Unmapped: {batch.unmapped_claim_pct}%</span>
              </div>
              {batch.error_message && (
                <p className="mt-1 text-xs text-destructive">{batch.error_message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
