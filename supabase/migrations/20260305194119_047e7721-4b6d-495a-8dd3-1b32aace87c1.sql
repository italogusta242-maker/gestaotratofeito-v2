CREATE TABLE IF NOT EXISTS public.ia_cache_respostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_usuario TEXT NOT NULL,
  resposta_ia TEXT NOT NULL,
  tipo_intencao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ia_cache_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access ia_cache_respostas" ON public.ia_cache_respostas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert ia_cache_respostas" ON public.ia_cache_respostas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read ia_cache_respostas" ON public.ia_cache_respostas FOR SELECT TO authenticated USING (true);