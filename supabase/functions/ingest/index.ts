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

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

// ─── Helpers ───────────────────────────────────────────────

async function llmChat(messages: any[], temperature = 0.2, maxTokens = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LLM error ${res.status}: ${t}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

async function openaiEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Embedding error ${res.status}: ${t}`);
    }
    const data = await res.json();
    return data.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastErr: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isTransient =
        err.message?.includes("429") ||
        err.message?.includes("500") ||
        err.message?.includes("503") ||
        err.message?.includes("network") ||
        err.message?.includes("timeout") ||
        err.name === "AbortError";
      if (!isTransient || attempt === maxAttempts) throw err;
      console.warn(`Attempt ${attempt} failed (${err.message}), retrying in ${baseDelayMs * 2 ** (attempt - 1)}ms...`);
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

// Simple PDF text extraction
function extractTextFromPdfBytes(bytes: Uint8Array): string[] {
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const slice = bytes.length > MAX_PDF_BYTES ? bytes.slice(0, MAX_PDF_BYTES) : bytes;
  const text = new TextDecoder("latin1").decode(slice);
  const pages: string[] = [];

  const pagePattern = /\/Type\s*\/Page[^s]/g;
  let pageCount = 0;
  while (pagePattern.exec(text) !== null) pageCount++;

  const textParts: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = streamRegex.exec(text)) !== null) {
    const content = m[1];

    // Skip compressed/binary streams — they produce garbage when regex-matched
    const streamPrintable = (content.match(/[\x20-\x7E]/g) || []).length;
    if (streamPrintable / Math.max(content.length, 1) < 0.3) continue;

    const lineParts: string[] = [];

    // Extract parenthesized strings: (Hello World)
    const parenRegex = /\(([^)]{0,500})\)/g;
    let pm;
    while ((pm = parenRegex.exec(content)) !== null) {
      const decoded = pm[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()])/g, "$1");
      if (decoded.trim()) lineParts.push(decoded);
    }

    // Extract hex strings: <0054006F> (UTF-16BE or single-byte encoding)
    const hexRegex = /<([0-9a-fA-F]{4,})>/g;
    let hm;
    while ((hm = hexRegex.exec(content)) !== null) {
      const hexStr = hm[1];
      let decoded = "";
      if (hexStr.length % 4 === 0) {
        // Try UTF-16BE (common for CIDFont / Type0 fonts)
        for (let i = 0; i < hexStr.length; i += 4) {
          const code = parseInt(hexStr.slice(i, i + 4), 16);
          if (code > 31 && code < 65536) decoded += String.fromCharCode(code);
        }
      } else if (hexStr.length % 2 === 0) {
        // Single-byte encoding
        for (let i = 0; i < hexStr.length; i += 2) {
          const code = parseInt(hexStr.slice(i, i + 2), 16);
          if (code > 31 && code < 128) decoded += String.fromCharCode(code);
        }
      }
      if (decoded.trim().length > 2) lineParts.push(decoded);
    }

    if (lineParts.length) textParts.push(lineParts.join(" "));
  }

  let allText = textParts.join("\n");

  if (!allText.trim()) {
    allText = text.replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{3,}/g, "\n")
      .split("\n")
      .filter((line) => line.trim().length > 20 && !/^[%\/\[\]<>{}]/.test(line.trim()))
      .join("\n");
  }

  if (allText.length > 200000) allText = allText.slice(0, 200000);

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

function robustJsonParse(text: string): any {
  // Strip markdown fences
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  // Try direct parse
  try { return JSON.parse(cleaned); } catch {}
  // Try to find JSON array in the text
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
    // If array is truncated, try to fix by closing it
    const truncated = arrMatch[0].replace(/,\s*$/, "") + "]";
    try { return JSON.parse(truncated); } catch {}
    // Try removing the last incomplete object
    const lastComplete = truncated.replace(/,?\s*\{[^}]*$/, "") + "]";
    try { return JSON.parse(lastComplete); } catch {}
  }
  // Try to find JSON object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(`[${objMatch[0]}]`); } catch {}
  }
  throw new Error("No valid JSON found");
}

function sanitizeText(text: string): string {
  let cleaned = text.replace(/\x00/g, "");
  cleaned = cleaned.replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, "");
  cleaned = cleaned.replace(/\\u[dD][89abAB][0-9a-fA-F]{2}/g, "");
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
      // Carry last ~100 words into next chunk for retrieval context continuity
      const prevWords = current.split(/\s+/);
      const overlap = prevWords.slice(-100).join(" ");
      current = overlap + "\n\n" + pageText;
      currentStart = pageNum;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current, pageStart: currentStart, pageEnd: pages.length });
  }

  const MAX_CHARS = 6000;
  const safechunks: typeof chunks = [];
  for (const c of chunks) {
    if (c.text.length <= MAX_CHARS) {
      safechunks.push(c);
    } else {
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
  await supabase.from("reports").update({ status: "processing" }).eq("id", reportId);

  const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single();
  if (!report || !report.file_path) throw new Error("Report not found or missing file_path");

  // 1. Download PDF
  const { data: fileData, error: dlError } = await supabase.storage.from("reports").download(report.file_path);
  if (dlError || !fileData) throw new Error(`Download failed: ${dlError?.message}`);

  let pdfBytes: Uint8Array | null = new Uint8Array(await fileData.arrayBuffer());

  // 2. Extract text
  const pages = extractTextFromPdfBytes(pdfBytes);
  pdfBytes = null;

  // Quality gate: fail fast if extracted text is unreadable
  const combinedText = pages.join(" ");
  const printableChars = (combinedText.match(/[\x20-\x7E]/g) || []).length;
  const printableRatio = combinedText.length > 0 ? printableChars / combinedText.length : 0;
  const isPlaceholder = combinedText.trim() === "[No extractable text found in PDF]";
  if (isPlaceholder || printableRatio < 0.25 || combinedText.trim().length < 100) {
    throw new Error(
      `PDF text extraction failed (printable ratio: ${(printableRatio * 100).toFixed(0)}%). ` +
      `The file may be scanned, encrypted, or use an unsupported encoding.`
    );
  }

  await supabase.from("reports").update({ page_count: pages.length }).eq("id", reportId);

  // 3. Chunk
  const rawChunks = chunkText(pages);
  pages.length = 0;
  if (!rawChunks.length) throw new Error("No text extracted from PDF");

  // 4. Embed in batch & store chunks (BATCH INSERT)
  const textsForEmbedding = rawChunks.map(c => sanitizeText(c.text).slice(0, 6000));
  
  const EMBED_BATCH = 50; // Increased from 20
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < textsForEmbedding.length; i += EMBED_BATCH) {
    const batch = textsForEmbedding.slice(i, i + EMBED_BATCH);
    const embeddings = await withRetry(() => openaiEmbeddingBatch(batch));
    allEmbeddings.push(...embeddings);
  }

  // Batch insert all chunks at once
  const chunkRows = rawChunks.map((c, i) => ({
    report_id: reportId,
    text: textsForEmbedding[i],
    page_start: c.pageStart,
    page_end: c.pageEnd,
    embedding: JSON.stringify(allEmbeddings[i]),
    token_count: textsForEmbedding[i].split(/\s+/).length,
  }));

  const DB_BATCH = 50;
  for (let i = 0; i < chunkRows.length; i += DB_BATCH) {
    const { error } = await supabase.from("chunks").insert(chunkRows.slice(i, i + DB_BATCH));
    if (error) throw new Error(`Chunk batch insert: ${error.message}`);
  }

  // 5. Extract claims via LLM
  const allText = rawChunks.map((c) => `[Pages ${c.pageStart}-${c.pageEnd}]\n${c.text}`).join("\n\n---\n\n");

  // Proportional sampling: sample beginning, middle, and end to cover the full document
  const MAX_CHARS = 30000;
  let truncatedText: string;
  if (allText.length <= MAX_CHARS) {
    truncatedText = allText;
  } else {
    const third = Math.floor(MAX_CHARS / 3);
    const mid = Math.floor(allText.length / 2);
    truncatedText = [
      allText.slice(0, third),
      "\n\n---[middle section]---\n\n",
      allText.slice(mid - Math.floor(third / 2), mid + Math.floor(third / 2)),
      "\n\n---[end section]---\n\n",
      allText.slice(allText.length - third),
    ].join("");
  }

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

  const claimResponse = await withRetry(() => llmChat([
    { role: "system", content: "You are a JSON API. Respond ONLY with a valid JSON array. No prose, no markdown fences, no explanation — raw JSON only." },
    { role: "user", content: claimPrompt },
  ], 0.1, 8000));

  let claims: any[];
  try {
    // Sanitize the LLM response to remove binary characters before parsing
    const sanitizedResponse = claimResponse.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
    claims = robustJsonParse(sanitizedResponse);
    if (!Array.isArray(claims) || claims.length === 0) {
      throw new Error("Empty or non-array result");
    }
    // Filter out claims about garbled/unreadable text
    claims = claims.filter((c: any) => c.claim_text && !c.claim_text.toLowerCase().includes("garbled") && !c.claim_text.toLowerCase().includes("unreadable"));
    if (claims.length === 0) {
      throw new Error("PDF text is unreadable - no meaningful claims extracted");
    }
  } catch (parseErr: any) {
    console.error(`Claims parse failed for report ${reportId}. LLM response (first 500 chars):`, claimResponse?.slice(0, 500));
    throw new Error(`Failed to parse claims JSON from LLM: ${parseErr.message}`);
  }

  // 6. Batch insert all claims
  const claimInsertRows = claims.map(claim => ({
    report_id: reportId,
    batch_id: batchId,
    claim_text: sanitizeText(claim.claim_text || ""),
    evidence_snippet: claim.evidence_snippet ? sanitizeText(claim.evidence_snippet) : null,
    page_number: claim.page_number || null,
    confidence: claim.confidence || 0.5,
    scope_geo: claim.scope_geo || null,
    scope_segment: claim.scope_segment || null,
  }));

  const { data: insertedClaims, error: claimErr } = await supabase
    .from("claims")
    .insert(claimInsertRows)
    .select("id, claim_text");
  if (claimErr) throw new Error(`Claims batch insert: ${claimErr.message}`);

  const claimRecords = insertedClaims || [];

  // 7 & 8. Theme mapping + Tension mapping IN PARALLEL
  const mappingPromises: Promise<void>[] = [];

  if (themes.length > 0 && claimRecords.length > 0) {
    mappingPromises.push((async () => {
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

      const mappingResponse = await withRetry(() => llmChat([
        { role: "system", content: "You are a JSON API. Respond ONLY with a valid JSON array. No prose, no markdown fences, no explanation — raw JSON only." },
        { role: "user", content: mappingPrompt },
      ], 0.1, 4000));
      try {
        const mappings = robustJsonParse(mappingResponse);
        const validThemeIds = new Set(themes.map((t: any) => t.theme_id));

        const rows = mappings
          .filter((m: any) => {
            const idx = (m.claim_index || 1) - 1;
            if (idx < 0 || idx >= claimRecords.length) return false;
            if (!validThemeIds.has(m.theme_id)) {
              console.warn(`LLM returned unknown theme_id "${m.theme_id}" — skipping`);
              return false;
            }
            return true;
          })
          .map((m: any) => ({
            claim_id: claimRecords[(m.claim_index || 1) - 1].id,
            theme_id: m.theme_id,
            stance: m.stance || "neutral",
            confidence: m.confidence || 0.5,
            rationale: m.rationale || null,
            is_primary: true,
          }));

        if (rows.length) {
          await supabase.from("claim_theme_map").insert(rows);
        }
      } catch {
        console.error("Failed to parse theme mappings");
      }
    })());
  }

  if (tensions.length > 0 && claimRecords.length > 0) {
    mappingPromises.push((async () => {
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

      const tensionResponse = await withRetry(() => llmChat([
        { role: "system", content: "You are a JSON API. Respond ONLY with a valid JSON array. No prose, no markdown fences, no explanation — raw JSON only." },
        { role: "user", content: tensionPrompt },
      ], 0.1, 3000));
      try {
        const tensionMappings = robustJsonParse(tensionResponse);
        const validTensionIds = new Set(tensions.map((t: any) => t.tension_id));

        const rows = tensionMappings
          .filter((tm: any) => {
            const idx = (tm.claim_index || 1) - 1;
            if (idx < 0 || idx >= claimRecords.length) return false;
            if (!validTensionIds.has(tm.tension_id)) {
              console.warn(`LLM returned unknown tension_id "${tm.tension_id}" — skipping`);
              return false;
            }
            return true;
          })
          .map((tm: any) => ({
            tension_id: tm.tension_id,
            claim_id: claimRecords[(tm.claim_index || 1) - 1].id,
            pole: tm.pole || "A",
            confidence: tm.confidence || 0.5,
          }));

        if (rows.length) {
          await supabase.from("tension_evidence").insert(rows);
        }
      } catch {
        console.error("Failed to parse tension mappings");
      }
    })());
  }

  await Promise.all(mappingPromises);

  // Mark report as succeeded
  await supabase.from("reports").update({ status: "succeeded" }).eq("id", reportId);

  return { chunksCreated: chunkRows.length, claimsExtracted: claimRecords.length };
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

    const themeScoreRows = Object.entries(byTheme).map(([themeId, data]) => {
      const coverage = data.reports.size;
      const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
      const supportRatio = data.stances.filter((s) => s === "supports").length / data.stances.length;
      const supportScore = Math.round(100 * (0.4 * Math.min(coverage / 5, 1) + 0.4 * avgConf + 0.2 * supportRatio));
      return {
        theme_id: themeId,
        batch_id: batchId,
        coverage_count: coverage,
        support_score: supportScore,
        evidence_strength: Math.round(avgConf * 100) / 100,
        diversity_score: Math.round((coverage / Math.max(1, data.reports.size)) * 100) / 100,
      };
    });

    if (themeScoreRows.length) {
      await supabase.from("theme_scores").insert(themeScoreRows);
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

    const tensionScoreRows = Object.entries(byTension).map(([tensionId, data]) => {
      const total = data.aCount + data.bCount;
      const balance = 1 - Math.abs(data.aCount - data.bCount) / total;
      const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
      const strengthScore = Math.round(100 * (0.5 * avgConf + 0.5 * balance));
      return {
        tension_id: tensionId,
        batch_id: batchId,
        polarization: Math.round(avgConf * 100) / 100,
        evidence_balance: Math.round(balance * 100) / 100,
        strength_score: strengthScore,
        pole_a_count: data.aCount,
        pole_b_count: data.bCount,
      };
    });

    if (tensionScoreRows.length) {
      await supabase.from("tension_scores").insert(tensionScoreRows);
    }
  }
}

// ─── HTTP Handler ──────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batch_id } = await req.json();
    if (!batch_id) throw new Error("batch_id is required");

    await supabase.from("ingestion_batches").update({ status: "running", started_at: new Date().toISOString() }).eq("id", batch_id);

    // Process 3 reports per invocation
    const MAX_PER_INVOCATION = 3;
    const { data: reports } = await supabase.from("reports").select("id").eq("batch_id", batch_id).eq("status", "pending").limit(MAX_PER_INVOCATION);
    if (!reports || reports.length === 0) throw new Error("No pending reports in batch");

    // Get taxonomy once
    const { data: themes } = await supabase.from("taxonomy_themes").select("theme_id, label, definition, boundaries, cues");
    const { data: tensions } = await supabase.from("taxonomy_tensions").select("tension_id, label, pole_a_label, pole_a_cues, pole_b_label, pole_b_cues");

    // Get current cumulative counts from batch
    const { data: currentBatch } = await supabase.from("ingestion_batches").select("reports_processed, claims_extracted").eq("id", batch_id).single();
    let totalClaims = currentBatch?.claims_extracted || 0;
    let processed = currentBatch?.reports_processed || 0;
    const errors: string[] = [];

    const results = await Promise.all(
      reports.map(async (report) => {
        try {
          const result = await processReport(report.id, batch_id, themes || [], tensions || []);
          return { ok: true, claimsExtracted: result.claimsExtracted };
        } catch (err: any) {
          console.error(`Report ${report.id} failed:`, err.message);
          await supabase.from("reports").update({ status: "failed", error_message: err.message }).eq("id", report.id);
          errors.push(`${report.id}: ${err.message}`);
          return { ok: false, claimsExtracted: 0 };
        }
      })
    );

    for (const r of results) {
      if (r.ok) {
        totalClaims += r.claimsExtracted;
        processed++;
      }
    }
    await supabase.from("ingestion_batches").update({ reports_processed: processed, claims_extracted: totalClaims }).eq("id", batch_id);

    // Check if more pending reports remain
    const { data: remaining } = await supabase.from("reports").select("id").eq("batch_id", batch_id).eq("status", "pending").limit(1);
    const hasMore = remaining && remaining.length > 0;

    if (!hasMore) {
      await computeScores(batch_id);

      // Use batch-level totals from DB, not just this invocation's local errors
      const { data: batchReports } = await supabase
        .from("reports")
        .select("status")
        .eq("batch_id", batch_id);
      const totalInBatch = batchReports?.length || 0;
      const failedInBatch = batchReports?.filter((r: any) => r.status === "failed").length || 0;
      const failureRate = totalInBatch > 0 ? failedInBatch / totalInBatch : 0;
      const finalStatus = failureRate > 0.5 ? "failed" : "succeeded";
      await supabase.from("ingestion_batches").update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        error_message: errors.length ? errors.join("; ") : null,
      }).eq("id", batch_id);
    }

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
