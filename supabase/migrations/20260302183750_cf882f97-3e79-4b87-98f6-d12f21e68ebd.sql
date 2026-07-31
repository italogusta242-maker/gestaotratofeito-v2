
-- Tabela de logs do assistente IA
CREATE TABLE public.logs_ia_suporte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mensagem_usuario TEXT NOT NULL,
  resposta_ia TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'duvida',
  status_dev TEXT NOT NULL DEFAULT 'pendente'
);

ALTER TABLE public.logs_ia_suporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access logs_ia_suporte"
ON public.logs_ia_suporte
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert logs_ia_suporte"
ON public.logs_ia_suporte
FOR INSERT
TO authenticated
WITH CHECK (true);
