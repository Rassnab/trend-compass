
# Updated Hotel Trend Radar — Implementation Plan (No PDF Viewer)

## Overview
A web app that ingests hotel industry trend-report PDFs, extracts structured claims via AI, and presents a dashboard of themes, tensions, and a grounded RAG chat. Based on your feedback, we will **exclude the embedded PDF viewer** and instead focus on presenting high-fidelity text snippets and metadata for all citations.

---

## Phase 1: Foundation & Database Schema
- **Supabase Setup**: Enable `pgvector`, configure OpenAI API keys as secrets.
- **Database Schema**: 
    - `ingestion_batches`: Track processing runs.
    - `reports`: Metadata (title, publisher, date, geography, segment).
    - `chunks`: Text spans with OpenAI embeddings and page references.
    - `claims`: Atomic statements with theme mapping, stance, and evidence snippets.
    - `theme_scores` & `tension_scores`: Computed aggregates for the dashboard.
- **App Shell**: Navigation (Dashboard, Themes, Tensions, Chat, Admin) and global filter bar (synced to URL).

## Phase 2: YAML Taxonomy & Admin Controls
- **Taxonomy Loading**: Admin UI to upload/update `master-metadata.yaml`, parsing it into structured database records.
- **Report Management**: Upload PDFs to Supabase Storage.
- **Ingestion Monitoring**: UI to trigger and monitor the status of the AI pipeline (queued, processing, success/fail).

## Phase 3: The Ingestion Pipeline (Edge Functions)
- **Text Extraction & Chunking**: Extract text with page-level awareness.
- **Vector Indexing**: Generate and store embeddings for semantic search.
- **Claim Extraction (LLM)**: Identify 12–30 key claims per report, capturing the exact text snippet and page number.
- **Automated Mapping**: Assign claims to themes and poles of tensions based on the YAML taxonomy.
- **Scoring Engine**: Run the logic to compute "Support" and "Strength" scores for the dashboard.

## Phase 4: Dashboard & Heatmap
- **Top Themes**: Cards showing support scores, report coverage, and AI-generated summaries.
- **Top Tensions**: Visualizing disagreements/tradeoffs with "strength" indicators.
- **Heatmap (Optional)**: A grid view of Themes vs. Reports for a bird's-eye view of the corpus.

## Phase 5: Deep Dives (Themes & Tensions)
- **Theme Detail**: 
    - Definitions and AI synthesis of the "consensus" view.
    - List of all supporting/contradicting reports.
    - **Evidence List**: Rich text snippets with "Report Title, p. XX" attribution.
- **Tension Detail**: 
    - Contrast views showing evidence for Pole A vs. Pole B.
    - "False Tension" alerts based on scope mismatches (e.g., one report is US-only, another is Global).

## Phase 6: RAG Chat with Grounded Citations
- **Intelligent Retrieval**: Uses vector search filtered by the global UI state (Geo, Segment, etc.).
- **Response Modes**: 
    - *Answer*: Standard Q&A.
    - *Compare*: Forced "Consensus vs. Disagreement" structure.
- **Citations**: Every claim in the chat will be followed by a reference (e.g., "[Report Name, p. 5]"). Clicking these will show the full source snippet in a side panel or tooltip rather than opening a PDF.

## Phase 7: Final Polish & QA
- **End-to-End Testing**: Verifying that filters correctly narrow down the data in both the dashboard and the chat.
- **Performance**: Ensuring scores are pre-computed or cached for fast loading.