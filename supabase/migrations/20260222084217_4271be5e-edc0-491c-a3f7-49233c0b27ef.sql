
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Ingestion batches
CREATE TABLE public.ingestion_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed')),
  reports_total INT DEFAULT 0,
  reports_processed INT DEFAULT 0,
  claims_extracted INT DEFAULT 0,
  unmapped_claim_pct NUMERIC(5,2) DEFAULT 0,
  error_message TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.ingestion_batches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  publisher TEXT,
  publish_date DATE,
  geography TEXT[] DEFAULT '{}',
  segment TEXT[] DEFAULT '{}',
  file_path TEXT,
  file_hash TEXT,
  page_count INT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chunks (text spans with embeddings)
CREATE TABLE public.chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  page_start INT,
  page_end INT,
  section_heading TEXT,
  text TEXT NOT NULL,
  embedding vector(1536),
  token_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Claims
CREATE TABLE public.claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.ingestion_batches(id) ON DELETE SET NULL,
  claim_text TEXT NOT NULL,
  evidence_snippet TEXT,
  page_number INT,
  page_range_start INT,
  page_range_end INT,
  confidence NUMERIC(3,2) DEFAULT 0,
  scope_geo TEXT,
  scope_segment TEXT,
  scope_time_horizon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Claim-theme mapping
CREATE TABLE public.claim_theme_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL,
  stance TEXT NOT NULL DEFAULT 'neutral' CHECK (stance IN ('supports','contradicts','neutral','out_of_scope')),
  is_primary BOOLEAN DEFAULT true,
  confidence NUMERIC(3,2) DEFAULT 0,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Theme scores (computed aggregates)
CREATE TABLE public.theme_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_id TEXT NOT NULL,
  batch_id UUID REFERENCES public.ingestion_batches(id) ON DELETE SET NULL,
  coverage_count INT DEFAULT 0,
  support_score NUMERIC(5,2) DEFAULT 0,
  diversity_score NUMERIC(5,2) DEFAULT 0,
  evidence_strength NUMERIC(5,2) DEFAULT 0,
  summary TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tension scores (computed aggregates)
CREATE TABLE public.tension_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tension_id TEXT NOT NULL,
  batch_id UUID REFERENCES public.ingestion_batches(id) ON DELETE SET NULL,
  polarization NUMERIC(5,2) DEFAULT 0,
  evidence_balance NUMERIC(5,2) DEFAULT 0,
  scope_mismatch_penalty NUMERIC(5,2) DEFAULT 0,
  strength_score NUMERIC(5,2) DEFAULT 0,
  pole_a_count INT DEFAULT 0,
  pole_b_count INT DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tension evidence (pole assignments)
CREATE TABLE public.tension_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tension_id TEXT NOT NULL,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  pole TEXT NOT NULL CHECK (pole IN ('A','B')),
  confidence NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Taxonomy storage (parsed YAML themes/tensions)
CREATE TABLE public.taxonomy_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  definition TEXT,
  boundaries JSONB DEFAULT '{}',
  cues JSONB DEFAULT '{}',
  dimensions JSONB DEFAULT '{}',
  ui_group TEXT,
  ui_order INT DEFAULT 0,
  relationships JSONB DEFAULT '{}',
  governance JSONB DEFAULT '{}',
  raw_yaml JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.taxonomy_tensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tension_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  pole_a_label TEXT,
  pole_a_cues JSONB DEFAULT '{}',
  pole_b_label TEXT,
  pole_b_cues JSONB DEFAULT '{}',
  false_tension_rules JSONB DEFAULT '{}',
  implications JSONB DEFAULT '{}',
  linked_themes TEXT[] DEFAULT '{}',
  tension_type TEXT,
  raw_yaml JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scoring config from YAML
CREATE TABLE public.taxonomy_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.ingestion_batches(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  model_provider TEXT,
  model_name TEXT,
  prompt_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_chunks_report ON public.chunks(report_id);
CREATE INDEX idx_chunks_embedding ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_claims_report ON public.claims(report_id);
CREATE INDEX idx_claim_theme_map_theme ON public.claim_theme_map(theme_id);
CREATE INDEX idx_claim_theme_map_claim ON public.claim_theme_map(claim_id);
CREATE INDEX idx_theme_scores_theme ON public.theme_scores(theme_id);
CREATE INDEX idx_tension_scores_tension ON public.tension_scores(tension_id);
CREATE INDEX idx_tension_evidence_tension ON public.tension_evidence(tension_id);
CREATE INDEX idx_reports_batch ON public.reports(batch_id);

-- No RLS needed: solo user, no auth required for v1
-- All tables are accessible without authentication
