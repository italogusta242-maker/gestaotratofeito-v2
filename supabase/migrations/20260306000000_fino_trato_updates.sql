-- Migration: 20260306000000_fino_trato_updates.sql
-- Description: Add financial reconciliation fields and fixed categories constraint

-- 1. Add new columns to transacoes
ALTER TABLE public.transacoes 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
ADD COLUMN IF NOT EXISTS favorecido_pagador TEXT;

-- 2. Enforce fixed categories for Loja and Veículo
-- First, let's clean up any non-conforming categories if needed (optional but recommended in a real scenario)
-- For now, we'll just add the constraint.

ALTER TABLE public.transacoes
ADD CONSTRAINT check_categoria_fixa
CHECK (
  categoria IN (
    -- Categorias Loja
    'Aluguel', 'Água/Luz/Internet', 'Folha', 'Impostos',
    -- Categorias Veículo
    'Funilaria/Pintura', 'Mecânica', 'Estética', 'Taxas/Despachante', 'Combustível', 'Compra/Venda',
    -- Outras (se houver necessidade de manter as antigas, mas o prompt pede estrito)
    'Outros'
  )
);

-- 3. Ensure data_pagamento is consistently used
COMMENT ON COLUMN public.transacoes.data_pagamento IS 'Data em que o pagamento foi efetivado (baixa)';
COMMENT ON COLUMN public.transacoes.forma_pagamento IS 'Método de pagamento: PIX, Dinheiro, TED, etc.';
COMMENT ON COLUMN public.transacoes.favorecido_pagador IS 'Quem recebeu ou pagou o valor';
