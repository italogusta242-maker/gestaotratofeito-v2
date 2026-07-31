-- Migration: Criação da tabela de Cache Semântico para IA
-- Tabela: ia_cache_respostas

CREATE TABLE IF NOT EXISTS public.ia_cache_respostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_usuario TEXT NOT NULL,
  resposta_ia TEXT NOT NULL,
  tipo_intencao TEXT NOT NULL CHECK (tipo_intencao IN ('ACAO', 'CONSULTA')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index para agilizar busca por texto exato na query do usuário
CREATE INDEX IF NOT EXISTS idx_ia_cache_respostas_query ON public.ia_cache_respostas (query_usuario);

-- Habilitar RLS e permitir CRUD para roles autenticadas (ou administradores)
ALTER TABLE public.ia_cache_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" 
ON public.ia_cache_respostas 
FOR ALL USING (auth.role() = 'authenticated');
