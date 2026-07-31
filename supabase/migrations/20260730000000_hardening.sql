-- Hardening: remove tabelas órfãs de IA, fecha bucket público, adiciona ON DELETE em FKs

-- 1. Drop tabelas órfãs de features de IA (removidas)
DROP TABLE IF EXISTS public.ia_cache_respostas CASCADE;
DROP TABLE IF EXISTS public.logs_ia_suporte CASCADE;

-- 2. Fechar bucket veiculos-docs (não é mais público)
UPDATE storage.buckets SET public = false WHERE id = 'veiculos-docs';

-- 3. Adicionar ON DELETE SET NULL nas FKs principais
--    Preserva histórico financeiro se algum registro referenciado for apagado.
DO $$
DECLARE
  r RECORD;
  target_fks TEXT[] := ARRAY[
    'transacoes.veiculo_id',
    'transacoes.conta_bancaria_id',
    'transacoes.centro_custo_id',
    'transacoes.user_id',
    'transacoes.cartao_id',
    'transacoes.financiamento_id',
    'veiculos.centro_custo_id',
    'veiculos.cliente_compra_id',
    'veiculos.cliente_venda_id',
    'financiamentos.veiculo_id',
    'financiamentos.centro_custo_id',
    'financiamentos.conta_bancaria_id',
    'contas_fixas.centro_custo_id',
    'contas_fixas.conta_bancaria_id',
    'cartoes.centro_custo_id',
    'cartoes.conta_bancaria_id'
  ];
  target_table TEXT;
  target_col TEXT;
BEGIN
  FOREACH target_table IN ARRAY (SELECT ARRAY(SELECT split_part(x, '.', 1) FROM unnest(target_fks) x))
  LOOP
    NULL;
  END LOOP;

  -- Percorre a lista e recria cada FK com ON DELETE SET NULL
  FOR i IN 1..array_length(target_fks, 1) LOOP
    target_table := split_part(target_fks[i], '.', 1);
    target_col := split_part(target_fks[i], '.', 2);

    -- Só recria se a tabela e coluna existirem
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target_table AND column_name = target_col
    ) THEN
      FOR r IN
        SELECT tc.constraint_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = target_table
          AND kcu.column_name = target_col
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target_table, r.constraint_name);
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE SET NULL',
          target_table, r.constraint_name, target_col, r.ref_table, r.ref_col
        );
        RAISE NOTICE 'Updated FK %.% -> %.% (ON DELETE SET NULL)', target_table, target_col, r.ref_table, r.ref_col;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 4. Índices úteis em colunas frequentemente filtradas
CREATE INDEX IF NOT EXISTS idx_transacoes_veiculo_id ON public.transacoes(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_centro_custo_id ON public.transacoes(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_bancaria_id ON public.transacoes(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_status ON public.transacoes(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_data_vencimento ON public.transacoes(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON public.veiculos(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_centro_custo_id ON public.veiculos(centro_custo_id);
