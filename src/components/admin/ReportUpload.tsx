import { useState, useCallback } from "react";
import { Upload, File, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadedReport {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  reportId?: string;
}

export default function ReportUpload({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<UploadedReport[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...selected]);
    // Reset input
    e.target.value = "";
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Select PDF files first");
      return;
    }

    setIsUploading(true);
    const results: UploadedReport[] = files.map((f) => ({
      name: f.name,
      status: "pending",
    }));
    setUploads([...results]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      results[i].status = "uploading";
      setUploads([...results]);

      try {
        // Upload to storage
        const filePath = `uploads/${Date.now()}_${file.name}`;
        const { error: storageError } = await supabase.storage
          .from("reports")
          .upload(filePath, file, { contentType: "application/pdf" });

        if (storageError) throw storageError;

        // Create report record
        const { data, error: dbError } = await supabase
          .from("reports")
          .insert({
            title: file.name.replace(/\.pdf$/i, ""),
            file_path: filePath,
            status: "pending",
          })
          .select("id")
          .single();

        if (dbError) throw dbError;

        results[i].status = "done";
        results[i].reportId = data.id;
      } catch (err: any) {
        results[i].status = "error";
        results[i].error = err.message || "Upload failed";
      }

      setUploads([...results]);
    }

    const succeeded = results.filter((r) => r.status === "done").length;
    const failed = results.filter((r) => r.status === "error").length;

    if (succeeded > 0) toast.success(`${succeeded} report(s) uploaded`);
    if (failed > 0) toast.error(`${failed} report(s) failed`);

    setFiles([]);
    setIsUploading(false);
    onUploadComplete?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Upload className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Report Upload</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Upload PDF reports for processing by the ingestion pipeline.
      </p>

      {/* File picker */}
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
          <Upload className="h-4 w-4" />
          Select PDF files
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-sm">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">
                {(f.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <Button onClick={handleUpload} disabled={isUploading}>
          {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upload {files.length} file{files.length > 1 ? "s" : ""}
        </Button>
      )}

      {/* Upload results */}
      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {u.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {u.status === "done" && <CheckCircle className="h-4 w-4 text-accent" />}
              {u.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
              {u.status === "pending" && <div className="h-4 w-4 rounded-full border-2" />}
              <span className={u.status === "error" ? "text-destructive" : ""}>{u.name}</span>
              {u.error && <span className="text-xs text-destructive">({u.error})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
