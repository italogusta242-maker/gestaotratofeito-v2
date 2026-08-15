-- Tabela de chaves PIX. Cada chave é uma entidade independente que pode ser
-- vinculada (ou desvinculada) de qualquer conta bancária a qualquer momento.

CREATE TABLE IF NOT EXISTS public.chaves_pix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('CPF', 'CNPJ', 'Email', 'Telefone', 'Aleatória')),
  chave text NOT NULL,
  titular text,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chaves_pix_conta_idx ON public.chaves_pix(conta_bancaria_id);

ALTER TABLE public.chaves_pix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access chaves_pix" ON public.chaves_pix
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auxiliares podem ler chaves_pix" ON public.chaves_pix
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'auxiliar_operacional'::app_role)
    OR has_role(auth.uid(), 'auxiliar_emissao'::app_role)
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_chaves_pix()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chaves_pix_set_updated_at
  BEFORE UPDATE ON public.chaves_pix
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_chaves_pix();
