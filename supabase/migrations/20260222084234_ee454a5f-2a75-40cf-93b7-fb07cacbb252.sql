
-- Enable RLS on all tables with permissive policies (solo use, no auth)
ALTER TABLE public.ingestion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_theme_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tension_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tension_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_tensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for all tables (solo user, no auth)
CREATE POLICY "Allow all access" ON public.ingestion_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.claim_theme_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.theme_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.tension_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.tension_evidence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.taxonomy_themes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.taxonomy_tensions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.taxonomy_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);
CREATE POLICY "Allow all access to reports bucket" ON storage.objects FOR ALL USING (bucket_id = 'reports') WITH CHECK (bucket_id = 'reports');
