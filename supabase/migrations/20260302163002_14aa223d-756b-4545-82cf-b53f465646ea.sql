
-- ==========================================
-- 1. Cartões de Crédito
-- ==========================================
CREATE TABLE public.cartoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  bandeira TEXT,
  limite NUMERIC DEFAULT 0,
  dia_fechamento INTEGER NOT NULL DEFAULT 1,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access cartoes"
ON public.cartoes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Aux_op read cartoes"
ON public.cartoes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auxiliar_operacional'::app_role));

-- Add cartao_id to transacoes for linking parceled purchases
ALTER TABLE public.transacoes ADD COLUMN cartao_id UUID REFERENCES public.cartoes(id);

-- ==========================================
-- 2. Financiamentos / Empréstimos
-- ==========================================
CREATE TABLE public.financiamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor_total NUMERIC NOT NULL,
  valor_parcela NUMERIC NOT NULL,
  total_parcelas INTEGER NOT NULL,
  taxa_juros NUMERIC DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  veiculo_id UUID REFERENCES public.veiculos(id),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financiamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financiamentos"
ON public.financiamentos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Aux_op read financiamentos"
ON public.financiamentos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auxiliar_operacional'::app_role));

-- Add financiamento_id to transacoes
ALTER TABLE public.transacoes ADD COLUMN financiamento_id UUID REFERENCES public.financiamentos(id);

CREATE TRIGGER update_financiamentos_updated_at
BEFORE UPDATE ON public.financiamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 3. Contas Fixas / Recorrentes
-- ==========================================
CREATE TABLE public.contas_fixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_fixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access contas_fixas"
ON public.contas_fixas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Aux_op read contas_fixas"
ON public.contas_fixas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auxiliar_operacional'::app_role));

CREATE TRIGGER update_contas_fixas_updated_at
BEFORE UPDATE ON public.contas_fixas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
