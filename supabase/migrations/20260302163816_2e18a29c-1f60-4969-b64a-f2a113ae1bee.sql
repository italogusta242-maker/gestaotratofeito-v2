
-- 1. Add consignment flag to veiculos
ALTER TABLE public.veiculos ADD COLUMN is_consignment BOOLEAN NOT NULL DEFAULT false;

-- 2. Regras de categorização para conciliação bancária
CREATE TABLE public.regras_categorizacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  palavra_chave TEXT NOT NULL,
  categoria_sugerida TEXT,
  centro_custo_sugerido UUID REFERENCES public.centros_custo(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.regras_categorizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access regras_categorizacao"
ON public.regras_categorizacao FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
