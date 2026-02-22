import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaml from "js-yaml";

interface ParsedTaxonomy {
  themes: any[];
  tensions: any[];
  config: Record<string, any>;
}

function parseMasterYaml(raw: string): ParsedTaxonomy {
  const doc = yaml.load(raw) as any;
  if (!doc || typeof doc !== "object") throw new Error("Invalid YAML structure");

  const themes: any[] = [];
  const tensions: any[] = [];
  const config: Record<string, any> = {};

  // Parse themes — support both array and map formats
  const rawThemes = doc.themes || doc.theme_definitions || {};
  if (Array.isArray(rawThemes)) {
    rawThemes.forEach((t: any) => themes.push(normalizeTheme(t)));
  } else if (typeof rawThemes === "object") {
    Object.entries(rawThemes).forEach(([key, val]: [string, any]) => {
      themes.push(normalizeTheme({ theme_id: key, ...val }));
    });
  }

  // Parse tensions
  const rawTensions = doc.tensions || doc.tension_definitions || {};
  if (Array.isArray(rawTensions)) {
    rawTensions.forEach((t: any) => tensions.push(normalizeTension(t)));
  } else if (typeof rawTensions === "object") {
    Object.entries(rawTensions).forEach(([key, val]: [string, any]) => {
      tensions.push(normalizeTension({ tension_id: key, ...val }));
    });
  }

  // Extract scoring / config / groups / qa_rules
  const configKeys = ["scoring", "groups", "qa_rules", "dashboard_defaults", "report_registry"];
  configKeys.forEach((k) => {
    if (doc[k]) config[k] = doc[k];
  });

  if (themes.length === 0 && tensions.length === 0) {
    throw new Error("No themes or tensions found. Check your YAML structure.");
  }

  return { themes, tensions, config };
}

function normalizeTheme(t: any) {
  return {
    theme_id: t.theme_id || t.id || "unknown",
    label: t.label || t.name || t.theme_id || "Untitled",
    definition: t.definition || t.description || null,
    boundaries: t.boundaries || {},
    cues: t.cues || t.evidence_cues || {},
    dimensions: t.dimensions || {},
    ui_group: t.ui_group || t.group || null,
    ui_order: t.ui_order ?? t.order ?? 0,
    relationships: t.relationships || {},
    governance: t.governance || {},
    raw_yaml: t,
  };
}

function normalizeTension(t: any) {
  const poles = t.poles || {};
  const poleA = poles.A || poles.pole_a || t.pole_a || {};
  const poleB = poles.B || poles.pole_b || t.pole_b || {};
  return {
    tension_id: t.tension_id || t.id || "unknown",
    label: t.label || t.name || t.tension_id || "Untitled",
    pole_a_label: poleA.label || poleA.name || "Pole A",
    pole_a_cues: poleA.cues || poleA.evidence_cues || {},
    pole_b_label: poleB.label || poleB.name || "Pole B",
    pole_b_cues: poleB.cues || poleB.evidence_cues || {},
    false_tension_rules: t.false_tension_rules || t.false_tension || {},
    implications: t.implications || {},
    linked_themes: t.linked_themes || t.related_themes || [],
    tension_type: t.type || t.tension_type || null,
    raw_yaml: t,
  };
}

export default function YamlUpload() {
  const [yamlText, setYamlText] = useState("");
  const [status, setStatus] = useState<"idle" | "parsing" | "saving" | "done" | "error">("idle");
  const [summary, setSummary] = useState<{ themes: number; tensions: number; configs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setYamlText(ev.target?.result as string);
      setStatus("idle");
      setSummary(null);
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = async () => {
    if (!yamlText.trim()) {
      toast.error("Paste or upload a YAML file first");
      return;
    }

    setStatus("parsing");
    setErrorMsg("");
    setSummary(null);

    try {
      const parsed = parseMasterYaml(yamlText);
      setStatus("saving");

      // Upsert themes
      for (const theme of parsed.themes) {
        const { error } = await supabase.from("taxonomy_themes").upsert(theme, { onConflict: "theme_id" });
        if (error) throw new Error(`Theme "${theme.theme_id}": ${error.message}`);
      }

      // Upsert tensions
      for (const tension of parsed.tensions) {
        const { error } = await supabase.from("taxonomy_tensions").upsert(tension, { onConflict: "tension_id" });
        if (error) throw new Error(`Tension "${tension.tension_id}": ${error.message}`);
      }

      // Upsert config entries
      const configEntries = Object.entries(parsed.config);
      for (const [key, value] of configEntries) {
        const { error } = await supabase.from("taxonomy_config").upsert(
          { config_key: key, config_value: value, updated_at: new Date().toISOString() },
          { onConflict: "config_key" }
        );
        if (error) throw new Error(`Config "${key}": ${error.message}`);
      }

      setSummary({
        themes: parsed.themes.length,
        tensions: parsed.tensions.length,
        configs: configEntries.length,
      });
      setStatus("done");
      toast.success("Taxonomy loaded successfully");
    } catch (err: any) {
      setErrorMsg(err.message || "Unknown error");
      setStatus("error");
      toast.error(err.message || "Failed to parse YAML");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">YAML Taxonomy</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Upload or paste your <code className="rounded bg-muted px-1 py-0.5 text-xs">master-metadata.yaml</code> file.
      </p>

      {/* File input */}
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
          <Upload className="h-4 w-4" />
          Choose .yaml file
          <input
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Textarea */}
      <Textarea
        value={yamlText}
        onChange={(e) => {
          setYamlText(e.target.value);
          setStatus("idle");
          setSummary(null);
        }}
        placeholder="Or paste YAML contents here..."
        className="min-h-[200px] font-mono text-xs"
      />

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={status === "parsing" || status === "saving"}
      >
        {(status === "parsing" || status === "saving") && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {status === "parsing" ? "Parsing..." : status === "saving" ? "Saving..." : "Load Taxonomy"}
      </Button>

      {/* Results */}
      {status === "done" && summary && (
        <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/5 p-3">
          <CheckCircle className="mt-0.5 h-4 w-4 text-accent" />
          <div className="text-sm">
            <p className="font-medium">Taxonomy loaded successfully</p>
            <p className="text-muted-foreground">
              {summary.themes} themes, {summary.tensions} tensions, {summary.configs} config entries
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="text-sm">
            <p className="font-medium">Error</p>
            <p className="text-muted-foreground">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
