import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Helpers ───────────────────────────────────────────────

async function openaiChat(messages: any[], temperature = 0.2, maxTokens = 4000) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function openaiEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embedding error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
}

// Simple PDF text extraction — reads raw stream and extracts text between BT/ET markers
// For production, use a proper PDF library. This handles basic text-based PDFs.
function extractTextFromPdfBytes(bytes: Uint8Array): string[] {
  // Limit to ~10MB to avoid OOM
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const slice = bytes.length > MAX_PDF_BYTES ? bytes.slice(0, MAX_PDF_BYTES) : bytes;
  const text = new TextDecoder("latin1").decode(slice);
  // Free the bytes reference early — caller should also null out
  const pages: string[] = [];

  // Count pages
  const pagePattern = /\/Type\s*\/Page[^s]/g;
  let pageCount = 0;
  while (pagePattern.exec(text) !== null) pageCount++;

  // Extract text from streams — collect into array to avoid huge string concat
  const textParts: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = streamRegex.exec(text)) !== null) {
    const content = m[1];
    const parenRegex = /\(([^)]*)\)/g;
    let pm;
    const lineParts: string[] = [];
    while ((pm = parenRegex.exec(content)) !== null) {
      const decoded = pm[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()])/g, "$1");
      if (decoded.trim()) lineParts.push(decoded);
    }
    if (lineParts.length) textParts.push(lineParts.join(" "));
  }

  let allText = textParts.join("\n");

  // Fallback if basic extraction failed
  if (!allText.trim()) {
    allText = text.replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{3,}/g, "\n")
      .split("\n")
      .filter((line) => line.trim().length > 20 && !/^[%\/\[\]<>{}]/.test(line.trim()))
      .join("\n");
  }

  // Truncate to avoid downstream OOM (max ~200k chars)
  if (allText.length > 200000) allText = allText.slice(0, 200000);

  // Split into approximate pages
  if (pageCount > 1) {
    const lines = allText.split("\n").filter((l) => l.trim());
    const linesPerPage = Math.max(1, Math.ceil(lines.length / pageCount));
    for (let i = 0; i < pageCount; i++) {
      pages.push(lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join("\n"));
    }
  } else {
    pages.push(allText);
  }

  return pages.length ? pages : ["[No extractable text found in PDF]"];
}

// Sanitize text to remove problematic Unicode escape sequences that PostgreSQL rejects
function sanitizeText(text: string): string {
  // Remove null bytes and other control characters
  let cleaned = text.replace(/\x00/g, "");
  // Remove invalid Unicode surrogate pairs and escape sequences
  cleaned = cleaned.replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, "");
  cleaned = cleaned.replace(/\\u[dD][89abAB][0-9a-fA-F]{2}/g, "");
  // Remove any remaining non-printable characters except newlines/tabs
  cleaned = cleaned.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned;
}

function chunkText(pages: string[], targetTokens = 400): { text: string; pageStart: number; pageEnd: number }[] {
  const chunks: { text: string; pageStart: number; pageEnd: number }[] = [];
  let current = "";
  let currentStart = 1;

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const pageText = pages[i].trim();
    if (!pageText) continue;

    if (!current) currentStart = pageNum;

    const combined = current ? current + "\n\n" + pageText : pageText;
    const approxTokens = combined.split(/\s+/).length;

    if (approxTokens > targetTokens && current) {
      chunks.push({ text: current, pageStart: currentStart, pageEnd: pageNum - 1 });
      current = pageText;
      currentStart = pageNum;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current, pageStart: currentStart, pageEnd: pages.length });
  }

  // Hard-split any chunk that's still too large (>6000 chars ≈ 1500 tokens)
  const MAX_CHARS = 6000;
  const safechunks: typeof chunks = [];
  for (const c of chunks) {
    if (c.text.length <= MAX_CHARS) {
      safechunks.push(c);
    } else {
      // Split by sentences
      const sentences = c.text.match(/[^.!?]+[.!?]+/g) || [c.text];
      let buf = "";
      for (const s of sentences) {
        if ((buf + s).length > MAX_CHARS && buf) {
          safechunks.push({ text: buf.trim(), pageStart: c.pageStart, pageEnd: c.pageEnd });
          buf = s;
        } else {
          buf += s;
        }
      }
      if (buf.trim()) safechunks.push({ text: buf.trim(), pageStart: c.pageStart, pageEnd: c.pageEnd });
    }
  }

  return safechunks;
}

// ─── Main Pipeline ─────────────────────────────────────────

async function processReport(reportId: string, batchId: string, themes: any[], tensions: any[]) {
  // Update status
  await supabase.from("reports").update({ status: "processing" }).eq("id", reportId);

  const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single();
  if (!report || !report.file_path) throw new Error("Report not found or missing file_path");

  // 1. Download PDF
  const { data: fileData, error: dlError } = await supabase.storage.from("reports").download(report.file_path);
  if (dlError || !fileData) throw new Error(`Download failed: ${dlError?.message}`);

  let pdfBytes: Uint8Array | null = new Uint8Array(await fileData.arrayBuffer());

  // 2. Extract text
  const pages = extractTextFromPdfBytes(pdfBytes);
  pdfBytes = null; // Free PDF bytes from memory
  await supabase.from("reports").update({ page_count: pages.length }).eq("id", reportId);

  // 3. Chunk
  const rawChunks = chunkText(pages);
  pages.length = 0; // Free pages array
  if (!rawChunks.length) throw new Error("No text extracted from PDF");

  // 4. Embed in batch & store chunks
  const textsForEmbedding = rawChunks.map(c => sanitizeText(c.text).slice(0, 6000));
  
  // Batch embed in groups of 20 to stay within API limits
  const EMBED_BATCH = 20;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < textsForEmbedding.length; i += EMBED_BATCH) {
    const batch = textsForEmbedding.slice(i, i + EMBED_BATCH);
    const embeddings = await openaiEmbeddingBatch(batch);
    allEmbeddings.push(...embeddings);
  }

  const chunkIds: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const safeText = textsForEmbedding[i];
    const { data: inserted, error } = await supabase
      .from("chunks")
      .insert({
        report_id: reportId,
        text: safeText,
        page_start: rawChunks[i].pageStart,
        page_end: rawChunks[i].pageEnd,
        embedding: JSON.stringify(allEmbeddings[i]),
        token_count: safeText.split(/\s+/).length,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Chunk insert: ${error.message}`);
    chunkIds.push(inserted.id);
  }

  // 5. Extract claims via LLM
  const allText = rawChunks.map((c) => `[Pages ${c.pageStart}-${c.pageEnd}]\n${c.text}`).join("\n\n---\n\n");
  const truncatedText = allText.slice(0, 30000); // Stay within context limits

  const claimPrompt = `You are analyzing a hotel industry trend report. Extract 12-30 key claims from this report.

For each claim, provide:
- claim_text: A concise atomic statement (1-2 sentences)
- evidence_snippet: The exact quote or close paraphrase from the report that supports this claim
- page_number: The page number where this evidence appears (best estimate)
- confidence: Your confidence in this extraction (0.0 to 1.0)
- scope_geo: Geographic scope if mentioned (e.g., "US", "Europe", "Global", or null)
- scope_segment: Hotel segment if mentioned (e.g., "Luxury", "Budget", "All", or null)

Return ONLY a valid JSON array of objects. No markdown, no explanation.

Report text:
${truncatedText}`;

  const claimResponse = await openaiChat(
    [{ role: "user", content: claimPrompt }],
    0.1,
    4000
  );

  let claims: any[];
  try {
    const cleaned = claimResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    claims = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse claims JSON from LLM");
  }

  // 6. Store claims
  const claimRecords: { id: string; claim_text: string }[] = [];
  for (const claim of claims) {
    const { data, error } = await supabase
      .from("claims")
      .insert({
        report_id: reportId,
        batch_id: batchId,
        claim_text: sanitizeText(claim.claim_text || ""),
        evidence_snippet: claim.evidence_snippet ? sanitizeText(claim.evidence_snippet) : null,
        page_number: claim.page_number || null,
        confidence: claim.confidence || 0.5,
        scope_geo: claim.scope_geo || null,
        scope_segment: claim.scope_segment || null,
      })
      .select("id, claim_text")
      .single();
    if (error) throw new Error(`Claim insert: ${error.message}`);
    claimRecords.push(data);
  }

  // 7. Theme mapping
  if (themes.length > 0 && claimRecords.length > 0) {
    const themeList = themes
      .map((t: any) => `- ${t.theme_id}: ${t.label} — ${t.definition || "No definition"}`)
      .join("\n");

    const claimTexts = claimRecords.map((c, i) => `${i + 1}. ${c.claim_text}`).join("\n");

    const mappingPrompt = `Map each claim to the most relevant theme. Available themes:
${themeList}

Claims:
${claimTexts}

For each claim, return a JSON array of objects with:
- claim_index: (1-based index)
- theme_id: the best matching theme_id
- stance: "supports" | "contradicts" | "neutral"
- confidence: 0.0 to 1.0
- rationale: one short sentence

Return ONLY a valid JSON array.`;

    const mappingResponse = await openaiChat([{ role: "user", content: mappingPrompt }], 0.1, 4000);

    try {
      const cleaned = mappingResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const mappings = JSON.parse(cleaned);

      for (const m of mappings) {
        const idx = (m.claim_index || 1) - 1;
        if (idx >= 0 && idx < claimRecords.length) {
          await supabase.from("claim_theme_map").insert({
            claim_id: claimRecords[idx].id,
            theme_id: m.theme_id,
            stance: m.stance || "neutral",
            confidence: m.confidence || 0.5,
            rationale: m.rationale || null,
            is_primary: true,
          });
        }
      }
    } catch {
      console.error("Failed to parse theme mappings");
    }
  }

  // 8. Tension mapping
  if (tensions.length > 0 && claimRecords.length > 0) {
    const tensionList = tensions
      .map((t: any) => `- ${t.tension_id}: "${t.pole_a_label}" vs "${t.pole_b_label}" (${t.label})`)
      .join("\n");

    const claimTexts = claimRecords.map((c, i) => `${i + 1}. ${c.claim_text}`).join("\n");

    const tensionPrompt = `Analyze which claims relate to these tensions and which pole they support:

Tensions:
${tensionList}

Claims:
${claimTexts}

Return a JSON array of objects (only for claims that clearly relate to a tension):
- claim_index: (1-based)
- tension_id
- pole: "A" or "B"
- confidence: 0.0 to 1.0

Return ONLY a valid JSON array. If no claims match, return [].`;

    const tensionResponse = await openaiChat([{ role: "user", content: tensionPrompt }], 0.1, 3000);

    try {
      const cleaned = tensionResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const tensionMappings = JSON.parse(cleaned);

      for (const tm of tensionMappings) {
        const idx = (tm.claim_index || 1) - 1;
        if (idx >= 0 && idx < claimRecords.length) {
          await supabase.from("tension_evidence").insert({
            tension_id: tm.tension_id,
            claim_id: claimRecords[idx].id,
            pole: tm.pole || "A",
            confidence: tm.confidence || 0.5,
          });
        }
      }
    } catch {
      console.error("Failed to parse tension mappings");
    }
  }

  // Mark report as succeeded
  await supabase.from("reports").update({ status: "succeeded" }).eq("id", reportId);

  return { chunksCreated: chunkIds.length, claimsExtracted: claimRecords.length };
}

// ─── Scoring ───────────────────────────────────────────────

async function computeScores(batchId: string) {
  // Theme scores
  const { data: themeMaps } = await supabase
    .from("claim_theme_map")
    .select("theme_id, stance, confidence, claim_id, claims!inner(report_id, batch_id)")
    .eq("claims.batch_id", batchId);

  if (themeMaps && themeMaps.length > 0) {
    const byTheme: Record<string, { reports: Set<string>; confidences: number[]; stances: string[] }> = {};

    for (const m of themeMaps as any[]) {
      const tid = m.theme_id;
      if (!byTheme[tid]) byTheme[tid] = { reports: new Set(), confidences: [], stances: [] };
      byTheme[tid].reports.add(m.claims.report_id);
      byTheme[tid].confidences.push(Number(m.confidence) || 0);
      byTheme[tid].stances.push(m.stance);
    }

    for (const [themeId, data] of Object.entries(byTheme)) {
      const coverage = data.reports.size;
      const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
      const supportRatio = data.stances.filter((s) => s === "supports").length / data.stances.length;
      const supportScore = Math.round(100 * (0.4 * Math.min(coverage / 5, 1) + 0.4 * avgConf + 0.2 * supportRatio));

      await supabase.from("theme_scores").insert({
        theme_id: themeId,
        batch_id: batchId,
        coverage_count: coverage,
        support_score: supportScore,
        evidence_strength: Math.round(avgConf * 100) / 100,
        diversity_score: Math.round((coverage / Math.max(1, data.reports.size)) * 100) / 100,
      });
    }
  }

  // Tension scores
  const { data: tensionEvidence } = await supabase
    .from("tension_evidence")
    .select("tension_id, pole, confidence, claim_id, claims!inner(batch_id)")
    .eq("claims.batch_id", batchId);

  if (tensionEvidence && tensionEvidence.length > 0) {
    const byTension: Record<string, { aCount: number; bCount: number; confidences: number[] }> = {};

    for (const te of tensionEvidence as any[]) {
      const tid = te.tension_id;
      if (!byTension[tid]) byTension[tid] = { aCount: 0, bCount: 0, confidences: [] };
      if (te.pole === "A") byTension[tid].aCount++;
      else byTension[tid].bCount++;
      byTension[tid].confidences.push(Number(te.confidence) || 0);
    }

    for (const [tensionId, data] of Object.entries(byTension)) {
      const total = data.aCount + data.bCount;
      const balance = 1 - Math.abs(data.aCount - data.bCount) / total;
      const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
      const strengthScore = Math.round(100 * (0.5 * avgConf + 0.5 * balance));

      await supabase.from("tension_scores").insert({
        tension_id: tensionId,
        batch_id: batchId,
        polarization: Math.round(avgConf * 100) / 100,
        evidence_balance: Math.round(balance * 100) / 100,
        strength_score: strengthScore,
        pole_a_count: data.aCount,
        pole_b_count: data.bCount,
      });
    }
  }
}

// ─── HTTP Handler ──────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batch_id } = await req.json();
    if (!batch_id) throw new Error("batch_id is required");

    // Get batch
    await supabase.from("ingestion_batches").update({ status: "running", started_at: new Date().toISOString() }).eq("id", batch_id);

    // Get reports in batch — limit to 3 per invocation to avoid memory limits
    const MAX_PER_INVOCATION = 1;
    const { data: reports } = await supabase.from("reports").select("id").eq("batch_id", batch_id).eq("status", "pending").limit(MAX_PER_INVOCATION);
    if (!reports || reports.length === 0) throw new Error("No pending reports in batch");

    // Get taxonomy
    const { data: themes } = await supabase.from("taxonomy_themes").select("theme_id, label, definition, boundaries, cues");
    const { data: tensions } = await supabase.from("taxonomy_tensions").select("tension_id, label, pole_a_label, pole_a_cues, pole_b_label, pole_b_cues");

    let totalClaims = 0;
    let processed = 0;
    const errors: string[] = [];

    for (const report of reports) {
      try {
        const result = await processReport(report.id, batch_id, themes || [], tensions || []);
        totalClaims += result.claimsExtracted;
        processed++;
        await supabase.from("ingestion_batches").update({ reports_processed: processed, claims_extracted: totalClaims }).eq("id", batch_id);
      } catch (err: any) {
        console.error(`Report ${report.id} failed:`, err.message);
        await supabase.from("reports").update({ status: "failed", error_message: err.message }).eq("id", report.id);
        errors.push(`${report.id}: ${err.message}`);
      }
    }

    // Check if more pending reports remain
    const { data: remaining } = await supabase.from("reports").select("id").eq("batch_id", batch_id).eq("status", "pending").limit(1);
    const hasMore = remaining && remaining.length > 0;

    if (!hasMore) {
      // All done — compute scores and finalize
      await computeScores(batch_id);

      const finalStatus = errors.length === reports.length ? "failed" : "succeeded";
      await supabase.from("ingestion_batches").update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        error_message: errors.length ? errors.join("; ") : null,
      }).eq("id", batch_id);
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      batch_id,
      action: "ingestion_complete",
      model_provider: "openai",
      model_name: "gpt-4o-mini / text-embedding-3-small",
      details: { reports_processed: processed, claims_extracted: totalClaims, errors },
    });

    return new Response(
      JSON.stringify({ success: true, processed, totalClaims, errors, hasMore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Ingestion error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
